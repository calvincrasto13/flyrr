"""
semantic_matcher.py — Three-Layer Semantic Product Matching Pipeline

Layer 1: Sentence Transformers — dense embeddings + cosine similarity to find candidates
Layer 2: Claude 3 (Anthropic) — binary match decision + confidence for borderline cases
Layer 3: SQLite cache — each product pair scored only once, avoiding repeated API calls

LangChain orchestrates: embedding lookup → similarity filter → conditional Claude call → cache write
"""

import sqlite3
import hashlib
import json
import os
import logging
from typing import Optional
from functools import lru_cache
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.schema.runnable import RunnableLambda
from langchain_anthropic import ChatAnthropic
from langchain.schema import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SIMILARITY_HIGH_THRESHOLD = 0.85   # Above this → definite match, skip Claude
SIMILARITY_LOW_THRESHOLD  = 0.50   # Below this → definite non-match, skip Claude
# Between low and high thresholds → ambiguous, send to Claude
CLAUDE_CONFIDENCE_THRESHOLD = 0.75  # Claude confidence floor to call it a match

EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Fast, good for product names
CLAUDE_MODEL = "claude-3-haiku-20240307"  # Cheapest Claude 3 for binary decisions

CACHE_DB_PATH = Path(__file__).parent / "product_match_cache.db"


# ── Layer 3: SQLite Cache ─────────────────────────────────────────────────────

def _get_pair_key(name_a: str, name_b: str) -> str:
    """Deterministic key — order-independent so A,B == B,A."""
    pair = tuple(sorted([name_a.lower().strip(), name_b.lower().strip()]))
    return hashlib.sha256(f"{pair[0]}|||{pair[1]}".encode()).hexdigest()


def _init_cache(db_path: Path = CACHE_DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS match_cache (
            pair_key    TEXT PRIMARY KEY,
            name_a      TEXT,
            name_b      TEXT,
            is_match    INTEGER,
            confidence  REAL,
            method      TEXT,
            similarity  REAL,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    return conn


def _cache_get(conn: sqlite3.Connection, pair_key: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT is_match, confidence, method, similarity FROM match_cache WHERE pair_key=?",
        (pair_key,)
    ).fetchone()
    if row:
        return {"is_match": bool(row[0]), "confidence": row[1], "method": row[2], "similarity": row[3]}
    return None


def _cache_set(conn: sqlite3.Connection, pair_key: str, name_a: str, name_b: str,
               is_match: bool, confidence: float, method: str, similarity: float):
    conn.execute(
        """INSERT OR REPLACE INTO match_cache
           (pair_key, name_a, name_b, is_match, confidence, method, similarity)
           VALUES (?,?,?,?,?,?,?)""",
        (pair_key, name_a, name_b, int(is_match), confidence, method, similarity)
    )
    conn.commit()


# ── Layer 1: Sentence Transformer Embeddings ─────────────────────────────────

@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    logger.info("Loading SentenceTransformer model '%s'...", EMBEDDING_MODEL)
    return SentenceTransformer(EMBEDDING_MODEL)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def embed_product_names(names: list[str]) -> np.ndarray:
    """Return (N, D) embedding matrix for a list of product names."""
    model = _get_model()
    return model.encode(names, convert_to_numpy=True, normalize_embeddings=True)


def find_candidates(query_name: str, catalog_names: list[str],
                    threshold: float = SIMILARITY_LOW_THRESHOLD) -> list[dict]:
    """
    Layer 1: Embed query + all catalog names, return candidates above threshold.
    Returns list of {name, similarity} sorted descending.
    """
    if not catalog_names:
        return []
    all_names = [query_name] + catalog_names
    embeddings = embed_product_names(all_names)
    query_vec = embeddings[0]
    catalog_vecs = embeddings[1:]

    results = []
    for i, name in enumerate(catalog_names):
        sim = _cosine_similarity(query_vec, catalog_vecs[i])
        if sim >= threshold:
            results.append({"name": name, "similarity": sim})

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results


# ── Layer 2: Claude 3 for Ambiguous Cases ─────────────────────────────────────

def _ask_claude(name_a: str, name_b: str) -> dict:
    """
    Call Claude 3 Haiku with a structured prompt for binary match + confidence score.
    Returns {"is_match": bool, "confidence": float, "reasoning": str}
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — defaulting to no match for ambiguous pair")
        return {"is_match": False, "confidence": 0.0, "reasoning": "API key not configured"}

    llm = ChatAnthropic(model=CLAUDE_MODEL, api_key=api_key, max_tokens=256)

    system_prompt = (
        "You are a grocery product matching expert. Given two product names from different Canadian "
        "grocery retailers, determine if they refer to the same product. "
        "Respond ONLY with valid JSON in this exact format:\n"
        '{"is_match": true|false, "confidence": 0.0-1.0, "reasoning": "brief one-line explanation"}\n\n'
        "Consider these a match if they are the same brand, same product type, same size/volume, "
        "even if the names are phrased differently (e.g., '1L' vs '1 litre', 'OJ' vs 'Orange Juice')."
    )

    user_prompt = f'Product A: "{name_a}"\nProduct B: "{name_b}"\n\nAre these the same product?'

    try:
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        result = json.loads(response.content.strip())
        return {
            "is_match": bool(result.get("is_match", False)),
            "confidence": float(result.get("confidence", 0.0)),
            "reasoning": result.get("reasoning", "")
        }
    except Exception as exc:
        logger.error("Claude call failed for ('%s', '%s'): %s", name_a, name_b, exc)
        return {"is_match": False, "confidence": 0.0, "reasoning": f"Claude error: {exc}"}


# ── LangChain Orchestration ───────────────────────────────────────────────────

class SemanticProductMatcher:
    """
    Three-layer pipeline orchestrated by LangChain runnables:

        embedding_lookup
            → similarity_filter
                → [if ambiguous] conditional_claude_call
                    → cache_write

    Usage:
        matcher = SemanticProductMatcher()
        result = matcher.match("Tropicana Orange Juice 1L", "100% OJ Tropicana 1 litre")
        # → {"is_match": True, "confidence": 0.92, "method": "claude", "similarity": 0.71}
    """

    def __init__(self, db_path: Path = CACHE_DB_PATH):
        self.conn = _init_cache(db_path)
        self._build_chain()

    def _build_chain(self):
        """Wire up the LangChain runnable pipeline."""

        def step_cache_check(inputs: dict) -> dict:
            key = _get_pair_key(inputs["name_a"], inputs["name_b"])
            cached = _cache_get(self.conn, key)
            if cached:
                logger.debug("Cache hit for pair key %s", key[:8])
                return {**inputs, "pair_key": key, "cache_hit": True, **cached}
            return {**inputs, "pair_key": key, "cache_hit": False}

        def step_embedding(inputs: dict) -> dict:
            if inputs.get("cache_hit"):
                return inputs
            vecs = embed_product_names([inputs["name_a"], inputs["name_b"]])
            sim = _cosine_similarity(vecs[0], vecs[1])
            return {**inputs, "similarity": sim}

        def step_similarity_filter(inputs: dict) -> dict:
            if inputs.get("cache_hit"):
                return inputs
            sim = inputs["similarity"]
            if sim >= SIMILARITY_HIGH_THRESHOLD:
                return {**inputs, "is_match": True, "confidence": sim, "method": "embedding_high", "needs_claude": False}
            elif sim < SIMILARITY_LOW_THRESHOLD:
                return {**inputs, "is_match": False, "confidence": 1.0 - sim, "method": "embedding_low", "needs_claude": False}
            else:
                return {**inputs, "needs_claude": True}

        def step_conditional_claude(inputs: dict) -> dict:
            if inputs.get("cache_hit") or not inputs.get("needs_claude"):
                return inputs
            logger.info("Ambiguous pair (sim=%.2f) — escalating to Claude: '%s' vs '%s'",
                        inputs["similarity"], inputs["name_a"], inputs["name_b"])
            result = _ask_claude(inputs["name_a"], inputs["name_b"])
            is_match = result["is_match"] and result["confidence"] >= CLAUDE_CONFIDENCE_THRESHOLD
            return {
                **inputs,
                "is_match": is_match,
                "confidence": result["confidence"],
                "method": "claude",
                "claude_reasoning": result.get("reasoning", "")
            }

        def step_cache_write(inputs: dict) -> dict:
            if not inputs.get("cache_hit"):
                _cache_set(
                    self.conn, inputs["pair_key"],
                    inputs["name_a"], inputs["name_b"],
                    inputs["is_match"], inputs["confidence"],
                    inputs["method"], inputs.get("similarity", 0.0)
                )
            return inputs

        self.chain = (
            RunnableLambda(step_cache_check)
            | RunnableLambda(step_embedding)
            | RunnableLambda(step_similarity_filter)
            | RunnableLambda(step_conditional_claude)
            | RunnableLambda(step_cache_write)
        )

    def match(self, name_a: str, name_b: str) -> dict:
        """
        Match two product names. Returns:
        {
            "is_match": bool,
            "confidence": float (0-1),
            "method": "embedding_high" | "embedding_low" | "claude",
            "similarity": float,
            "cache_hit": bool
        }
        """
        result = self.chain.invoke({"name_a": name_a, "name_b": name_b})
        return {
            "is_match": result.get("is_match", False),
            "confidence": result.get("confidence", 0.0),
            "method": result.get("method", "unknown"),
            "similarity": result.get("similarity", 0.0),
            "cache_hit": result.get("cache_hit", False),
        }

    def find_best_match(self, query: str, catalog: list[str]) -> Optional[dict]:
        """
        Given a product name and a list of candidates from another store,
        return the best semantic match or None if no match found.

        Returns: {"matched_name": str, "is_match": bool, "confidence": float, ...}
        """
        candidates = find_candidates(query, catalog, threshold=SIMILARITY_LOW_THRESHOLD)
        best = None
        for candidate in candidates:
            result = self.match(query, candidate["name"])
            if result["is_match"]:
                if best is None or result["confidence"] > best["confidence"]:
                    best = {"matched_name": candidate["name"], **result}
        return best

    def get_cache_stats(self) -> dict:
        """Return cache analytics — how many pairs have been scored and how often Claude was called."""
        row = self.conn.execute(
            "SELECT COUNT(*), SUM(CASE WHEN method='claude' THEN 1 ELSE 0 END) FROM match_cache"
        ).fetchone()
        total, claude_calls = row[0] or 0, row[1] or 0
        return {
            "total_cached_pairs": total,
            "claude_calls": claude_calls,
            "embedding_only": total - claude_calls,
            "claude_call_rate": round(claude_calls / total, 3) if total > 0 else 0
        }


# ── Module-level singleton (lazy init) ────────────────────────────────────────
_matcher_instance: Optional[SemanticProductMatcher] = None


def get_matcher() -> SemanticProductMatcher:
    global _matcher_instance
    if _matcher_instance is None:
        _matcher_instance = SemanticProductMatcher()
    return _matcher_instance
