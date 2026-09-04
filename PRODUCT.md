# flyrr — Product Context

Durable product truth. Implementation churns; this shouldn't. Update it when the
product changes, not when the code does.

## What it is

A Canadian grocery **price-comparison and deal-finding** tool. You tell flyrr
where you are, it reads this week's flyer deals from retailers near you, and it
answers two questions: *what's actually on sale near me right now*, and *which
single store is cheapest for my whole list*.

**flyrr is not a store.** There is no checkout, no payment, no cart you buy from,
no delivery, no fulfillment, no inventory. The purchase happens in real life, at
a real store, by the user. Every screen exists to get someone out the door with a
cheaper basket. Treat any drift toward delivery-app patterns (order tracking,
payment methods, ETAs, "buy now") as a misread of the product.

## Who it's for

Canadian household shoppers who plan a weekly grocery run and feel food
inflation. They already know how to shop; they don't know which store is cheapest
*this week* without checking several flyers by hand. They are price-motivated,
mildly time-poor, and mostly on a phone — often standing in a kitchen planning,
or in a store aisle executing.

Two distinct moments, both first-class:
- **Planning at home** — browsing deals, building a list, comparing stores.
- **Executing in the aisle** — one-handed, glanceable, checking items off.

## The core loop

1. **Set location.** A postal code is the key to everything — no deals, no
   prices, no search results without one. Captured on first run.
2. **Discover.** Browse the nearby-deals feed (best advertised flyer specials
   near you), or search for a specific item.
3. **Compare.** Search results group the *same product across different stores*
   so per-item price differences are visible at a glance.
4. **Collect.** Add items to a list.
5. **Decide.** flyrr computes the cheapest single store for the whole list, and
   also the theoretical floor if you split the trip across stores.
6. **Shop.** An in-store checklist for the actual trip.
7. **Bank it.** Completing a trip records what was saved; savings accumulate over
   time.
8. **Wait for a drop.** Price alerts watch named products against a target price
   and notify when a deal lands.

Steps 2–6 are the spine. 7 and 8 are what bring people back.

## Product truths that shape design

- **Location gates everything.** A user with no postal code can see nothing
  useful. First-run location capture is non-dismissible for that reason; changing
  it later must be reachable from anywhere.
- **The data is weekly flyer advertising, not live shelf prices.** Deals expire.
  Prices are "as advertised," not guaranteed at the till. Never imply real-time
  accuracy or stock levels.
- **The source data is messy and third-party.** Names are inconsistent across
  retailers ("18% Table Cream" vs "Cream 18%"), images and store logos are often
  missing, and unrelated goods leak into grocery results. Every surface must
  survive missing images, absurd names, and irrelevant matches without looking
  broken.
- **Queries are genuinely ambiguous.** "Cream" legitimately means dairy cream,
  ice cream, face cream, and a cream-coloured handbag. The product's answer is to
  keep results broad and let the user narrow by category — never to silently
  guess.
- **Cross-store matching is probabilistic.** Grouping identical products across
  retailers is done by semantic matching, so it can be wrong. Show confidence
  where it matters; never present a match as certain fact.
- **Savings are the unit of value.** Dollars saved is the number this product is
  judged by. It should be visible, concrete, and cumulative — not buried.
- **No accounts.** No login, no profile, no sync. State lives in the browser.
  Losing it is annoying but not catastrophic; never build a flow that assumes
  identity or cross-device continuity.
- **Money and scarcity are the emotional register.** Discounts, expiry, "best
  price" — these are the moments worth designing. Everything else recedes.

## Scope boundaries

**In scope:** discovery, comparison, list-building, in-store execution, savings
tracking, price watching.

**Out of scope** (say so rather than building it): purchasing, payment, delivery,
loyalty-card integration, coupon clipping, user accounts, social/sharing,
inventory or stock levels, non-Canadian locales.

## Platform and surfaces

- **The product is the web app** (`web/`) — a React SPA, phone-first, but it must
  hold up in a desktop browser too. Mode: **Operate**. Task completion,
  scanability and one-handed use outrank expression; personality lives in the
  details.
- `frontend/` is an abandoned Expo/React Native port. **Not a product surface.**
  Don't design for it or keep it in sync.
- `backend/` is a FastAPI service over the Flipp flyer feed plus a semantic
  product matcher and a background price-alert poller. Design constraint: search
  is a slow network call that fans out, so *waiting is a normal state*, not an
  edge case.

## Locale and formatting

Canada. Canadian postal codes (`L4W 3H8`), CAD, `$` prefix, two decimals.
English. Retailer names are proper nouns — never re-case or abbreviate them.

## Voice

Plain, concrete, quietly confident. Numbers over adjectives: "Save $4.20 at
Metro" beats "Great savings available!" Never hype a deal the data doesn't
support, never fake urgency, never exclaim. When flyrr doesn't know something —
an ambiguous query, a failed match, an expired deal — it says so plainly and
offers the next move.

## What "good" looks like here

A user opens flyrr on their phone, sees what's genuinely worth buying near them
this week, builds a list in under a minute, learns which store to drive to, and
walks out having spent measurably less. If a design decision doesn't serve that
sentence, it's decoration.
