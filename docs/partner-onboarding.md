# Partner onboarding (ops)

Operational checklist for putting a Malaysia marketplace partner live: verify the business, agree terms, record contacts, and lock payout arrangements **before** `POST /admin/partners/:id/approve`.

Asana: [Define partner onboarding process](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218661691725071) (EPIC 07 — Referral Marketplace).

Product fields, traveler disclosure, and category rules: `docs/partner-categories.md`. Shared contract: `Provider`, `PartnerListing`, `PartnerCommission` in `shared/types/index.ts`. Admin listing CRUD: `/admin/partners` (`ADMIN_TOKEN` or JWT `role: admin`). Ops sign in at Angular `/admin/login` and manage listings at `/admin/partners`.

New partners stay **inactive** until this checklist is complete. Inactive rows never appear on traveler CTAs. Contact email and commission stay on the ops `Provider` view only — never on `GET /partners`.

## Goal

An ops owner can take a candidate from intake to an approved listing without inventing licenses, ratings, or payout facts, and without exposing partner ops data to travelers.

## Roles

| Role | Owns |
| --- | --- |
| Partner ops | Intake packet, verification evidence, listing copy, go-live / pause |
| Partner (counterparty) | Signed terms, conversion reports, payout destination, license proofs |
| Admin API | Create inactive `providers` row, patch fields, `approve` / `pause` |

Ops sign in at `/admin/login` (JWT `role: admin`) and manage listings at Angular `/admin/partners`. There is no in-app payout report in MVP. Record contract and bank details in the signed agreement (and ops vault), not in tourist APIs.

## Stages

Work the stages in order. Do not skip to go-live because the listing copy looks ready.

1. **Intake** — collect identity, category, URLs, contacts, and proposed commission.
2. **Business information** — prove the legal entity, licenses, and listing facts.
3. **Terms** — signed commercial relationship, disclosure, attribution, conversion rules.
4. **Contact details** — ops and billing people we can actually reach.
5. **Payout arrangements** — MYR rate, basis, destination account, conversion evidence.
6. **Listing record** — create the inactive `providers` row and fill required fields.
7. **Go-live** — approve only when the gate below is green.
8. **After go-live** — pause instead of delete; re-verify on material change.

## Intake packet

Collect before creating a database row. Prefer a written form or email thread that ops can file with the contract.

| Item | Required | Notes |
| --- | --- | --- |
| Legal name | yes | Matches SSM / registration, not only the brand on the card |
| Trading / brand name | yes | Becomes `Provider.name` |
| Proposed `category` | yes | One of the six MVP ids — not `insurance` or `other` |
| Malaysia operating city / area | yes | `listing.city` / `listing.area`; Malaysia only |
| Public website | yes | HTTPS; may differ from the booking URL |
| Outbound booking URL | yes if travelers will click out | HTTPS `bookingUrl` (or `reservationUrl` for restaurants) |
| Ops contact email | yes | Stored as `contactEmail`; never shown in the tourist app |
| Billing / payout contact | yes | May be a different person than day-to-day ops |
| Proposed commission | yes | Rate (0–1), basis, and what qualifies |
| License name + id | when legally required | See category table; omit rather than guess |
| Sponsored placement? | yes | `listing.sponsored` true only when paid placement is in the contract |

Reject at intake (do not create a row): travel insurance, catch-all “other”, destinations outside Malaysia, businesses that want in-app checkout or SOS placement, or anyone asking to hide the referral disclosure.

## 1. Business information

Verify identity and listing facts against public records and the partner’s own documents. Do not copy marketing claims into `listing.summary`.

### Identity

- [ ] Legal entity exists (SSM search or equivalent registration extract).
- [ ] Trading name on the card matches the entity or a documented DBA.
- [ ] Unique kebab-case `slug` (or let the admin API derive it from the name).
- [ ] Category is one of `hotels`, `transfers`, `tours`, `sim`, `restaurants`, `tourist_services`.
- [ ] City / area is a real Malaysia location the partner actually serves.
- [ ] `website` is HTTPS and loads as that business (not a parked domain or unrelated brand).
- [ ] Outbound URL is HTTPS and is the partner’s (or official) booking / reservation page — not an open redirect or third-party scraper.
- [ ] Summary is one or two sentences, no invented star ratings, occupancy, or “official Tourism Malaysia” wording unless that is documented.

### Category licenses and claims

`licenseName` / `licenseId` are required when the category legally needs them; leave them empty rather than inventing a number.

| Category | Must verify | Must not approve if |
| --- | --- | --- |
| `hotels` | Licensed lodging (hotel / serviced apartment / licensed guesthouse). `hotelClassHint` is a hint only. | Unlicensed stay, fake availability, or star rating we cannot source |
| `transfers` | Licensed e-hail / private-hire where claimed; airport codes are `KUL` and/or `KLIA2` only; distinguish official rail/bus from affiliate cars | Street touts, unlicensed airport pickup, or replacing SOS |
| `tours` | Meeting point and that tickets are sold by this partner; duration hint is descriptive | Guaranteed skip-the-queue or entry the partner cannot provide |
| `sim` | Telco / reseller agreement; `connectivityKind`, data, validity, passport/device limits when known | “Visa SIM”, immigration advice, or a telco brand with no contract |
| `restaurants` | `halal` only when certified or clearly marked; reservation URL HTTPS | Holding tables, taking deposits, or unmarked halal claims |
| `tourist_services` | Desk hours and languages; commercial luggage/help vs official visitor centre | Implying government endorsement for a commercial desk |

### Record in the `providers` row

| Field | Ops rule |
| --- | --- |
| `name` / `slug` / `category` | From verified identity |
| `website` | Public site |
| `listing.summary` | Verified copy; required before approve |
| `listing.bookingUrl` / `reservationUrl` | HTTPS outbound only |
| `listing.city` / `listing.area` / extras | Category extras from `docs/partner-categories.md` |
| `listing.licenseName` / `licenseId` | Only when verified |
| `listing.sponsored` | True only if paid placement is in the signed terms |
| `listing.disclosure` | Default `REFERRAL_DISCLOSURE` unless legal supplied equivalent language that still states a commercial relationship |

## 2. Terms

A signed (or otherwise executed) commercial agreement is required before approve. The app does not store the contract; keep the file with the ops record and put the operational fields on `providers`.

- [ ] Counterparty legal name matches the SSM / registration extract.
- [ ] Scope is referral / affiliate only: the app never books or charges travelers.
- [ ] Traveler disclosure is agreed. Default copy: *We may earn a commission if you book or buy through this link.* It must appear next to every referral CTA (organic and sponsored).
- [ ] Sponsored badge (`Sponsored`, gold chip) is allowed only when the contract includes paid placement.
- [ ] Attribution window is written (when a click/lead can still convert). The API has `expired` status; MVP does not auto-expire — ops still needs a contract window for disputes.
- [ ] Qualifying conversion is defined per basis (`booking`, `activation`, or `click`). The app must not mark `converted` from a click or lead alone.
- [ ] Partner (or later webhook) reports conversions; ops records them with admin `POST /referrals/bookings` (`referralId` or `referralCode`).
- [ ] Tracking URLs may append `ref` and UTM; the partner will not strip them as a condition of paying.
- [ ] Partner will not ask us to hide disclosure, attach CTAs to SOS / emergency / immigration rulings, or present the listing as a government service.
- [ ] Cancellation / no-show / refund handling is the partner’s; listing copy must not promise app-side refunds.
- [ ] PDPA: partner ops contacts and commission are not trip content and will not be rendered in the tourist app.
- [ ] Term, termination, and pause: we may `POST /admin/partners/:id/pause` immediately if the listing is unsafe or the contract lapses.

Do not go live on a verbal rate or a slide deck.

## 3. Contact details

At least one reachable ops inbox is required. Store **one** ops email on the row (`contactEmail`). Keep extra people in the contract / ops vault.

| Contact | Required | Where it lives | Rules |
| --- | --- | --- | --- |
| Ops email | yes | `providers.contact_email` | Valid email; used for listing issues, conversion mismatches, pause notices. Never on tourist `GET /partners`. |
| Billing / payout contact | yes | Contract / ops vault | Person who confirms invoices and bank details. |
| Named account owner | yes | Contract / ops vault | Human we can call if the inbox bounces. |
| Public website | yes | `providers.website` | HTTPS; traveler-safe. |
| Booking / reservation URL | if outbound CTA | `listing.bookingUrl` or `reservationUrl` | HTTPS; this is what clicks 302 to. |

Checks:

- [ ] Ops email accepts mail from us (send a test; bounce = fail).
- [ ] Ops email is not a personal Gmail used only by a salesperson who has left, unless they are the documented owner.
- [ ] Website and booking hostnames are consistent with the verified brand (flag lookalike domains).
- [ ] No phone number, WhatsApp, or ops email is copied into `listing.summary` or traveler-facing disclosure.
- [ ] Concierge / Plan / Arrival copy will use the listing card + outbound link only — not a private ops number.

If `contactEmail` is missing, the listing may still be created inactive, but **do not approve**.

## 4. Payout arrangements

Payout reports and bank-account columns are **out of MVP engineering scope**. Ops still must agree how money moves before travelers can generate referrals.

### Commercial fields on `providers`

| Field | Meaning | Checklist |
| --- | --- | --- |
| `commission.rate` | Fraction 0–1 (`0.0500` = 5%), `NUMERIC(5, 4)` | Written in the contract; do not infer from `typicalMyr` |
| `commission.currency` | Always `MYR` | No other payout currency in MVP |
| `commission.basis` | `booking` / `activation` / `click` | Default: `activation` for `sim`, otherwise `booking`. Use `click` only when the contract is CPA-click |

### Destination and process (ops vault, not the tourist DB)

- [ ] Bank / e-wallet destination is in the signed agreement (account name matches the legal entity).
- [ ] Invoice cadence is agreed (e.g. monthly in arrears after confirmed conversions).
- [ ] Evidence for a payable conversion is agreed: partner booking id, activation id, or (CPA-click only) tracked click — matching `POST /referrals/bookings`.
- [ ] Disputes: clicks and leads in `GET /admin/referrals/analytics` are **not** an invoice. Analytics omits commission. Ops reconciles partner-reported conversions against those totals manually.
- [ ] Minimum payout / holdback (if any) is in the contract.
- [ ] Tax invoices (SST / whatever the entity uses) are the partner’s responsibility; we do not calculate tax in the app.
- [ ] No traveler-facing “you save X because we earn Y.”

If rate, basis, or destination is still “TBD”, leave `is_active` false.

## Listing record (admin API)

Create the row **inactive**. Fill fields, then approve. Angular ops: `/admin/partners` (list / approve / pause) and `/admin/partners/new` (create).

| Step | Method | Path |
| --- | --- | --- |
| Create (prefer `isActive: false`) | `POST` | `/admin/partners` |
| Correct copy, URLs, commission, contact | `PATCH` | `/admin/partners/:id` |
| Review ops view (includes contact + commission) | `GET` | `/admin/partners/:id` |
| Go-live | `POST` | `/admin/partners/:id/approve` |
| Take off traveler surfaces | `POST` | `/admin/partners/:id/pause` |

Rules the API already enforces:

- Active create requires a listing summary.
- URLs must be `https://`.
- `contactEmail` must be a valid email when present.
- Category must be one of the six MVP ids.
- Delete returns **409** when referrals still point at the row — **pause** instead.

After approve, smoke-check as a traveler would: listing appears on `GET /partners` (and category / city / airport filters if set), outbound click records a referral, disclosure is present, **Sponsored** badge matches the contract, and the JSON has no `contactEmail` or `commission`.

## Go-live gate

Approve only when every box is checked.

- [ ] Intake packet filed with the signed terms.
- [ ] Business identity and category licenses verified.
- [ ] Terms signed; disclosure and sponsored flag match the listing.
- [ ] Ops + billing contacts reachable; `contactEmail` set.
- [ ] Payout rate, basis (`MYR`), destination, and conversion evidence agreed.
- [ ] Inactive `providers` row complete: summary, HTTPS outbound URL, disclosure, commission, category extras.
- [ ] Not attached to SOS, emergency numbers, or visa/immigration advice.
- [ ] `POST /admin/partners/:id/approve` run by an admin; traveler listing spot-checked.

## After go-live

| Event | Action |
| --- | --- |
| Unsafe listing, lapsed license, or contract end | `POST /admin/partners/:id/pause` the same day |
| Rate, basis, or disclosure change | Patch the row **and** update the signed terms before travelers see the new copy |
| Booking URL change | Patch only after HTTPS + brand checks; existing `GET /r/:code` follows the stored URL |
| Conversion dispute | Compare partner evidence to `GET /admin/referrals/analytics?providerId=`; do not flip `converted` from a click |
| Partner asks to be removed | Pause; delete only if no referral rows remain |
| Material ownership / SSM change | Re-run identity + payout destination checks |

Existing referral codes for a paused partner still redirect; new clicks and leads return `404`. That is expected.

## Out of scope

Automated payout files, storing bank accounts on `providers`, insurance products, in-app checkout, auto-expiry of attribution windows, destinations outside Malaysia, and legal review of a specific contract’s wording (this checklist is operational; counsel still reviews the agreement).
