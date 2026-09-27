# LOCAZ Booking Platform — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | LOCAZ — self-service car & van rental platform (web app, admin back office, API) |
| **Prepared for** | Aziz LANDRI, LOCAZ |
| **Prepared by** | Shakil Khan |
| **Version** | 1.0 — for review |
| **Date** | 27 September 2026 |
| **Status** | Draft for validation — decisions requested in [Section 14](#14-decisions-needed-from-locaz) |

---

## 1. Summary

LOCAZ rents cars, vans and trucks in Nice on a self-service basis: customers book, sign, pay and pick up the vehicle without a counter. Until now the fleet and prices were managed in RentHub. That contract has ended, and RentHub was too complex for LOCAZ's needs and missing key payment features.

We will build **LOCAZ's own platform**, made of three parts:

1. **Booking website** (`booking.locaz.co`) — the customer picks dates, place and vehicle, sees the price instantly, adds options, and only then creates an account and pays.
2. **Admin back office** — for Aziz and his team to manage the fleet, prices, calendar, reservations, customers and company rules.
3. **API** — so the future LOCAZ mobile app and the vehicle devices (remote lock/unlock and GPS tracker) can connect to the same system.

The heavy, sensitive steps — **identity check, documents, contract, e-signature, payment, deposit, check-in/check-out photos and disputes** — are already built in **Contrazy**. LOCAZ will be **Contrazy's first client**: the booking platform hands each confirmed booking to Contrazy, and Contrazy reports back when each step is done. The customer never has to know Contrazy is involved.

This document is based on:
- our meeting of 28 August 2026 (full transcript reviewed);
- a complete read-only review of the LOCAZ RentHub account on 27 September 2026 (all ~110 admin screens, every price list, vehicle, model, service and setting), plus the public RentHub booking page tested with several dates and places;
- LOCAZ's published CGV (v3.0, March 2026), rental contract and privacy policy;
- the current Contrazy codebase.

The full RentHub data was exported the same day (see [Section 12](#12-data-migration-from-renthub)).

---

## 2. Goals

| Goal | How we measure it |
|---|---|
| Replace RentHub with a simpler tool LOCAZ fully owns | All daily operations run without RentHub |
| Let customers book 100% from their phone, 24/7 | A booking can be completed on mobile in under 5 minutes, without calling or WhatsApp |
| Show a correct, transparent price before any account is created | Price shown = price paid; no account needed to search and compare |
| Secure every rental (identity, contract, deposit, photos) | Every rental has verified ID + licence, a signed contract, a deposit, and pickup/return photos |
| Grow from ~10 to 30+ vehicles and to other French cities | Adding a city, place, category or vehicle needs no developer |
| Delegate work to a team | Staff can be invited with limited rights |
| Be ready for keyless rental and the mobile app | Devices and the mobile app plug into the documented API |

**Target:** pilot launch in Nice at the **beginning of 2027**.

---

## 3. Product boundary — who does what

```
                ┌───────────────────────────┐
  locaz.co ───▶ │  Landing page (existing)  │  SEO, marketing, FR / EN / IT
                └─────────────┬─────────────┘
                              │ "Book now" (dates first)
                              ▼
                ┌───────────────────────────┐        ┌──────────────────────────────┐
                │  LOCAZ BOOKING PLATFORM   │  API   │           CONTRAZY           │
                │  booking.locaz.co         │◀──────▶│  (LOCAZ = first vendor)       │
                │                           │        │                              │
                │ • Search & price engine   │        │ • Identity check (KYC)        │
                │ • Vehicle & options       │        │ • ID / licence / address docs │
                │ • Customer account        │        │ • Rental contract + e-sign    │
                │ • Admin back office       │        │ • Payment + deposit (Stripe)  │
                │ • Fleet calendar          │        │ • Check-in / check-out photos │
                │ • Public API              │        │ • Disputes & evidence         │
                └─────────────┬─────────────┘        └──────────────────────────────┘
                              │ API (Phase 3)
                              ▼
                ┌───────────────────────────┐        ┌──────────────────────────────┐
                │  Vehicle devices          │        │  LOCAZ mobile app (Phase 4)   │
                │ • Lock / unlock key box   │        │  built on the same API by a   │
                │ • GPS tracker (km, fuel)  │        │  mobile developer             │
                └───────────────────────────┘        └──────────────────────────────┘
```

| Area | Owner |
|---|---|
| Landing page, SEO, blog | Existing `locaz.co` static site (kept; "Book now" goes to the booking platform) |
| Search, price calculation, availability, options | **LOCAZ platform** (new) |
| Fleet, places, categories, prices, services, rules | **LOCAZ platform** admin (new) |
| Reservations, fleet calendar, customers, blacklist | **LOCAZ platform** admin (new) |
| Identity, documents, contract, signature | **Contrazy** (existing, small extensions) |
| Rental payment, deposit hold/capture/release | **Contrazy** via LOCAZ's Stripe account (existing) |
| Pickup/return photos, fuel and km readings | **Contrazy** check-in / check-out (existing) |
| Damage claims, fines, disputes | **Contrazy** disputes (existing) + LOCAZ penalty scale |
| Lock/unlock, GPS, mileage, fuel level | Device providers, connected through the LOCAZ API (Phase 3) |
| Native mobile app | Mobile developer, using the LOCAZ API (Phase 4) |

---

## 4. Users and roles

| Role | Who | Can do |
|---|---|---|
| **Super admin** | Aziz | Everything, including company settings, prices, users and payments |
| **Administrator** | Trusted manager | Everything except billing/Stripe settings and deleting data |
| **Operator** | Fleet staff | Reservations, calendar, pickups/returns, customers, vehicle status. No price or rule changes |
| **Operator assistant** | Support / cleaning / delivery staff | View calendar and reservations, record check-in/out, damages and vehicle status |
| **Customer** | Renter | Search, book, manage own bookings, documents, payments |

Roles match what LOCAZ asked for in the meeting ("Administrator, operator, assistant of operator — that's enough"). Staff are invited by email. Every action is recorded in an audit log. Staff can later be limited to one city or place group, for the national expansion.

---

## 5. What we keep from RentHub — priorities

RentHub has about 110 screens. Most were never used by LOCAZ. The table below lists every RentHub area and our decision, based on the meeting and on what was actually configured in the account.

**Priority key:** **P1** = needed for launch · **P2** = shortly after launch · **P3** = later / optional · **—** = not needed

### 5.1 Administration

| RentHub screen | What it is | Decision |
|---|---|---|
| Company data & configuration | Legal info, tax IDs, operating rules | **P1** — simplified company settings (Section 7.10) |
| Users / Teams | Staff accounts and groups | **P1** — users with 3 roles; teams **P3** |
| Blacklist | Reasons to block a customer (Smoker, Dirty, Fuel) with colours | **P1** |
| Document types | ID card, passport, proof of address (< 3 months) | **P1** — handled by Contrazy |
| Licence types | International licence / other | **P1** — handled by Contrazy |
| Opening hours (timetable) | Office hours per place | **P2** — self-service is 24/7; used only for staffed services (delivery) |
| Sources (origins) | App, signage, call, visit, campaigns | — ("we don't need it") — we only store *web / admin / app* automatically |
| IBAN | Bank accounts for invoices | — (Stripe payouts) |
| WhatsApp status | WhatsApp server link (not activated) | **P3** — WhatsApp notifications later |

### 5.2 Rental (reservations)

| RentHub screen | Decision |
|---|---|
| Reservations + fleet planning calendar | **P1** — the most important screen (Section 7.4) |
| Manual booking by phone / on site | **P1** |
| Disputes | **P1** — via Contrazy disputes |
| Cancellation reasons (mandatory) | **P1** |
| Unavailability reasons (maintenance, repair…) | **P1** |
| Pickup/return checklist | **P1** — via Contrazy check-in/out |
| Lead time (minimum notice before pickup, set to 60 min) | **P1** |
| Internal vehicle movements | **P2** |
| Review requests | **P3** |
| Reservation import, free-sale allocation, broker hooks | — |

### 5.3 Fleet

| RentHub screen | What LOCAZ has today | Decision |
|---|---|---|
| Place groups | 1 group: Nice | **P1** (one group per city, for expansion) |
| Places | Nice Gare, Nice Aéroport, Nice Ville, Nice Collinettes | **P1** |
| Brands | Renault, Iveco, Fiat, Mercedes, Toyota, Peugeot, Nissan | **P1** |
| Vehicle types | Car, Van, Truck | **P1** |
| Categories | 7 (Small / Medium / Large car; Small / Medium / Large van; Tipper truck) | **P1** — pricing is set per category |
| Models | 8 ("Renault Master or equivalent", etc.) | **P1** |
| Vehicles | 5 active vehicles with plate and mileage | **P1** |
| Additional services | Extra driver, baby seat, hand truck, delivery, 3 insurance levels | **P1** |
| Deductible & deposit rules | €1,500 deposit per model; deductibles €1,500 / €2,500 | **P1** |
| Damage markers | Scratch (X), Dent (O) | **P1** — used on the check-in/out car diagram |
| Vehicle expenses (washing, energy, service, insurance, tyres) | Cost types | **P2** |
| Deadlines (insurance, MOT, service dates) | Calendar of vehicle deadlines | **P2** ("we don't care for now"; useful reminders later) |
| GPS tracking map | Not connected | **P3** — replaced by our device integration (Phase 3) |
| Damage report templates, damage categories/fees | Case-by-case, not set up | — (use the CGV damage scale inside disputes) |
| Vehicle owners/suppliers, ACRISS codes, custom status 1–4, alarms | Empty | — |

### 5.4 Pricing

| RentHub screen | What LOCAZ has today | Decision |
|---|---|---|
| Price lists | Daily weekday, daily weekend, hourly weekday, hourly weekend | **P1** daily weekday/weekend · **P2** hourly |
| Rental rates per category | 1–6 day prices, km included, extra km | **P1** |
| Packages | Week (7 days, 700 km), Month (29–31 days, 3,000 km) | **P1** |
| Service prices | Daily or fixed price per category | **P1** |
| One-way (transfer) fees | €59 between places | **P1** |
| Dynamic pricing (seasons, demand) | Not set up ("I will set it up myself") | **P2** — simple rules the admin can manage |
| Advanced dynamic pricing (night rate, web discount…) | Not set up | **P3** |
| Coupons | None | **P2** |
| Damage fees | Not set up | — (CGV scale in disputes) |

### 5.5 Other RentHub modules

| Module | Decision |
|---|---|
| Customer database (contacts) | **P1** — customer list with documents, bookings, blacklist |
| Invoices | **P1** — simple invoice/receipt PDF per rental. Full accounting (cash book, fiscal archive, purchase invoices) — not needed |
| Payments / due dates | **P1** — handled by Contrazy + Stripe |
| Leads (CRM), marketing campaigns, message templates | **P3** |
| Upselling groups | **P3** |
| AI credits / document scanning | — |
| Car-sharing, online check-in, desk signature (not activated in RentHub) | Covered by our own booking flow + Contrazy |

---

## 6. Customer booking journey

The customer never creates an account before they have chosen a vehicle and seen the price. This keeps the site free to browse, and avoids empty accounts ("like e-commerce").

### 6.0 Today's RentHub booking page (reviewed 27 Sept 2026)

For reference, the current RentHub booking engine works like this:

1. **Search form**: pickup place, return place, type, category, minimum seats, dates and times (30-minute slots).
2. **Results**: one card per model with fuel, seats, gearbox, doors and air-con, the price list used, the total price, the km included and the extra km price. Packages appear as a separate "fixed price" card next to the daily price.
3. **One-page checkout**: options (extra driver, baby seat, delivery, protection), personal details (name, email, mobile, address), card details (Stripe), marketing opt-in, CGV and privacy checkboxes, coupon code, summary. Two buttons: "Confirm and pay online" or "Request a quote".

What we keep: the dates-first search, the clear result cards, and live option prices.

What we change:
- The customer gets a real account and verified identity, which RentHub does not do.
- The deposit and cancellation rules are shown before payment. Today the checkout never mentions the €1,500 deposit.
- The best price (package or daily) is chosen automatically, so two prices are never shown for the same car.
- The contract is signed before pickup.

### 6.1 Steps

| # | Step | What happens | Built in |
|---|---|---|---|
| 1 | **Search** | Pickup place, return place (default: same), pickup date & time, return date & time. Visible straight away on the landing page (sticky box while scrolling). | LOCAZ |
| 2 | **Results** | Available categories with photo, "Model or equivalent", seats, gearbox, fuel, volume (vans), km included, **total price** and price per day. Sorted by price. Unavailable vehicles shown greyed out. | LOCAZ |
| 3 | **Options** | Protection level (Standard included, Comfort, Zero deductible), extra driver, baby seat, hand truck, airport/station delivery. Price updates live. | LOCAZ |
| 4 | **Summary** | Full breakdown: rental, options, one-way fee, km included, extra km price, deposit amount, cancellation rules. Accept CGV. | LOCAZ |
| 5 | **Create account** | Email + phone (verified by code), or Google. Name, date of birth. Minimum age check. | LOCAZ |
| 6 | **Verification & contract** | Driving licence (front/back), ID or passport, selfie, proof of address if requested. Contract generated with booking details and signed on the phone. | **Contrazy** |
| 7 | **Payment** | Rental paid in full by card (3-D Secure). Deposit authorised on a card in the renter's name. | **Contrazy** (Stripe) |
| 8 | **Confirmation** | Booking confirmed by email (and later WhatsApp/SMS), with place, time and instructions. | LOCAZ |
| 9 | **Pickup** | Customer goes to the vehicle, does the pickup check (photos, fuel, km), then unlocks it (key box / app, Phase 3). | **Contrazy** check-in (+ devices) |
| 10 | **Return** | Return check (photos, fuel, km). Extra km, fuel and penalties are calculated. Deposit released or partially captured. | **Contrazy** check-out |

If verification or payment fails, the vehicle is held for a limited time (e.g. 30 minutes, adjustable) and then released.

### 6.2 Booking rules (from LOCAZ CGV v3.0)

| Rule | Value | Configurable |
|---|---|---|
| Minimum age | 21 years | Yes |
| Licence held for at least | 1 year per CGV (**the FAQ says 2 years — to confirm**) | Yes |
| Maximum rental length | 30 consecutive days | Yes |
| Book up to | 6 months in advance | Yes |
| Minimum notice before pickup | 60 minutes (RentHub setting) | Yes, per place/category |
| Simultaneous bookings per customer | 1 | Yes |
| Minimum booking price | €35 incl. VAT (RentHub setting) | Yes |
| Cancellation refund | > 24 h before: 100% · < 24 h: 50% · < 1 h: 0% · cancelled by LOCAZ: 100% · fraud/invalid documents: 0% | Yes |
| Extension | Requested in the app before the end; accepted only if the vehicle is free; paid immediately | Yes |

### 6.3 Customer account area

- Upcoming, current and past bookings; download contract and invoice.
- Request an extension, cancel (with the refund rule shown), add a driver.
- Saved documents (re-used for the next rental while valid).
- Language: French and English at launch (Italian as on the landing page — **P2**).

---

## 7. Functional requirements — LOCAZ platform

### 7.1 Price engine

Prices are set **per category, not per model**: a Renault Master and an Iveco Daily in "Large van" cost the same. This was agreed in the meeting and matches the RentHub setup.

**Price list selection**
- *Weekday* and *weekend* daily price lists; the weekend list applies when the rental falls on a weekend.
- *Hourly* price lists (weekday / weekend) exist in RentHub but are **not shown to customers**. Hourly rental is a **P2** option (the blog mentions "location à l'heure").
- Tolerance: a rental of 24 h + up to 1 h counts as 1 day (RentHub setting). Hourly tolerance: 29 minutes.

**Price per duration**
- A total price is set for 1, 2, 3, 4, 5 and 6 days (each duration can have its own total, e.g. Medium van: 1 day €70, 2 days €139.20, 3 days €205.20…).
- Optional longer tiers (e.g. Small car: from 7 days €31.92/day, from 30 days €30/day).
- Beyond the last tier, the price is **the daily rate of the last tier × number of days**. This is how RentHub calculates it today, e.g. Large car 10 days = 10 × €45 = €450.
- **Packages** replace the daily price when the duration matches: *Week* = exactly 7 days, 700 km included; *Month* = 29–31 days, 3,000 km included. The customer always gets the **cheapest valid price**, shown as one price.
  - RentHub today shows the week package and the daily price side by side. For the truck, the package (€672) is more expensive than 7 daily prices (€595).
  - The month packages are never offered to customers: a 30-day Large van shows €2,016 instead of the €1,550 package.
- Each price has a validity period (from / to), so seasonal prices can be prepared in advance.

**Mileage**
- Km included per day (100 km today; 10 km per hour for hourly rentals), per package, or **unlimited** (used today for the Small car at weekends).
- Extra km price (€0.35 incl. VAT today; €0.39 for the truck at weekends). Charged at return from the recorded km (manual reading at launch, tracker in Phase 3).

**Options and fees**
- Options priced **per day** (extra driver €9.90/day, baby seat €4/day, protection) or **fixed per rental** (airport/station delivery €60). Options can have a maximum number of billable days.
- Protection levels (daily): *Standard* included (liability capped at €3,000 per claim), *Comfort* €19/day (€500 for the first claim), *Zero deductible* €34/day (€0 for the first claim). Theft, fire and glass are excluded, as in the CGV.
- One-way fee when the return place differs from the pickup place (€59 between Gare / Aéroport / Ville today, both directions).
- Place fee for pickup/return at a specific place (currently €0).

**Dynamic pricing (P2)**
Simple rules managed by the admin: +/- % or fixed amount by date range (e.g. Cannes Festival, Monaco Grand Prix, summer), by category, by place, by day of week, or by how early the customer books. A "preview" shows the resulting price before saving.

**Coupons (P2)**
Code, % or fixed amount, validity dates, usage limit.

**VAT**
Prices are entered and displayed incl. VAT (20%). Insurance options carry their own VAT rate (0% in RentHub today — to confirm with the accountant).

> **Worked example (today's prices)** — Medium van, pickup Monday 09:00 at Nice Ville, return Wednesday 09:00 at Nice Aéroport, with Comfort protection:
> rental 2 days €139.20 + protection 2 × €19 = €38 + one-way fee €59 = **€236.20** incl. VAT. 200 km included, then €0.35/km. Deposit: €1,500 (authorisation).

### 7.2 Availability

- A vehicle is available if it has no booking, maintenance or unavailability block overlapping the requested period, **plus a buffer** between rentals (cleaning/check time, configurable, e.g. 60 min).
- Availability is checked **per category**: the customer books a category, and a specific vehicle is assigned automatically (or by the operator). An operator can swap the vehicle later without changing the price.
- Vehicles can be limited to certain places or to a place group, and can return to a different place (one-way).
- Overbooking protection: the last vehicle of a category is locked during checkout.

### 7.3 Fleet management

| Object | Main fields |
|---|---|
| **Place group** (city) | Name, colour |
| **Place** | Name, type (airport / station / city / port / other), address, GPS point, group, phone, email, available online (yes/no), pickup/return fee, VAT rate, safety radius (for GPS return check), instructions/photos for finding the vehicle |
| **Brand** | Name, logo |
| **Type** | Car / Van / Truck; check-in required (yes) |
| **Category** | Name (FR/EN), type, display order, description, photo |
| **Model** | Name ("Renault Master or equivalent"), brand, category, fuel, gearbox, seats, doors, air-con, tank litres, load volume m³ / payload (vans), towbar, photos, hidden online (yes/no), **deposit amount**, **deductibles** (damage, theft/fire, liability) |
| **Vehicle** | Plate, VIN, model, colour, current km, status (active / inactive / maintenance), date added / removed, available online, allowed places, GPS device ID, lock box ID, remote engine block (yes/no), documents (registration, insurance), deadlines (MOT, service, insurance) **P2**, expenses **P2** |

Today's data: 7 categories, 8 models, 5 vehicles, 4 places. It is imported from the RentHub export (Section 12).

### 7.4 Fleet calendar and reservations (admin)

The calendar is the main admin screen ("the most important line for me").

- **Planning view**: one row per vehicle, grouped by category; days (or hours) as columns; bookings as coloured bars by status; maintenance/unavailability blocks shown differently. Navigate by day, week and month; filter by type, category, place, fuel, gearbox, status.
- Counters per day: vehicles available / booked / blocked.
- **Drag and drop** to move a booking to another vehicle of the same category.
- **Create a booking from the calendar** (phone or walk-in customer): same price engine, with manual discount/override (reason required), send the customer a link to complete verification, contract and payment on their phone (the Contrazy link).
- **Booking detail** (tabs, simplified from RentHub's 13 tabs):
  - Status & price breakdown
  - Customer & drivers
  - Options
  - Documents & verification
  - Contract & signature
  - Payments & deposit
  - Pickup / return checks (photos, km, fuel, damages)
  - Extra charges
  - Dispute
  - History (audit log)
- **Statuses**: *Pending payment* → *Confirmed* → *In progress* (picked up) → *Returned* (return check done) → *Closed* (final charges settled, deposit released). Also *Cancelled* (with mandatory reason) and *No-show*.
- **Unavailability blocks**: reason (maintenance, repair, cleaning, internal use…), dates, vehicle.
- **Internal movements** (P2): move a vehicle between places without a customer.
- Search by plate, customer name, booking number.

### 7.5 Customers

- Customer list with search: name, email, phone, number of rentals, total spent, verification status, blacklist flag.
- Customer page: identity & licence (from Contrazy), drivers, bookings, payments, disputes, internal notes.
- **Blacklist** with coloured reasons (today: Smoker 🔴, Dirty, Fuel not refilled). A blacklisted customer cannot book online; the admin sees a warning on phone bookings.
- Company customers (P2): company name, SIRET, VAT number, invoice to the company.
- GDPR: export and delete a customer's data on request, with the retention periods from the LOCAZ privacy policy (identity documents 12 months after last check, GPS/telemetry 60 days after rental, inspection photos 6 months, invoices 10 years).

### 7.6 Rental operations: pickup, return and extra charges

Pickup and return use the **Contrazy check-in/check-out** flow. It already supports photos, numbers, choices and files per step.

- **Pickup check (mandatory before unlocking)**: 10 photos minimum (RentHub setting) following a guided sequence (4 sides, 4 corners, dashboard with km and fuel, interior), km reading, fuel level, existing damages marked on a car diagram (Scratch = X, Dent = O).
- **Return check (mandatory)**: same photos, km, fuel, keys returned to the glove box, return place confirmed.
- **Automatic calculation at return** (the operator confirms before charging):
  - Extra km: (km driven − km included) × extra km price.
  - Fuel: if the level is lower than at pickup, flat fee + price per litre (**CGV: €20 + €2.20/L; RentHub: €36 + €2.40/L — to align**).
  - Late return: tolerance 29 min, then **one extra rental day** (CGV) — the RentHub setting differs (see decisions).
  - Return outside the zone: €150 + repatriation cost.
  - Cleaning: light / medium / heavy = €35 / €50 / €130; extreme cleaning €250.
- Charges are **taken from the deposit** first, then from the customer's card for any balance (RentHub setting: "take fees from the deposit and the balance from the customer's card"), with an itemised receipt sent to the customer.
- Damages and fines follow the dispute process (7.8).

### 7.7 Payments and deposit

All money flows through **LOCAZ's own Stripe account**, connected to Contrazy (Stripe Connect). LOCAZ is paid directly by Stripe.

- **Rental payment**: charged in full at booking (card, Apple Pay / Google Pay), 3-D Secure forced (RentHub setting).
- **Deposit**: €1,500 per model today (configurable per model and per protection option). It is an authorisation — the money is blocked, not debited — on a card in the renter's name.
- **Refunds** follow the cancellation rules automatically.
- **Extensions and extra charges** are paid by card; the invoice is updated.

> **Important — deposit length.** A card authorisation can only be held for **7 days** by Stripe. Rentals longer than 7 days (up to 30 days) need another method. Contrazy already supports this: for longer rentals it **charges the deposit and refunds it automatically** after the rental, at a small cost (Stripe fee ~1.5% + €0.25 + 0.5% platform margin). **Decision needed**: accept this for rentals over 7 days, or re-authorise the deposit every 7 days (possible, but can fail if the card has no funds). The CGV (article 7) mentions a 30-day pre-authorisation and the provider "Swikly"; it will need a small update.

### 7.8 Damages, fines and disputes

Uses the **Contrazy dispute module** (already built: dispute record, statuses Open / Under review / Resolved / Lost, evidence pack as a ZIP with contract, photos and logs).

- The operator opens a dispute from a booking: damage, fine (PV), towing (fourrière), accident, non-return, other.
- Amounts are suggested from the **LOCAZ damage and penalty scale** (CGV annexes 1 and 2), stored as an editable list in admin. Examples: scratch 2–5 cm €250, bumper repair €450, lost key €600, undeclared damage €90, GPS tampering €1,000, fine handling €25, towing actual cost + €90, dispute handling fee €72 excl. VAT (RentHub setting).
- The protection option chosen caps the customer's liability automatically (Standard €3,000 / Comfort €500 first claim / Zero €0 first claim).
- The customer is notified with evidence (pickup vs return photos) and can respond. Payment is taken from the deposit or requested by card.
- Fines (ANTAI): record the fine and designate the driver from the booking data.

### 7.9 Users, roles and security

- Invite staff by email; roles as in Section 4; deactivate at any time.
- Two-factor authentication for Super admin and Administrators.
- Full audit log (who changed which price, booking or setting, and when).

### 7.10 Company settings

One settings page, grouped by topic, replacing RentHub's ~30 configuration panels. Launch values come from RentHub and the CGV:

| Group | Settings (current value) |
|---|---|
| Company | Name LOCAZ SAS, SIREN 994 107 696, VAT FR94994107696, APE 7711A, address 22 Avenue Robert Schuman 06000 Nice, email, phone, logo, website |
| Booking rules | Minimum age (21), licence held (1 year), max length (30 days), book ahead (6 months), minimum notice (60 min), minimum price (€35), buffer between rentals |
| Return | Late tolerance (29 min), late penalty (1 day), fuel refill fee and €/L, out-of-zone fee (€150), mandatory photos at pickup/return (10), fuel and km mandatory (yes) |
| Deposit | Default amount, release automatically after return (yes), release delay |
| Payments | 3-D Secure forced (yes), accepted methods, VAT rates |
| Cancellation | Refund tiers (24 h / 1 h), reason mandatory (yes) |
| Documents | ID required (yes), licence required (yes), proof of address (when requested), selfie check (yes) |
| Legal | CGV version, rental contract template (managed in Contrazy), privacy policy link |
| Notifications | Sender email, admin alert emails, WhatsApp (P3) |

### 7.11 Notifications

Email at launch (the Resend provider is already used by Contrazy); SMS/WhatsApp in P3.

| When | To | Content |
|---|---|---|
| Booking created, payment pending | Customer | Link to finish verification and payment |
| Booking confirmed | Customer + admin | Details, place, time, how to find the vehicle |
| 24 h and 1 h before pickup | Customer | Reminder, pickup check instructions |
| 1 h before end | Customer | Return reminder, how to extend |
| Late return | Customer + admin | Warning, then penalty notice |
| Return processed | Customer | Final receipt, extra charges, deposit release |
| New dispute / fine | Customer | Evidence and amount |
| Vehicle deadlines (P2) | Admin | MOT, service, insurance due |

### 7.12 Reports (P2)

Dashboard with the essentials: bookings and revenue by day/month, occupancy rate per category and per vehicle, average rental length and price, top options, cancellations, open disputes.

---

## 8. Contrazy integration

LOCAZ becomes a Contrazy vendor (a business account). Each confirmed booking creates a **Contrazy transaction** with the rental amount, deposit, documents required, contract and check-in/out steps. The customer completes these steps in a LOCAZ-branded flow (LOCAZ logo and name), then returns to the LOCAZ site.

### 8.1 What Contrazy already provides

| Need | Contrazy today |
|---|---|
| ID, passport, proof of address, driving licence upload | Yes — document requirements (ID, proof of address, driver licence, custom) |
| Identity check with selfie | Yes — Stripe Identity (optional per transaction) |
| Contract with customer data, e-signature, signed PDF | Yes — contract templates with merge fields, signature pad, signed PDF |
| Rental payment + deposit in one flow | Yes — "hybrid" transactions (payment + deposit) on the vendor's Stripe account |
| Deposit capture (full/partial) or release | Yes |
| Long deposits (8–30 days) | Yes — charge & automatic refund, with fee shown |
| Pickup / return reports with photos, km, fuel | Yes — check-in / check-out reports (text, number, choice, photo, file fields) |
| Disputes with evidence pack | Yes |
| Audit trail and emails | Yes |
| French / English | Yes |

### 8.2 What we add to Contrazy (small extensions)

| Extension | Why |
|---|---|
| **Partner API** with secure API keys | So the LOCAZ platform can create and read transactions automatically (today transactions are created from the Contrazy dashboard) |
| **Webhooks to LOCAZ** | Tell LOCAZ when documents are approved, the contract is signed, payment/deposit succeeded, check-in/out is submitted, or a dispute changes |
| **Return link** | Send the customer back to `booking.locaz.co` after each step |
| **Rental fields in the contract** | Vehicle, plate, category, pickup/return place and date-time, km included, extra km price, options, protection level, fuel and km at pickup |
| **Start/end date-time on transactions** | Today a transaction has a single service date |
| **Extra charges after return** | Charge extra km, fuel, late fees from the deposit or card, with an itemised receipt |
| **Re-use verified documents** | A returning customer does not upload the same licence twice while it is valid |

These extensions are general-purpose: they also make Contrazy sellable to other rental businesses.

---

## 9. Vehicle devices (Phase 3)

The goal is 100% keyless rental. Two devices are planned (final choice by LOCAZ after supplier meetings):

| Device | Purpose | Candidates discussed |
|---|---|---|
| **Key box** (battery, Bluetooth, placed in the car with the key) | Lock / unlock from the app, no wiring | Supplier shared by LOCAZ by email (API documentation and test access received) |
| **Plug-in tracker** (OBD port, plug & play) | GPS position, mileage, fuel level | Teltonika (e.g. FMB003 OBD), Invers |

**What we prepare from Phase 1** (so nothing needs redesign):
- Each vehicle stores its **key box ID** and **tracker ID**.
- A device layer in the LOCAZ API with one standard set of actions — *unlock*, *lock*, *get position*, *get km*, *get fuel* — and one adapter per supplier, so suppliers can be changed later.
- Access rules: unlock works only for the renter, only between pickup and return time, only after the pickup check is complete and the deposit is authorised.

**What devices add in Phase 3**
- Unlock/lock from the booking page (web) and later from the mobile app.
- Automatic km and fuel at pickup and return (no manual reading; manual stays as a fallback).
- Live fleet map in admin; alert when a vehicle leaves the allowed zone or is not returned 2 h after the end (CGV article 12).
- Return place check with the place's safety radius.
- Remote engine block (RentHub shows it active on 4 vehicles) — only if supported by the chosen device and legally allowed.

---

## 10. Mobile app and public API (Phase 4)

- Everything the website does goes through a **documented API** (OpenAPI/Swagger), so a mobile developer can build the iOS/Android app without changing the backend.
- The web booking site is **mobile-first** from day one and installable on the phone (PWA), so LOCAZ is usable on mobile before the native app exists.
- The native app adds: Bluetooth unlock (if the key box requires it), push notifications, guided photo capture, and "find my car" navigation.

---

## 11. Non-functional requirements

| Topic | Requirement |
|---|---|
| Mobile first | Designed for phones first; every step usable with one hand; fast on 4G |
| Performance | Search results in under 2 seconds; price updates instantly when options change |
| Availability | 24/7 service; hosted on Vercel with a managed PostgreSQL database in the EU; daily backups |
| Security | HTTPS everywhere; card data never touches LOCAZ servers (Stripe); documents stored encrypted; 2FA for admins; role-based access; rate limiting on login and booking |
| GDPR | Consent and privacy policy; retention periods as in the LOCAZ privacy policy; data export/deletion on request; EU data hosting where possible |
| Languages | French (default) and English; Italian P2 |
| SEO | Landing page stays static and SEO-optimised; booking pages have clean URLs and metadata per place/category (e.g. "Location utilitaire Nice Aéroport") |
| Scalability | Multi-city ready (place groups); no hard limit on vehicles |
| Traceability | Audit log for bookings, prices, settings and payments |

### Technology

Same proven stack as Contrazy, to share code and skills: Next.js (web + API), PostgreSQL with Prisma, Stripe, Cloudinary (photos/documents), Resend (email), hosted on Vercel.

The LOCAZ platform lives in the same code repository as Contrazy, as a separate application deployed to its own domain (`booking.locaz.co`). The existing landing page stays at `locaz.co`.

---

## 12. Data migration from RentHub

The RentHub account was reviewed and exported on **27 September 2026**, before access ends. The export (CSV files, screenshots and raw data) is in the `LOCAZ-RentHub-Export-2026-09-27` folder:

- Fleet: 7 categories, 3 types, 7 brands, 8 models, 5 vehicles (plates, km, deductibles), 4 places.
- Pricing: 4 price lists, all rates per category and duration, 2 packages, service prices, one-way fees.
- Rules: company settings, blacklist reasons, document and licence types, damage markers, cost types.

These are imported into the new platform during Phase 1.

Customer records, reservations and invoices were **not** exported, because they contain personal data. They can be exported on LOCAZ's request while RentHub access still works.

**Data issues found (to fix during import)**
- Service and insurance prices exist only for **Small** and **Medium cars**. Vans and the truck have no option prices.
- The **Small van weekly package** expired on 11/07/2026.
- **Medium car** has prices but no model or vehicle.
- The **Small car weekend** price is €80/day with unlimited km (weekday: €39.90 with 100 km/day). This is double the weekday price; to confirm.
- **Month packages are never applied** on the booking page. A 30-day rental shows €1,800 (Small van), €2,016 (Large van) or €2,550 (truck) instead of the €1,000 / €1,550 / €1,600 packages.
- The **truck week package** (€672) costs more than 7 daily prices (€595).
- The website says "from €29/day", but the lowest daily price in RentHub is €39.90 and the minimum booking is €35.

---

## 13. Delivery plan (proposal)

| Phase | Content | Target |
|---|---|---|
| **0 — Validation** | PRD review and decisions (Section 14); LOCAZ Stripe account; device supplier choice | Early October 2026 |
| **1 — Admin core** | Company settings, users & roles, places, categories, models, vehicles, price engine (daily, weekend, packages, km, options, one-way), fleet calendar, manual bookings, customers & blacklist, RentHub data import | October – November 2026 |
| **2 — Booking & Contrazy** | Public booking site (search → options → account → Contrazy verification/contract/payment → confirmation), customer area, Contrazy Partner API & webhooks, pickup/return checks, extra charges, deposit handling, disputes, emails, invoices | November – December 2026 |
| **3 — Devices** | Key box lock/unlock, tracker (GPS, km, fuel), fleet map, zone and late-return alerts | December 2026 – January 2027 |
| **Pilot launch** | Nice, current fleet, real customers | **January 2027** |
| **4 — Growth** | Public API documentation for the mobile app, dynamic pricing, coupons, hourly rental, reports, WhatsApp/SMS, vehicle deadlines & expenses, second city | From Q1 2027 |

Each phase ends with a demo and LOCAZ's acceptance before the next one starts. Phase 3 dates depend on device delivery and supplier API access.

---

## 14. Decisions needed from LOCAZ

| # | Question | Our suggestion |
|---|---|---|
| 1 | Minimum licence age: **1 year** (CGV) or **2 years** (website FAQ)? | Align both documents |
| 2 | Late return: **1 extra day after 30 min** (CGV), or RentHub's rule (29 min tolerance then extra hours/flat fee)? | Keep the CGV rule; simple and clear |
| 3 | Fuel refill: **€20 + €2.20/L** (CGV) or **€36 + €2.40/L** (RentHub)? | One value in settings, same in the CGV |
| 4 | Deposit for rentals over 7 days: **charge & refund** (small fee) or **re-authorise every 7 days**? | Charge & refund (already built, more reliable) |
| 5 | Protection option names: "Basique / Intermédiaire / Premium" (website), "Essentielle / Confort / Sérénité" (CGV) or "Standard / Comfort / 0 Franchise" (RentHub)? | One set of names everywhere |
| 6 | Option and insurance prices for **vans and trucks** (none today)? | Provide prices before import |
| 7 | Should **hourly rental** be offered online at launch? | P2, after launch |
| 8 | Airport/station **delivery by staff** at launch (needs opening hours)? | Keep, with a fixed fee and hours |
| 9 | Selfie identity check for **every** customer, or only above a risk threshold? | Every customer at launch |
| 10 | Device suppliers: key box and tracker final choice, and test devices | After LOCAZ's supplier meetings |
| 11 | Domain: `booking.locaz.co` (agreed in meeting) or `app.locaz.co`? | `booking.locaz.co` |
| 12 | Monthly rentals for **cars**: add a month package (vans/truck have one; cars use the 30-day price)? | Add one for consistency |
| 13 | Truck week package (€672) is more expensive than 7 daily prices (€595). Which is correct? | Fix before import |
| 14 | Keep "Request a quote" (no payment) as an option for professional customers? | Yes, as a P2 option |

---

## Appendix A — Current LOCAZ configuration (from RentHub, 27 Sept 2026)

### A.1 Daily prices — weekday (incl. VAT, 100 km/day included, extra km €0.35)

| Category | 1 day | 2 days | 3 days | 4 days | 5 days | 6 days | Week pkg (700 km) | Month pkg (3,000 km) |
|---|---|---|---|---|---|---|---|---|
| Small car (Twingo / Aygo) | 39.90 | 78.50 | 115.50 | — | — | — | 223.44 | — (7+ d: 31.92/d; 30+ d: 30.00/d) |
| Medium car | 44.90 | 88.50 | 129.90 | 169.90 | — | — | 290.00 | — |
| Large car (Fiat 500X) | 49.90 | 95.00 | 140.00 | 180.00 | — | — | 290.00 | — |
| Small van (Citan) | 65.00 | 127.20 | 187.20 | 244.80 | 300.00 | 360.00 | 350.00 (expired) | 1,000.00 |
| Medium van (Trafic) | 70.00 | 139.20 | 205.20 | 268.80 | 330.00 | 388.80 | 360.00 | 1,350.00 |
| Large van (Master / Daily) | 75.00 | 146.00 | 208.80 | 273.60 | 342.00 | 403.20 | 370.00 | 1,550.00 |
| Tipper truck (Cabstar) | 102.00 | 198.00 | 285.00 | 364.00 | 440.00 | 510.00 | 672.00 | 1,600.00 |

### A.2 Weekend daily prices (incl. VAT)

| Category | 1 day | 2 days | Other |
|---|---|---|---|
| Small car | 80.00 (unlimited km) | — | |
| Large car | 65.00 | — | |
| Small van | 80.00 | 156.00 | |
| Medium van | 75.00 | 144.00 | 3–6 days: 212.40 / 278.40 / 342.00 / 403.20 |
| Large van | 85.00 | 160.00 | |
| Tipper truck | 120.00 | 230.00 | extra km €0.39 |

Hourly prices exist for Small car (€19.90/h) and for vans/truck (€30–39 for the first hour, 10 km/h included). They are not shown online.

### A.3 Options (Small and Medium cars; incl. VAT)

| Option | Price | Charged |
|---|---|---|
| Standard protection | Included (mandatory) | — |
| Comfort protection | €19 | per day |
| Zero-deductible protection | €34 | per day |
| Extra driver | €9.90 | per day |
| Baby seat | €4.00 | per day |
| Delivery to airport / station | €60.00 | once |
| Hand truck (diable) | no price set | — |

### A.4 Places and one-way fees

| Place | Type | Address |
|---|---|---|
| Nice Gare | Station | Avenue Thiers, 06000 Nice |
| Nice Aéroport | Airport | 19 Rue Costes et Bellonte, 06200 Nice |
| Nice Ville | City | 11 Avenue Auber, 06000 Nice |
| Nice Collinettes | Other | 22 Rue Robert Schuman, 06000 Nice |

One-way fee: **€59** for Gare ↔ Aéroport, Ville ↔ Aéroport, Gare ↔ Ville (both directions).

### A.5 Fleet

| Model | Category | Fuel / gearbox | Seats | Deposit | Deductibles (damage / theft-fire / liability) |
|---|---|---|---|---|---|
| Renault Twingo or equiv. | Small car | — | 4 | €1,500 | €1,500 / €2,500 / €1,500 |
| Toyota Aygo or equiv. | Small car | Petrol, manual | 4 | €1,500 | same |
| Fiat 500X or equiv. | Large car | Petrol, automatic | 5 | €1,500 | same |
| Mercedes Citan or equiv. | Small van | Diesel, manual | 2 | €1,500 | same |
| Renault Trafic or equiv. | Medium van | — | 3 | €1,500 | same |
| Renault Master or equiv. | Large van | Diesel, manual | 3 | €1,500 | same |
| Iveco Daily or equiv. | Large van | Diesel, manual | 3 | €1,500 | same |
| Nissan Cabstar or equiv. | Tipper truck | Diesel, manual | 3 | €1,500 | same |

5 vehicles are registered: Iveco Daily, Fiat 500X, Mercedes Citan, Toyota Aygo and Nissan Cabstar. They are available at all 4 places.

### A.6 Reference lists

- **Blacklist reasons**: Smoker, Dirty, Fuel not refilled.
- **Required documents**: ID card, passport, proof of address (less than 3 months old); licence types: international licence, other.
- **Damage markers**: Scratch (X), Dent (O).
- **Vehicle cost types**: Washing, Energy, Service, Insurance, Tyres.

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| Category | Group of equivalent vehicles priced the same (e.g. Large van) |
| Model | "Renault Master or equivalent" — what the customer sees |
| Vehicle | One physical vehicle with a plate |
| Place / place group | Pickup/return point / city |
| Package | Fixed price for a week or a month with a km allowance |
| Deposit (caution) | Amount blocked on the customer's card during the rental |
| Deductible (franchise) | Maximum the customer pays per claim, depending on the protection chosen |
| One-way fee | Fee when the vehicle is returned to a different place |
| Check-in / check-out | Pickup / return inspection with photos, km and fuel |
| Contrazy | LOCAZ's platform for identity, contract, signature, payment, deposit and disputes |
