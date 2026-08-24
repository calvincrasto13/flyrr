"""
deals.py — nearby flyer-deal aggregation

The Flipp search endpoint returns two parallel arrays: ``ecom_items`` (online
listings, no discount metadata) and ``items`` (printed flyer items, which DO
carry ``original_price`` / ``sale_story`` / ``valid_to``). The deals feed is
built from the latter — those are the actual advertised specials.

Deliberately free of MongoDB and the semantic-matching pipeline so it can be
imported by both the full server and the lightweight dev harness.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

FLIPP_SEARCH_URL = "https://backflipp.wishabi.com/flipp/items/search"

# Staple categories fanned out to build the "nearby deals" feed. Broad enough
# to cover a typical basket without making the feed feel arbitrary.
DEFAULT_DEAL_CATEGORIES: List[str] = [
    "milk",
    "eggs",
    "bread",
    "chicken",
    "cheese",
    "coffee",
    "produce",
    "pasta",
]

REQUEST_TIMEOUT = 10


def _to_float(value: Any) -> Optional[float]:
    """Flipp mixes ints, floats, numeric strings and nulls in price fields."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_flyer_item(raw: Dict[str, Any], category: str) -> Optional[Dict[str, Any]]:
    """
    Map one raw Flipp flyer item to the shape the web client consumes.

    Returns ``None`` for items without a usable price, or without any evidence
    of an actual discount (no cheaper-than-original price and no sale story) —
    a "deals" feed full of regular-price items would be dishonest.
    """
    current_price = _to_float(raw.get("current_price"))
    if current_price is None or current_price <= 0:
        return None

    original_price = _to_float(raw.get("original_price"))
    sale_story = (raw.get("sale_story") or "").strip()

    has_price_drop = original_price is not None and original_price > current_price
    if not has_price_drop and not sale_story:
        return None

    savings = round(original_price - current_price, 2) if has_price_drop else 0.0
    discount_percent = (
        round((savings / original_price) * 100) if has_price_drop and original_price else 0
    )

    return {
        "id": str(raw.get("flyer_item_id") or raw.get("id") or ""),
        "global_id": str(raw.get("flyer_item_id") or raw.get("id") or ""),
        "name": raw.get("name") or "",
        "merchant": raw.get("merchant_name") or "",
        "merchant_id": raw.get("merchant_id") or 0,
        "merchant_logo": raw.get("merchant_logo") or "",
        "current_price": current_price,
        "original_price": original_price,
        "savings": savings,
        "discount_percent": discount_percent,
        "sale_story": sale_story,
        "image_url": raw.get("clean_image_url") or raw.get("clipping_image_url") or "",
        "valid_to": raw.get("valid_to"),
        "category": category,
    }


def _fetch_category(category: str, postal_code: str) -> List[Dict[str, Any]]:
    """Fetch and normalize the flyer deals for a single category term."""
    try:
        response = requests.get(
            FLIPP_SEARCH_URL,
            params={"locale": "en-ca", "postal_code": postal_code, "q": category},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        raw_items = response.json().get("items", [])
    except Exception as exc:  # network flake on one category shouldn't kill the feed
        logger.warning("Deals fetch failed for category %r: %s", category, exc)
        return []

    deals = (_normalize_flyer_item(item, category) for item in raw_items)
    return [deal for deal in deals if deal is not None]


def fetch_nearby_deals(
    postal_code: str,
    categories: Optional[List[str]] = None,
    limit: int = 24,
) -> Dict[str, Any]:
    """
    Fan out across staple categories in parallel and return the best deals.

    Results are de-duplicated on (name, merchant, price) because the same flyer
    item routinely surfaces under several category queries, and because banner
    families (FreshCo / Chalo FreshCo) republish identical entries.
    """
    categories = categories or DEFAULT_DEAL_CATEGORIES

    collected: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(8, len(categories))) as pool:
        futures = {
            pool.submit(_fetch_category, category, postal_code): category
            for category in categories
        }
        for future in as_completed(futures):
            collected.extend(future.result())

    seen: set = set()
    unique: List[Dict[str, Any]] = []
    for deal in collected:
        key = (deal["name"].strip().lower(), deal["merchant"].strip().lower(), deal["current_price"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(deal)

    # Real dollar savings first, then percentage, then cheapest — items whose
    # only discount evidence is a sale story sort last but still appear.
    unique.sort(
        key=lambda d: (-d["savings"], -d["discount_percent"], d["current_price"])
    )

    top = unique[:limit]
    merchants = sorted({d["merchant"] for d in top if d["merchant"]})

    return {
        "deals": top,
        "total_found": len(unique),
        "categories": categories,
        "merchants": merchants,
    }
