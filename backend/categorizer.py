"""
categorizer.py — product category classification for search disambiguation

A query like "cream" matches dairy cream, ice cream, skin cream, pain-relief
cream, cream-coloured rugs and a handbag called "Ice Cream & Shine". Flipp
returns no category metadata (its only facets are merchant and type), and
narrowing the *query* doesn't work either — Flipp does loose keyword matching,
so "cream dairy" returns ice cream and "whipping cream" returns nothing.

So the broad result set is kept (good recall) and each item is classified here,
letting the client offer "did you mean…" refinements that filter rather than
re-query.

Rules are evaluated in a fixed order and the first match wins. That ordering is
the whole trick:

  1. NON_GROCERY first  — "Ice Cream & Shine Bag" is a bag, not a dessert.
  2. HEALTH_BEAUTY next — "Ice Cream Detangler" is hair product, not dessert.
  3. FROZEN then        — now a bare "ice cream" is safely a dessert.
  4. DAIRY last of the  — leaving "table cream" / "18% cream" to dairy.
     cream-bearing rules

Deliberately keyword-based rather than ML: it is inspectable, instant, needs no
model download, and the vocabulary here is small and stable.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# ── Category display metadata ─────────────────────────────────────────────────

CATEGORY_LABELS: Dict[str, str] = {
    "dairy_eggs": "Dairy & Eggs",
    "frozen": "Frozen & Ice Cream",
    "bakery": "Bakery",
    "produce": "Fruit & Vegetables",
    "meat_seafood": "Meat & Seafood",
    "pantry": "Pantry",
    "beverages": "Drinks",
    "snacks": "Snacks & Sweets",
    "health_beauty": "Health & Beauty",
    "household": "Household",
    "baby": "Baby",
    "pet": "Pet",
    "non_grocery": "Not Groceries",
    "other": "Other",
}

# Order matters — see module docstring.
_RULES: List[Tuple[str, List[str]]] = [
    # ── 1. Non-grocery goods ──────────────────────────────────────────────
    # Flyer feeds mix in furniture, electronics and apparel. Caught first so
    # a colour or flavour word in the title can't misfile them.
    ("non_grocery", [
        r"\b(rug|carpet|mat|curtain|blind|cushion|pillow(?!case)?|duvet|comforter|bedding|mattress)\b",
        # "table" needs a guard — "table cream" and "table salt" are groceries.
        r"\b(sofa|couch|chair|stool|desk|dresser|shelf|shelving|cabinet|nightstand|bookcase)\b",
        r"\btable\b(?!\s*(cream|salt|water|wine|grape|syrup|d'?hote))",
        r"\b(tv|television|laptop|tablet|monitor|headphone|earbud|speaker|console|playstation|xbox)\b",
        r"\b(phone|smartphone|charger|cable|router|printer|camera)\b",
        r"\b(bag|handbag|backpack|purse|tote|wallet|luggage|suitcase)\b",
        r"\b(shoe|sneaker|boot|sandal|shirt|t-shirt|jean|pant|dress|jacket|coat|sock|hoodie|sweater)\b",
        r"\b(cookware|dinnerware|flatware|cutlery|utensil|saucepan|skillet|frying pan|bakeware)\b",
        r"\b\d+\s*-?\s*(piece|pc|pcs)\b.*\b(set|kit)\b",
        r"\b(paint|primer|varnish|stain)\b(?!.*\b(remover|nail)\b)",
        r"\b(lamp|light fixture|chandelier|bulb)\b",
        r"\b(toy|puzzle|lego|board game|plush|stuffed animal|teddy)\b",
        r"\b(tire|motor oil|windshield)\b",
    ]),

    # ── 1b. Cleaning soaps ────────────────────────────────────────────────
    # Claimed before the generic \bsoap\b toiletries rule below, which would
    # otherwise file dish and laundry soap under Health & Beauty.
    ("household", [
        r"\b(dish|dishwashing|dishwasher|laundry|hand[- ]?wash(ing)?)\s+(soap|liquid|detergent)\b",
        r"\bsoap\b.*\b(dish|laundry|cleaning|degreas)\b",
    ]),

    # ── 2. Health, beauty & pharmacy ──────────────────────────────────────
    # Runs before frozen/dairy so "hand cream" and "Ice Cream Detangler"
    # never reach the dessert or dairy rules.
    ("health_beauty", [
        r"\b(hand|face|facial|body|skin|foot|feet|night|day|eye|anti-?aging|wrinkle)\s+cream\b",
        r"\bcream\b.*\b(skin|dermat|eczema|psoriasis|moisturi[sz]|urea|glycerine|glycerin)\b",
        r"\b(skin|dermat|eczema|psoriasis|moisturi[sz]|urea|glycerine|glycerin)\b.*\bcream\b",
        r"\b(lotion|moisturi[sz]er|serum|toner|cleanser|exfoliant|micellar)\b",
        r"\b(shampoo|conditioner|detangler|hairspray|hair (colour|color|dye)|styling)\b",
        r"\b(makeup|make-up|cosmetic|mascara|lipstick|foundation|concealer|eyeliner|blush|nail polish)\b",
        r"\b(sunscreen|spf\s*\d+|after ?sun)\b",
        r"\b(deodorant|antiperspirant|body wash|shower gel)\b",
        # Bare "soap" is a toiletry by this point — cleaning soaps were taken
        # by the household rule above, so "Olive Oil Soap" can't reach the
        # pantry oil/salt rules further down.
        r"\bsoap\b",
        r"\b(toothpaste|mouthwash|floss|toothbrush|denture)\b",
        r"\b(ointment|analgesic|pain relief|muscle rub|antibiotic cream|antifungal|hydrocortisone)\b",
        r"\b(ibuprofen|acetaminophen|aspirin|advil|tylenol|voltaren|polysporin)\b",
        r"\b(vitamin|supplement|probiotic|collagen|omega-?3|melatonin)\b",
        r"\b(razor|shaving|aftershave|wax strip)\b",
        r"\b(tampon|pad|menstrual|feminine)\b",
        r"\b(bandage|band-?aid|gauze|first aid)\b",
        r"\b(balm|salve|arnica|comfrey|traumaplant|topical|liniment|calamine)\b",
        r"\b(bruise|burn|scar|wound|blister|rash|chafing)\s+cream\b",
        r"\bcream\b.*\b(colou?r|dye|bleach|developer)\b",   # hair colour kits
        r"\b(hypoallergenic|fragrance[- ]free|dermatologist|non[- ]comedogenic|paraben)\b",
        # Skincare actives — these mark a "light cream" as K-beauty skincare
        # rather than the dairy product the name would otherwise suggest.
        r"\b(propolis|niacinamide|hyaluronic|centella|cica|retinol|ceramide|peptide|squalane)\b",
    ]),

    # ── 2b. Baked snacks ──────────────────────────────────────────────────
    # Sits above dairy so "Butter Cream Original Cracker" is read as the
    # cracker it is rather than as a dairy product.
    ("snacks", [
        r"\b(cracker|cookie|biscuit|wafer|pretzel|chips?|crisps)\b",
    ]),

    # ── 2c. Cream-named pantry goods ──────────────────────────────────────
    # "Cream of tartar" and "cream of mushroom soup" are shelf-stable pantry
    # items that would otherwise be swept up by the dairy cream rules.
    ("pantry", [
        r"\bcream of (tartar|wheat|mushroom|chicken|celery|tomato)\b",
        r"\b(coconut|oat|soy|almond|cashew)\s+cream\b",
        r"\bcreamed?\s+(corn|honey)\b",
    ]),

    # ── 3. Frozen & ice cream ─────────────────────────────────────────────
    ("frozen", [
        r"\bice ?cream\b",
        r"\b(gelato|sorbet|sherbet|frozen yogurt|froyo|popsicle|freezie)\b",
        r"\b(frozen)\b.*\b(pizza|meal|dinner|entree|vegetable|fruit|waffle|fries)\b",
        r"\b(ice cream )?(bar|sandwich|cone|cake)\b.*\bice ?cream\b",
        r"\bfrozen\b",
    ]),

    # ── 4. Dairy & eggs ───────────────────────────────────────────────────
    # Everything cream-ish left over after the three rules above.
    ("dairy_eggs", [
        r"\b(table|light|heavy|whipping|whipped|sour|double|single|clotted|thick)\s+cream\b",
        # A *leading* percentage is a reliable dairy fat signal ("18% Table
        # Cream"). A trailing one is not — "Urisec Cream 10%" is a urea skin
        # cream — so only the leading form is matched here, and trailing-%
        # products are left to fall through to the description pass.
        # Note: no \b after the %, since "%" and a following space are both
        # non-word characters and a boundary there can never match.
        r"\d+\s*%.*\bcream\b",
        r"\bcream\b.*\b(dairy|milk)\b",
        r"\b(organic|homogenized|pasteuri[sz]ed)\s+cream\b",
        r"\b(half[- ]and[- ]half|creamer)\b",
        r"\b(milk|butter(?!\s*(nut|scotch))|cheese|yogh?urt|egg|eggs)\b",
        r"\b(cheddar|mozzarella|parmesan|brie|feta|havarti|gouda|ricotta|cottage cheese)\b",
        r"\b(margarine|ghee|kefir|buttermilk)\b",
    ]),

    # ── 5. Everything else ────────────────────────────────────────────────
    ("bakery", [
        r"\b(bread|bun|bagel|baguette|croissant|muffin|donut|doughnut|pastry|scone)\b",
        r"\b(cake|pie|tart|brownie|cupcake)\b",
        r"\b(tortilla|pita|naan|wrap|roll)\b",
    ]),
    ("meat_seafood", [
        r"\b(chicken|beef|pork|lamb|veal|turkey|duck|bacon|ham|sausage|salami|pepperoni)\b",
        r"\b(steak|roast|ribs|wings|drumstick|ground (beef|pork|chicken|turkey))\b",
        r"\b(fish|salmon|tuna|cod|tilapia|halibut|shrimp|prawn|crab|lobster|scallop|mussel)\b",
        r"\b(deli meat|cold cut|hot dog|wiener)\b",
    ]),
    ("produce", [
        r"\b(apple|banana|orange|grape|berry|berries|strawberr|blueberr|raspberr|melon|mango|pear|peach|plum|kiwi|pineapple|avocado)\b",
        r"\b(lettuce|spinach|kale|broccoli|carrot|potato|tomato|onion|pepper|cucumber|celery|mushroom|zucchini|cabbage|cauliflower)\b",
        r"\b(fresh (fruit|vegetable|produce)|salad mix|herbs?)\b",
    ]),
    ("beverages", [
        r"\b(juice|soda|pop|cola|soft drink|energy drink|sports drink)\b",
        r"\b(coffee|espresso|k-?cup|tea|chai|matcha)\b",
        r"\b(water|sparkling water|seltzer)\b",
        r"\b(beer|wine|cider|vodka|whisk(e)?y|rum|gin|liqueur)\b",
    ]),
    ("snacks", [
        r"\b(chip|crisps|cracker|pretzel|popcorn|nuts|trail mix)\b",
        r"\b(cookie|biscuit|candy|chocolate|gum|granola bar|snack bar)\b",
    ]),
    ("pantry", [
        r"\b(pasta|spaghetti|noodle|rice|quinoa|couscous|lentil|bean)\b",
        r"\b(flour|sugar|baking (soda|powder)|yeast|cornstarch)\b",
        r"\b(oil|olive oil|vinegar|sauce|ketchup|mustard|mayo|mayonnaise|salsa|soy sauce)\b",
        r"\b(cereal|oatmeal|granola|soup|broth|stock|canned|tinned)\b",
        r"\b(peanut butter|jam|jelly|honey|syrup|spread)\b",
        r"\b(salt|pepper|spice|seasoning)\b",
    ]),
    ("household", [
        r"\b(detergent|fabric softener|bleach|cleaner|disinfectant|wipes)\b",
        r"\b(toilet paper|paper towel|tissue|napkin|garbage bag|trash bag)\b",
        r"\b(dish soap|dishwasher|laundry|sponge|scrub|scrubbing|scouring|descal)\b",
        r"\b(foil|plastic wrap|parchment|zip(loc)?k? bag|storage bag)\b",
        r"\b(air freshener|candle|batteries|battery)\b",
    ]),
    ("baby", [
        r"\b(diaper|nappy|baby (food|formula|wipe|lotion|shampoo)|infant|toddler)\b",
        r"\b(formula|pacifier|sippy)\b",
    ]),
    ("pet", [
        r"\b(dog|cat|puppy|kitten|pet)\s+(food|treat|litter|toy|shampoo|chew)\b",
        r"\b(kibble|cat litter)\b",
    ]),
]

# Pre-compile once — these run over every item of every search response.
_COMPILED: List[Tuple[str, List[re.Pattern]]] = [
    (category, [re.compile(p, re.IGNORECASE) for p in patterns])
    for category, patterns in _RULES
]


def categorize(name: str, description: str = "") -> str:
    """
    Classify one product into a category key.

    The name is weighted over the description: descriptions are marketing prose
    that routinely name-drop unrelated categories ("pairs well with ice cream"),
    so a name match is trusted outright and the description is only consulted
    when the name alone is inconclusive.
    """
    haystack_name = (name or "").lower()
    for category, patterns in _COMPILED:
        if any(p.search(haystack_name) for p in patterns):
            return category

    haystack_desc = (description or "").lower()[:300]
    if haystack_desc:
        for category, patterns in _COMPILED:
            if any(p.search(haystack_desc) for p in patterns):
                return category

    return "other"


def categorize_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Attach a ``category`` key to each item, in place, and return the list."""
    for item in items:
        item["category"] = categorize(item.get("name", ""), item.get("description", ""))
    return items


def build_category_facets(
    items: List[Dict[str, Any]],
    min_count: int = 2,
) -> List[Dict[str, Any]]:
    """
    Summarize the categories present in a result set, largest first.

    Categories below ``min_count`` are folded into "other" so the refinement
    chips stay scannable instead of turning into a long tail of ones.
    """
    counts: Dict[str, int] = {}
    for item in items:
        category = item.get("category", "other")
        counts[category] = counts.get(category, 0) + 1

    folded_other = 0
    facets: List[Dict[str, Any]] = []
    for category, count in counts.items():
        if category == "other" or count < min_count:
            folded_other += count
            continue
        facets.append({
            "key": category,
            "label": CATEGORY_LABELS.get(category, category.title()),
            "count": count,
        })

    facets.sort(key=lambda f: -f["count"])
    if folded_other:
        facets.append({
            "key": "other",
            "label": CATEGORY_LABELS["other"],
            "count": folded_other,
        })
    return facets


def is_ambiguous(facets: List[Dict[str, Any]], threshold: float = 0.15) -> bool:
    """
    True when the results genuinely straddle several categories.

    A query is treated as ambiguous when at least two categories each hold
    ``threshold`` of the results — that is what makes a refinement prompt
    worth showing. "milk" lands almost entirely in dairy and stays quiet;
    "cream" splits across dairy, frozen and beauty and gets prompted.
    """
    total = sum(f["count"] for f in facets)
    if total == 0:
        return False
    significant = [f for f in facets if f["key"] != "other" and f["count"] / total >= threshold]
    return len(significant) >= 2
