#!/usr/bin/env python3
"""
eval_matcher.py — Evaluation Harness for the Semantic Product Matcher

Usage
-----
    # Run against the built-in test suite
    python eval_matcher.py

    # Run against a custom CSV (columns: name_a, name_b, expected_match)
    python eval_matcher.py --csv path/to/pairs.csv

    # Print per-pair details
    python eval_matcher.py --verbose

    # Save results to JSON
    python eval_matcher.py --output results.json

Metrics reported
----------------
    Accuracy, Precision, Recall, F1, Confusion Matrix,
    per-method breakdown, latency stats, and Claude call rate.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Optional

# ── Built-in labelled test pairs ─────────────────────────────────────────────

LABELLED_PAIRS: List[dict] = [
    # ── Definite matches ──────────────────────────────────────────────────────
    {"name_a": "Tropicana Orange Juice 1.75L", "name_b": "Tropicana OJ 1.75 litre", "expected": True},
    {"name_a": "Dempster's Whole Wheat Bread 675g", "name_b": "Dempsters Whole Wheat Bread 675 g", "expected": True},
    {"name_a": "Natrel 2% Milk 4L", "name_b": "Natrel Partly Skimmed 2% Milk 4 Litre", "expected": True},
    {"name_a": "Heinz Ketchup 1L", "name_b": "Heinz Tomato Ketchup 1 litre", "expected": True},
    {"name_a": "PC Free From Chicken Breast Boneless Skinless 1kg", "name_b": "PC Free From Chicken Breast 1 kg", "expected": True},
    {"name_a": "Lay's Classic Potato Chips 200g", "name_b": "Lays Original Chips 200 g", "expected": True},
    {"name_a": "Quaker Oats Quick Oats 1kg", "name_b": "Quaker Quick Oats 1 kg", "expected": True},
    {"name_a": "Cheerios Original Cereal 520g", "name_b": "General Mills Cheerios 520 g", "expected": True},
    {"name_a": "Almond Breeze Unsweetened Almond Milk 1.89L", "name_b": "Blue Diamond Almond Breeze Unsweetened 1.89 litre", "expected": True},
    {"name_a": "Barilla Spaghetti 900g", "name_b": "Barilla Pasta Spaghetti 900 g", "expected": True},
    {"name_a": "Campbell's Tomato Soup 284mL", "name_b": "Campbells Condensed Tomato Soup 284 ml", "expected": True},
    {"name_a": "Hellmann's Real Mayonnaise 890mL", "name_b": "Hellmanns Real Mayonnaise 890 ml", "expected": True},
    {"name_a": "Kraft Peanut Butter Smooth 1kg", "name_b": "Kraft Smooth Peanut Butter 1 kg", "expected": True},
    {"name_a": "Danone Activia Strawberry Yogurt 650g", "name_b": "Activia Strawberry Probiotic Yogurt 650 g", "expected": True},
    {"name_a": "Minute Maid Apple Juice 1.89L", "name_b": "Minute Maid Apple Juice 1.89 litre", "expected": True},

    # ── Definite non-matches ──────────────────────────────────────────────────
    {"name_a": "Tropicana Orange Juice 1.75L", "name_b": "Tropicana Apple Juice 1.75L", "expected": False},
    {"name_a": "Dempster's Whole Wheat Bread 675g", "name_b": "Dempster's White Bread 675g", "expected": False},
    {"name_a": "Natrel 2% Milk 4L", "name_b": "Natrel Skim Milk 4L", "expected": False},
    {"name_a": "Heinz Ketchup 1L", "name_b": "Heinz Mustard 375mL", "expected": False},
    {"name_a": "Lay's Classic Potato Chips 200g", "name_b": "Lay's BBQ Chips 200g", "expected": False},
    {"name_a": "Quaker Oats Quick Oats 1kg", "name_b": "Quaker Granola Bars 156g", "expected": False},
    {"name_a": "Cheerios Original Cereal 520g", "name_b": "Honey Nut Cheerios 520g", "expected": False},
    {"name_a": "Barilla Spaghetti 900g", "name_b": "Barilla Penne 900g", "expected": False},
    {"name_a": "Campbell's Tomato Soup 284mL", "name_b": "Campbell's Chicken Noodle Soup 284mL", "expected": False},
    {"name_a": "Kraft Peanut Butter Smooth 1kg", "name_b": "Kraft Peanut Butter Crunchy 1kg", "expected": False},
    {"name_a": "Danone Activia Strawberry Yogurt 650g", "name_b": "Danone Activia Blueberry Yogurt 650g", "expected": False},
    {"name_a": "Minute Maid Apple Juice 1.89L", "name_b": "Minute Maid Orange Juice 1.89L", "expected": False},
    {"name_a": "PC Free From Chicken Breast 1kg", "name_b": "PC Free From Ground Beef 1kg", "expected": False},
    {"name_a": "Almond Breeze Unsweetened Almond Milk 1.89L", "name_b": "Silk Unsweetened Soy Milk 1.89L", "expected": False},
    {"name_a": "Hellmann's Real Mayonnaise 890mL", "name_b": "Hellmann's Light Mayonnaise 890mL", "expected": False},

    # ── Ambiguous / tricky pairs ──────────────────────────────────────────────
    {"name_a": "PC Organics Baby Spinach 142g", "name_b": "PC Organics Spinach 142 g", "expected": True},
    {"name_a": "Oikos Triple Zero Vanilla Yogurt 4x100g", "name_b": "Oikos Triple Zero Vanilla Greek Yogurt 4 x 100 g", "expected": True},
    {"name_a": "Compliments Butter Salted 454g", "name_b": "Compliments Salted Butter 454 g", "expected": True},
    {"name_a": "No Name Pasta Sauce Tomato Basil 680mL", "name_b": "No Name Tomato Basil Pasta Sauce 680 ml", "expected": True},
    {"name_a": "Tropicana Orange Juice 1.75L", "name_b": "Tropicana Orange Juice 900mL", "expected": False},  # different size
    {"name_a": "Dempster's Whole Wheat Bread 675g", "name_b": "Dempster's Multigrain Bread 675g", "expected": False},
]


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class PairResult:
    name_a: str
    name_b: str
    expected: bool
    predicted: bool
    confidence: float
    method: str
    similarity: float
    cache_hit: bool
    latency_ms: float
    correct: bool = field(init=False)

    def __post_init__(self):
        self.correct = self.predicted == self.expected


@dataclass
class EvalReport:
    total: int = 0
    correct: int = 0
    tp: int = 0  # true positive
    tn: int = 0  # true negative
    fp: int = 0  # false positive
    fn: int = 0  # false negative

    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0

    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    cache_hit_rate: float = 0.0
    claude_call_rate: float = 0.0

    method_breakdown: dict = field(default_factory=dict)
    pair_results: List[dict] = field(default_factory=list)

    def compute(self, results: List[PairResult]) -> None:
        self.total = len(results)
        self.correct = sum(1 for r in results if r.correct)

        for r in results:
            if r.expected and r.predicted:
                self.tp += 1
            elif not r.expected and not r.predicted:
                self.tn += 1
            elif not r.expected and r.predicted:
                self.fp += 1
            else:
                self.fn += 1

        self.accuracy = self.correct / self.total if self.total else 0.0
        self.precision = self.tp / (self.tp + self.fp) if (self.tp + self.fp) else 0.0
        self.recall = self.tp / (self.tp + self.fn) if (self.tp + self.fn) else 0.0
        self.f1 = (
            2 * self.precision * self.recall / (self.precision + self.recall)
            if (self.precision + self.recall) else 0.0
        )

        latencies = sorted(r.latency_ms for r in results)
        self.avg_latency_ms = sum(latencies) / len(latencies) if latencies else 0.0
        p95_idx = max(0, int(len(latencies) * 0.95) - 1)
        self.p95_latency_ms = latencies[p95_idx] if latencies else 0.0

        cache_hits = sum(1 for r in results if r.cache_hit)
        self.cache_hit_rate = cache_hits / self.total if self.total else 0.0

        claude_calls = sum(1 for r in results if r.method == "claude")
        self.claude_call_rate = claude_calls / self.total if self.total else 0.0

        method_counts: dict = {}
        for r in results:
            method_counts[r.method] = method_counts.get(r.method, 0) + 1
        self.method_breakdown = method_counts

        self.pair_results = [asdict(r) for r in results]


# ── Core evaluation logic ─────────────────────────────────────────────────────

def run_evaluation(
    pairs: List[dict],
    verbose: bool = False,
) -> EvalReport:
    """
    Run the matcher against all labelled pairs and return an EvalReport.
    """
    # Import here so the module can be imported without triggering model load
    from semantic_matcher import get_matcher
    matcher = get_matcher()

    results: List[PairResult] = []

    for pair in pairs:
        name_a = pair["name_a"]
        name_b = pair["name_b"]
        expected = bool(pair["expected"])

        t0 = time.perf_counter()
        result = matcher.match(name_a, name_b)
        latency_ms = (time.perf_counter() - t0) * 1000

        pr = PairResult(
            name_a=name_a,
            name_b=name_b,
            expected=expected,
            predicted=result["is_match"],
            confidence=result["confidence"],
            method=result["method"],
            similarity=result["similarity"],
            cache_hit=result["cache_hit"],
            latency_ms=latency_ms,
        )
        results.append(pr)

        if verbose:
            status = "✓" if pr.correct else "✗"
            print(
                f"  {status} [{result['method']:<16}] "
                f"sim={result['similarity']:.2f} conf={result['confidence']:.2f} "
                f"| {name_a[:35]!r:<37} vs {name_b[:35]!r:<37} "
                f"→ pred={'MATCH' if pr.predicted else 'NO   '} "
                f"exp={'MATCH' if expected else 'NO   '}"
            )

    report = EvalReport()
    report.compute(results)
    return report


def print_report(report: EvalReport) -> None:
    """Pretty-print the evaluation report to stdout."""
    sep = "─" * 60
    print(f"\n{sep}")
    print("  flyrr Semantic Matcher — Evaluation Report")
    print(sep)
    print(f"  Total pairs evaluated : {report.total}")
    print(f"  Correct predictions   : {report.correct} / {report.total}")
    print()
    print(f"  Accuracy   : {report.accuracy:.1%}")
    print(f"  Precision  : {report.precision:.1%}")
    print(f"  Recall     : {report.recall:.1%}")
    print(f"  F1 Score   : {report.f1:.1%}")
    print()
    print("  Confusion Matrix:")
    print(f"    TP={report.tp}  FP={report.fp}")
    print(f"    FN={report.fn}  TN={report.tn}")
    print()
    print(f"  Avg latency  : {report.avg_latency_ms:.1f} ms")
    print(f"  p95 latency  : {report.p95_latency_ms:.1f} ms")
    print(f"  Cache hit rate  : {report.cache_hit_rate:.1%}")
    print(f"  Claude call rate: {report.claude_call_rate:.1%}")
    print()
    print("  Method breakdown:")
    for method, count in sorted(report.method_breakdown.items(), key=lambda x: -x[1]):
        pct = count / report.total * 100
        print(f"    {method:<20} {count:>4}  ({pct:.0f}%)")
    print(sep)


def load_csv_pairs(csv_path: str) -> List[dict]:
    """Load labelled pairs from a CSV with columns: name_a, name_b, expected_match."""
    pairs = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            expected_raw = row.get("expected_match", row.get("expected", "")).strip().lower()
            expected = expected_raw in ("true", "1", "yes", "match")
            pairs.append({
                "name_a": row["name_a"].strip(),
                "name_b": row["name_b"].strip(),
                "expected": expected,
            })
    return pairs


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate the flyrr semantic product matcher."
    )
    parser.add_argument(
        "--csv", metavar="FILE",
        help="Path to a CSV file with columns: name_a, name_b, expected_match",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Print per-pair results",
    )
    parser.add_argument(
        "--output", "-o", metavar="FILE",
        help="Write full results to a JSON file",
    )
    args = parser.parse_args()

    if args.csv:
        pairs = load_csv_pairs(args.csv)
        print(f"Loaded {len(pairs)} pairs from {args.csv}")
    else:
        pairs = LABELLED_PAIRS
        print(f"Running against {len(pairs)} built-in labelled pairs…")

    if args.verbose:
        print()

    report = run_evaluation(pairs, verbose=args.verbose)
    print_report(report)

    if args.output:
        out_path = Path(args.output)
        out_path.write_text(json.dumps(asdict(report), indent=2))
        print(f"\nResults saved to {out_path}")

    # Exit with non-zero code if accuracy is below 80%
    if report.accuracy < 0.80:
        print(f"\nWARNING: Accuracy {report.accuracy:.1%} is below the 80% threshold.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
