"""
product_grouper.py — Improved Cross-Store Product Grouping

Replaces the naive reference-store approach in server.py with a full N×M
cross-store comparison backed by a union-find (disjoint set) structure.

Algorithm
---------
1. For every ordered pair of stores (A, B), compare every item in A against
   every item in B using the semantic matcher.
2. Each confirmed match merges the two items into the same union-find component.
   Transitivity is handled automatically: if A~B and B~C then A, B, C share
   a component even if A and C were never directly compared.
3. After all comparisons, collect the items in each component into a product
   group, deduplicate within a store (keep cheapest), compute savings, and
   pick a canonical name from the reference item.
4. Groups are sorted by savings_vs_worst descending.

The `max_claude_calls` guard (Priority 4) is threaded through here so the
grouper can short-circuit Claude calls once the budget is exhausted.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Union-Find ────────────────────────────────────────────────────────────────

class UnionFind:
    """Path-compressed, union-by-rank disjoint set structure."""

    def __init__(self, n: int) -> None:
        self.parent: List[int] = list(range(n))
        self.rank: List[int] = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

    def same(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)


# ── Main grouping function ────────────────────────────────────────────────────

def group_products_across_stores(
    items: List[Dict[str, Any]],
    matcher: Any,
    max_claude_calls: int = 5,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Group equivalent products across stores using a full N×M comparison and
    union-find transitive merging.

    Parameters
    ----------
    items:
        Flat list of processed Flipp items (each has 'merchant', 'name',
        'current_price', 'global_id', 'image_url', 'merchant_logo').
    matcher:
        A ``SemanticProductMatcher`` instance (from semantic_matcher.py).
    max_claude_calls:
        Maximum number of Claude API calls allowed for this request.
        Once the budget is exhausted, ambiguous pairs default to no-match.

    Returns
    -------
    (groups, claude_calls_used)
        groups: list of product-group dicts sorted by savings_vs_worst desc.
        claude_calls_used: how many Claude calls were made during this run.
    """
    if not items:
        return [], 0

    # Split by merchant
    by_merchant: Dict[str, List[Dict]] = {}
    for item in items:
        by_merchant.setdefault(item["merchant"], []).append(item)

    merchants = list(by_merchant.keys())

    # Single-store shortcut
    if len(merchants) < 2:
        return _single_store_groups(items), 0

    # Flatten all items into an indexed list
    all_items: List[Dict] = []
    item_index: Dict[str, int] = {}  # uid → index in all_items

    for item in items:
        uid = _item_uid(item)
        if uid not in item_index:
            item_index[uid] = len(all_items)
            all_items.append(item)

    n = len(all_items)
    uf = UnionFind(n)

    claude_calls_used = 0

    # Patch the matcher to count and cap Claude calls
    from semantic_matcher import (
        embed_product_names,
        _cosine_similarity,
        _get_pair_key,
        _cache_get,
        SIMILARITY_HIGH_THRESHOLD,
        SIMILARITY_LOW_THRESHOLD,
    )

    def _capped_match(name_a: str, name_b: str) -> dict:
        nonlocal claude_calls_used
        # Pre-check cache — a cache hit never costs a Claude call
        key = _get_pair_key(name_a, name_b)
        cached = _cache_get(matcher.conn, key)
        if cached:
            return {**cached, "cache_hit": True}

        # Compute embedding similarity first (cheap)
        vecs = embed_product_names([name_a, name_b])
        sim = _cosine_similarity(vecs[0], vecs[1])

        if sim >= SIMILARITY_HIGH_THRESHOLD or sim < SIMILARITY_LOW_THRESHOLD:
            # Auto-decision — no Claude needed
            return matcher.match(name_a, name_b)
        else:
            # Would need Claude — check budget
            if claude_calls_used >= max_claude_calls:
                logger.debug(
                    "Claude budget exhausted (%d/%d) — defaulting to no-match for '%s' vs '%s'",
                    claude_calls_used, max_claude_calls, name_a, name_b,
                )
                return {
                    "is_match": False,
                    "confidence": 0.0,
                    "method": "budget_exceeded",
                    "similarity": sim,
                    "cache_hit": False,
                }
            claude_calls_used += 1
            return matcher.match(name_a, name_b)

    # Full N×M cross-store comparison
    for i, merchant_a in enumerate(merchants):
        for merchant_b in merchants[i + 1:]:
            items_a = by_merchant[merchant_a]
            items_b = by_merchant[merchant_b]

            for item_a in items_a:
                uid_a = _item_uid(item_a)
                idx_a = item_index[uid_a]

                for item_b in items_b:
                    uid_b = _item_uid(item_b)
                    idx_b = item_index[uid_b]

                    # Skip if already in the same group
                    if uf.same(idx_a, idx_b):
                        continue

                    result = _capped_match(item_a["name"], item_b["name"])
                    if result.get("is_match"):
                        uf.union(idx_a, idx_b)

    # Collect components → product groups
    from collections import defaultdict
    components: Dict[int, List[Dict]] = defaultdict(list)
    for item in all_items:
        uid = _item_uid(item)
        root = uf.find(item_index[uid])
        components[root].append(item)

    groups: List[Dict[str, Any]] = []
    for root, group_items in components.items():
        # Deduplicate within each store — keep cheapest per merchant
        by_store: Dict[str, Dict] = {}
        for item in group_items:
            m = item["merchant"]
            if m not in by_store or item["current_price"] < by_store[m]["current_price"]:
                by_store[m] = item

        store_entries = list(by_store.values())
        store_entries.sort(key=lambda x: x["current_price"])

        prices = [s["current_price"] for s in store_entries]
        best_item = store_entries[0]
        worst_price = max(prices)
        best_price = min(prices)

        # Canonical name: prefer the item from the store with most items (original heuristic)
        ref_merchant = max(by_merchant, key=lambda m: len(by_merchant[m]))
        canonical = next(
            (s["name"] for s in store_entries if s["merchant"] == ref_merchant),
            store_entries[0]["name"],
        )

        # Determine match method for this group
        methods_used: set = set()
        for s in store_entries[1:]:
            # Re-query cache to get method
            from semantic_matcher import _get_pair_key, _cache_get
            key = _get_pair_key(store_entries[0]["name"], s["name"])
            cached = _cache_get(matcher.conn, key)  # type: ignore[arg-type]
            if cached:
                methods_used.add(cached.get("method", "unknown"))

        if len(store_entries) == 1:
            match_method = "single_store"
        elif "claude" in methods_used:
            match_method = "claude"
        elif any(m.startswith("embedding") for m in methods_used):
            match_method = "embedding"
        else:
            match_method = "embedding"

        groups.append({
            "canonical_name": canonical,
            "stores": [
                {
                    "merchant": s["merchant"],
                    "name": s["name"],
                    "price": s["current_price"],
                    "image_url": s.get("image_url", ""),
                    "merchant_logo": s.get("merchant_logo", ""),
                    "global_id": s.get("global_id", ""),
                }
                for s in store_entries
            ],
            "best_price": best_price,
            "best_merchant": best_item["merchant"],
            "worst_price": worst_price,
            "savings_vs_worst": round(worst_price - best_price, 2),
            "match_method": match_method,
            "store_count": len(store_entries),
        })

    groups.sort(key=lambda g: g["savings_vs_worst"], reverse=True)
    return groups, claude_calls_used


# ── Helpers ───────────────────────────────────────────────────────────────────

def _item_uid(item: Dict[str, Any]) -> str:
    """Stable unique identifier for an item (global_id preferred, else merchant+name)."""
    gid = item.get("global_id", "")
    if gid:
        return f"{item['merchant']}::{gid}"
    return f"{item['merchant']}::{item['name']}"


def _single_store_groups(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return single-store product groups when only one merchant is present."""
    return [
        {
            "canonical_name": item["name"],
            "stores": [
                {
                    "merchant": item["merchant"],
                    "name": item["name"],
                    "price": item["current_price"],
                    "image_url": item.get("image_url", ""),
                    "merchant_logo": item.get("merchant_logo", ""),
                    "global_id": item.get("global_id", ""),
                }
            ],
            "best_price": item["current_price"],
            "best_merchant": item["merchant"],
            "worst_price": item["current_price"],
            "savings_vs_worst": 0.0,
            "match_method": "single_store",
            "store_count": 1,
        }
        for item in items
    ]
