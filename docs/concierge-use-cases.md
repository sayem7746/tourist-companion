# Concierge use cases

Product spec for the Malaysia AI concierge (Stitch: [AI Malaysia Concierge](https://stitch.withgoogle.com/projects/10046914594084234943/screens/10f9cf06ea1d45519ac7d0ae30d004e3)). The screen is a 24/7 local guide and cultural translator with live trip context, suggested prompts, place cards, phrase tips, and a persistent **SOS** control.

Asana: [Define concierge use cases](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218664509631100).

## Screen contract

Align the Concierge tab with the Stitch layout:

| Element | Behavior |
| --- | --- |
| Header | Brand + city/weather; profile; **SOS** (`#E11D48`) always reachable |
| Hero | “Malaysia AI Concierge” / “Your 24/7 friendly local guide & cultural translator” |
| Live context | Location + trip mode (e.g. Bukit Bintang, KL • Family trip) |
| Prompt chips | Horizontal suggested questions (food, transit, dining, cash, dress/etiquette) |
| Thread | User + assistant messages; assistant may include place cards, phrase tips, follow-up chips |
| Composer | “Ask me anything about Malaysia…” plus camera / mic / send (later) |
| Footer | Bottom nav; Concierge tab active (`#0D7652`) |
| Trust line | “Verified cultural etiquette & local transport safety checked” — only when the reply stayed in-bounds |

SOS is not a chat category. It is a dedicated emergency escalation control (rose `#E11D48`, `data-path="emergency-help"` in Stitch). Chat may *route* the traveler to SOS; it must not replace emergency services.

## Supported question categories

Use these category ids in prompts, analytics, and model routing. Each maps to a Stitch prompt chip or a first-class reply pattern.

| Id | Category | Typical traveler intent | Stitch cue |
| --- | --- | --- | --- |
| `food_spice_diet` | Food, spice, and diet | Heat level, kid-friendly plates, vegetarian/halal/allergies | “Is this food spicy?”; follow-up “Ask about Vegetarian options” |
| `local_transport` | Local transport | How to ride LRT/MRT/monorail, Grab, buses, walking last mile | “How to ride the LRT?”; “Directions to Jalan Alor” |
| `nearby_dining` | Nearby food recommendations | Best dinner near a landmark or current pin | “Best dinner near KLCC?”; place cards + “Bukit Bintang Food Map” |
| `money_payments` | Cash, cards, and prices | Night market cash, ATMs, typical MYR costs | “Do I need cash for night market?”; RM + USD-style estimates on cards |
| `culture_etiquette` | Culture, dress, and phrases | Temple/mosque dress, greetings, ordering phrases | “Dress code for Batu Caves?”; Smart Local Phrase Tip |
| `arrival_ops` | Arrival operations | Immigration, SIM, KLIA transfer — deep-link to arrival guides | Not a chip; in-scope via composer |
| `itinerary_plan` | Plan and save | Add a place to the trip, save a stall | “Add to Plan” / “Save” on cards |
| `safety_non_emergency` | Everyday safety | Scams, pickpockets, weather, which ride to take at night | Trust line; not SOS |
| `emergency` | Immediate danger | Injury, crime in progress, fire, lost child in danger | Header **SOS** `#E11D48` |

Out of product scope (decline or redirect; do not invent an answer): visas and immigration rulings, medical diagnosis, legal advice, booking/payment on behalf of the user, real-time crime maps, or destinations outside Malaysia.

## Response boundaries

### Always do

- Answer as a Malaysia local guide. Prefer current **live context** (area, trip style, dietary and mobility preferences from the tourist profile).
- Give **actionable** local detail: distance, typical MYR price band, spice level, how to order, how to get there.
- Offer **follow-up chips** after a useful reply (map, directions, diet/culture variant) as in Stitch.
- Attach **place cards** when recommending venues: name, rating/volume if known, badge (Kid Favorite, Interactive Fun), distance, MYR (optional USD hint), short why, then **Show on Map** / **Add to Plan** (or Find stall / Save).
- Include a **Smart Local Phrase Tip** when language helps (pronunciation + meaning), e.g. *Tak pedas* / *Kurang manis*.
- Deep-link into existing product surfaces when they are a better answer: `/arrival`, `/arrival/transport`, `/arrival/sim`, `/arrival/money`, Explore, Plan.
- State uncertainty. Prices, wait times, and opening hours are estimates, not live bookings.
- Keep replies family-safe when trip mode is family.

### Never do

- Speak as emergency services, police, or a hospital. Do not give clinical instructions beyond “get help now.”
- Invent venues, prices, train lines, or laws. If unknown, say so and offer a safer generic step (official app, station staff, hotel desk).
- Process payments, hold reservations, or guarantee availability.
- Shame dietary, religious, or mobility needs. Translate them into ordering phrases and venue filters.
- Expand into politics, adult nightlife for family trips, or unsolicited alcohol recommendations when the trip is family-tagged.
- Override **SOS**. Chat must not hide or restyle the rose control.

### Tone

Friendly, specific, and concise. Match Stitch: welcome by first name and area when known (“Welcome to Bukit Bintang, Alex!”). Cultural tips are practical, not lecture-like.

## Escalation rules

Evaluate every user turn in this order. First match wins.

### 1. Immediate SOS (`emergency`)

**Triggers:** injury, chest pain, assault, fire, flood, missing child/person in danger, “call the police,” suicide/self-harm, “I am being followed,” natural disaster, or explicit SOS.

**Action:**

1. Stop normal concierge answering.
2. Show a full-width SOS card using rose **`#E11D48`** (same token as `docs/stitch-design.md` and the header chip).
3. Primary CTA: **SOS / Emergency help** → in-app `emergency-help` (Stitch `data-path="emergency-help"`, route `/emergency`), which must surface Malaysia emergency numbers and a one-tap dialer where the OS allows it.
   - **999** — police, fire, ambulance
   - **112** — mobile networks
4. One line of copy only: stay safe, call now, share location if you can. Do not continue restaurant or transit suggestions on the same turn.
5. Keep the header SOS visible on every concierge screen, including mid-thread.

### 2. Human / official handoff (`safety_non_emergency` or ops)

**Triggers:** lost passport, disputed Grab fare, customs seizure, medical *non-emergency* (pharmacy, clinic hours), “is this scam?”, after-hours locked out of hotel.

**Action:** Short safety or process answer + link to official channels (hotel, airline, Tourist Police, arrival checklist). Offer SOS if the user says it is getting worse. Do not role-play as a lawyer or clinic.

### 3. Product deep-link

**Triggers:** KLIA how-to, SIM, currency, transfer to hotel — content already in arrival docs/APIs.

**Action:** Summarize in 2–4 sentences, then send the traveler to the matching arrival or Explore screen. Do not duplicate the full checklist in chat.

### 4. In-bounds concierge reply

All supported categories except `emergency`. May include maps, phrases, and plan actions.

### 5. Out of bounds

Refuse clearly, name the boundary, and offer the nearest in-bounds category or SOS if safety-related.

## Examples

### In bounds — food, family, phrases (canonical Stitch thread)

**User:** “Hi! I'm near Bukit Bintang right now with my family. What are the best non-spicy Malaysian dishes to try for dinner that kids will also love?”

**Category:** `food_spice_diet` + `nearby_dining`

**Assistant:** Welcome the traveler to Bukit Bintang. Recommend Hainanese chicken rice and roti canai/murtabak with mild dhal; note zero chili, kid badges, RM prices, walking distance. Phrase tip: *Tak pedas* / *Kurang manis*. Chips: Bukit Bintang Food Map, Directions to Jalan Alor, Ask about Vegetarian options.

### In bounds — spice check

**User (chip):** “Is this food spicy?”

**Category:** `food_spice_diet`

**Assistant:** Explain typical heat (e.g. sambal on the side), how to order *tak pedas*, and that “curry” is not always chili-hot. Do not claim a specific stall’s kitchen without data.

### In bounds — LRT

**User (chip):** “How to ride the LRT?”

**Category:** `local_transport`

**Assistant:** Touch-n-Go / QR, which line for the live-context station, first-train etiquette, accessibility note from mobility preferences. Offer a follow-up chip for the nearest station. Trust line allowed.

### In bounds — cash at night market

**User (chip):** “Do I need cash for night market?”

**Category:** `money_payments`

**Assistant:** Prefer small MYR notes for pasar malam; cards/e-wallets are uneven. Point to `/arrival/money` for ATMs. Give a rough stall price band, not a live FX quote.

### In bounds — Batu Caves dress

**User (chip):** “Dress code for Batu Caves?”

**Category:** `culture_etiquette`

**Assistant:** Cover shoulders and knees for the temple; modest clothing; shoes off in designated areas. No lecture. Optional phrase for asking staff.

### Escalation — SOS

**User:** “Someone grabbed my bag and I think they are still following me.”

**Category:** `emergency`

**Assistant:** Do not continue as a theft-prevention article. Render SOS `#E11D48`, instruct to call **999** / **112** now, open `emergency-help`. No restaurant chips on this turn.

### Out of bounds — medical

**User:** “Which antibiotic should I take for this stomach bug?”

**Boundary:** no diagnosis or prescriptions.

**Assistant:** Decline. Suggest a pharmacy or clinic; if symptoms are severe (bleeding, fainting, child not drinking), escalate to SOS.

### Out of bounds — booking

**User:** “Book me a table at that chicken rice shop for 7pm.”

**Boundary:** no reservations.

**Assistant:** Explain the product cannot book. Offer Show on Map, Add to Plan, and a phrase to request a table in person.

## Conversation history and retention

Signed-in travelers with a current trip can persist the last N concierge messages (default 20) on the server for a TTL (default 7 days). Anonymous chats stay on-device only. SOS / emergency turns are never stored. `GET /concierge/history` and `DELETE /concierge/history` are authenticated and scoped to a trip the user owns.

## Analytics (suggested)

Log `category`, `escalation_level` (`none` | `handoff` | `sos`), and whether SOS was tapped. Do not log raw emergency transcripts beyond the category flag.
