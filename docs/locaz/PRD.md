# LOCAZ Booking Platform — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | LOCAZ — self-service car & van rental platform (web app, admin back office, API) |
| **Prepared for** | Aziz LANDRI, LOCAZ |
| **Prepared by** | Shakil Khan |
| **Version** | 2.2 — final agreement |
| **Date** | 20 October 2026 |
| **Status** | Final — agreed in the meeting of 20 October 2026; replaces all earlier versions |

---

## 1. Summary

LOCAZ rents cars, vans and trucks in Nice on a self-service basis. RentHub has ended. LOCAZ needs its own platform, running **before the end of 2026**, that it can show to investors and banks in early 2027.

This document defines **exactly** what the first version (the **MVP**) includes for the agreed fixed price of **3,000 USD**, and what comes after.

**The rule is simple:** everything listed in Section 4 is in the MVP; everything else is not.

**The MVP is a web platform:**

1. **Booking website** on `locaz.co/booking` — search, price, options, account at checkout, verification, contract, payment.
2. **Admin back office** — fleet, prices, planning, bookings, customers, and a dashboard that replaces LOCAZ's Excel tracking.
3. **Contrazy** as the engine for identity checks, documents, contract and e-signature, payment, deposit, **check-in/check-out photos** and disputes.
4. **90-day card protection**: the customer's card is secured at booking, so LOCAZ can charge damage, fuel, tolls, towing, parking fines (FPS) and ticket admin fees for **90 days after return**. This follows LOCAZ's *Stripe Deposit Spec v2.1* (its V1 part).
5. **C-Access key box (Convadis)**: each booking becomes a digital key; the customer unlocks the vehicle with the phone, so LOCAZ can test keyless rentals before launch.

**After the MVP:** the LOCAZ mobile app, which is needed for offline use in parking garages.

This version is based on:
- the meetings of 13 and 20 October 2026 (full transcripts reviewed);
- a live read-only check of the Contrazy Stripe account (20 October 2026);
- LOCAZ's *Stripe Deposit Spec v2.1*;
- the Convadis C-Access documents, offer and API documentation;
- LOCAZ's revenue and fleet spreadsheet;
- a complete read-only review of Fleetee (trial account, 14 October 2026);
- the earlier review and data export of RentHub;
- the current Contrazy code.

---

## 2. Goals

| Goal | Measure |
|---|---|
| Replace RentHub and the Excel files | Bookings, fleet, prices, costs and revenue are all managed in the platform |
| Customers book 100% online, on their phone | A booking takes less than 5 minutes, without calling or WhatsApp |
| Secure every rental | Verified ID and licence, signed contract, pickup/return photos, card secured for 90 days |
| Show the business to investors and banks | Dashboard with revenue, occupancy, channels and margin per vehicle |
| Be ready to grow (9 vehicles today → 50 by end of 2027) | Adding vehicles, places or categories needs no developer |
| Prepare keyless rental and the app | The platform is built so the device and the app plug in without rework |

---

## 3. Product boundary

```
    +------------------------------+
    | Landing page (existing)      |
    | locaz.co                     |
    +------------------------------+
                   |  "Book now" (dates first)
                   v
    +------------------------------+                 +------------------------------+
    | LOCAZ BOOKING PLATFORM       |                 | CONTRAZY                     |
    | locaz.co/booking             |  <--- API --->  | (LOCAZ = first vendor)       |
    |                              |                 |                              |
    | - Search & price engine      |                 | - Identity check (KYC)       |
    | - Vehicle & options          |                 | - ID / licence / address     |
    | - Customer account           |                 | - Contract + e-signature     |
    | - Admin back office          |                 | - Payment + 90-day card      |
    | - Planning & dashboard       |                 | - Check-in / check-out       |
    | - Public API                 |                 | - Disputes & evidence        |
    +------------------------------+                 +------------------------------+
                   |  API (C-Access in MVP, app after)
                   v
    +------------------------------+                 +------------------------------+
    | C-Access key box (Convadis)  |                 | LOCAZ mobile app             |
    | - Digital keys via CCom API  |                 | - Offline check-in photos    |
    | - Unlock with phone (BLE)    |                 | - Bluetooth unlock           |
    +------------------------------+                 +------------------------------+
```

- **Money:** all payments go to **LOCAZ's own Stripe account**, connected through Contrazy (about 10 minutes to set up, business type "car rental"). LOCAZ is paid directly by Stripe.
- **Domain:** `locaz.co/booking`, on the same domain as the landing page.

---

## 4. MVP — included in the 3,000 USD

### 4.1 Admin back office

| Area | What is included |
|---|---|
| **Company settings** | Company details, logo, booking rules (minimum age 21, licence 1 year, minimum notice, maximum length 30 days, booking up to 6 months ahead), return rules (30-minute late tolerance then 1 extra day, fuel €36 + €3.50/L), cancellation rules |
| **Users and roles** | Super admin (Aziz), Administrator, Operator, Operator assistant; invite by email; audit trail of changes |
| **Places** | Pickup/return places (Nice Gare, Aéroport, Ville, Collinettes…) grouped by city; address, opening hours for staffed delivery |
| **Fleet** | Categories, models ("Renault Master or equivalent"), vehicles. Vehicle record follows LOCAZ's fleet sheet: plate, VIN, brand, model, trim, first registration, fuel, seats, category (car / van / truck), current km, status, insurer and renewal date, technical inspection date, purchase price, preparation costs, market value |
| **Pricing** | Per category, not per model. Daily prices weekday and weekend; prices for 1–6 days and longer tiers; hourly prices; week and month packages; km included per day or package, or unlimited; extra-km price; one-way fees between places |
| **Options and protection** | Options per day or fixed (extra driver, baby seat, tow bar, hand truck, airport/station delivery), with optional maximum price. Protection levels **Standard / Comfort / 0 Franchise** with daily price, deductible and deposit per category (e.g. deductible €1,600 vans / €1,200 cars; Comfort €650; 0 Franchise €0) |
| **Planning calendar** | One row per vehicle, bookings and unavailability (maintenance, repair) on a timeline; day / week / month views; filters; create a booking or a block by selecting dates; move a booking to another vehicle of the same category |
| **Bookings** | Manual bookings (phone, walk-in, Getaround, Turo, friends) with a **source** field; manual discount (e.g. direct-customer discount) with reason; status flow from *Pending payment* to *Closed*; send the customer a secure link to complete verification, contract and payment |
| **Customers** | Customer list and profile (identity, licence, bookings, payments, notes); **blacklist** with reasons (Smoker, Dirty, Fuel not refilled); a blacklisted customer cannot book online |
| **Vehicle costs** | Enter costs per vehicle (insurance, registration, repairs, tyres, servicing, tolls, Getaround box…) with date and amount |
| **Dashboard** | Replaces the Excel tracking: revenue by month, **by channel** (website, direct, Getaround, Turo, friends) and by vehicle/category; number of rentals; days rented; average price per day and per rental; average rental length; occupancy rate; **margin per vehicle** (revenue − costs) and payback vs purchase and preparation price; insurance cost per month; CSV export |
| **Data import** | One-time import of the existing data: fleet list, customers (with blacklist flag), RentHub settings and prices, and the revenue and cost history from the Excel file, so the dashboard starts with real numbers |

### 4.2 Booking website (`locaz.co/booking`)

- **French, English and Italian** (more languages can be added later). Mobile first. Dates-first search box, also embeddable on the landing page.
- The Contrazy screens (identity check, contract signature, check-in/out) are in French and English at launch; Italian for those screens comes after the MVP.
- **Search → results → options → summary → account → verification & contract → payment → confirmation.**
- **Results:** one card per category ("Model or equivalent"), with photo, seats, gearbox, fuel, km included and the **total price**. The best price (daily or package) is chosen automatically.
- **Summary:** shows the rental, options, one-way fee, km included, extra-km price, deductible, deposit, cancellation rules and the **90-day card consent**, all before payment.
- **Account:** created only at checkout. The email is verified by a one-time code; the phone number is collected.
- **Customer area:** bookings, documents, contract, receipts; cancel with the refund rule shown.
- **Emails:** confirmation, pickup reminder, return reminder, return receipt, every post-rental charge with its proof.

### 4.3 Contrazy connection

| Step | Included |
|---|---|
| **Identity check** | ID or passport with matching selfie (Stripe Identity), driving licence front and back, proof of address when required |
| **Contract** | Rental contract generated with the booking details (vehicle, plate, dates, places, km, options, protection, deductible, deposit) and signed on the phone; signed PDF stored |
| **Payment** | Rental paid online in full by card (3-D Secure) to LOCAZ's Stripe account |
| **Check-in / check-out** | **Mandatory photos** at pickup and return (guided: outside, dashboard with km and fuel, interior), km and fuel readings, damage photos and notes; automatic calculation of extra km, fuel and late return at check-out |
| **Disputes** | Damage and claim cases with the evidence pack (contract, photos, consent, notices) |
| **Contrazy extensions** | Built as part of the MVP: partner API (API keys) so the LOCAZ platform creates bookings in Contrazy; webhooks back to LOCAZ for each step; return link to `locaz.co/booking`; rental fields in the contract; start/end date-time on bookings; selfie option in identity checks; saved card and post-rental charges (4.4) |

### 4.4 90-day card protection (Stripe Deposit Spec v2.1 — V1)

How it works for the customer: at booking, the card is **secured by Stripe** (3-D Secure once) and the customer ticks the consent box. This is a security step like Swikly or Gando, not "save my card for next time". LOCAZ never sees or stores the card number.

| Spec section | Included in the MVP |
|---|---|
| §4 Card secured at booking | Stripe customer + card token on LOCAZ's Stripe account. Paid online bookings save the card with the payment; cash or agency bookings use a "card as security only" step |
| §5 Hold at pickup | Optional hold (e.g. €800) placed when the vehicle is handed over; captured (full or partial) or cancelled at return |
| §6 Consent | Mandatory checkbox, unticked by default, French text (English shown alongside); logged with date, IP, browser, terms version and exact text |
| §7 Charges after return | Admin selects booking, charge type (damage, fuel, toll, towing, FPS, ticket admin fee), amount and proof → card charged off-session; customer receives the receipt and proof |
| §8 Caps | Server-side limits editable in the admin: global cap per booking (= deductible), cap per charge type, one ticket admin fee per notice, proof required for FPS / tolls / towing |
| §9 Safety and retries | One idempotency key per attempt and one charge per row (no double charge); signed Stripe webhooks; automatic retry rules by decline type (e.g. insufficient funds: up to 3 retries; authentication required: no retry, payment link) |
| §10 Failed charges | Secure payment link sent automatically; reminders at D+3, D+7, D+14; flag for collection after D+14 |
| §11 Refunds | Full or partial refunds (e.g. FPS cancelled on appeal), executed at Stripe, with a reason |
| §12 Evidence and data | Stripe IDs, consent log, contract, photos, notices, invoice and emails kept 13 months after the last charge; card data only at Stripe |
| §13 90-day window | `return date + 90 days` shown on each booking; new charges blocked after it; admin alert at D+75; card detached automatically after the window if nothing is open |
| §17–§18 Quality | Separate test and live Stripe keys, secrets outside the code, full QA checklist (15 scenarios) passed in Stripe test mode before going live |

**Traffic fines** (speed camera, red light) are **never charged** by LOCAZ. LOCAZ designates the driver on ANTAI (legal deadline: 45 days) and only charges its admin fee. The platform shows the driver details needed for the designation.

**Adjustments to the spec** (agreed approach):
- The card and customer are saved on **LOCAZ's own Stripe account** through Contrazy.
- There is **one Stripe customer per client**, reused for every booking, not one per booking.
- Stripe may update reissued cards automatically. This doesn't work for every card, so the card-update link from the spec is kept.
- A 30-day hold for car rental is possible if Stripe enables it on LOCAZ's account. It's optional, and the saved card covers everything else.
- The consent text and price schedule need a **legal check** by LOCAZ before launch.
- The ID-retention period must be aligned with the privacy policy (spec: 13 months; current policy: 12 months).

### 4.5 C-Access key box (Convadis) — web integration

Moved into the MVP at LOCAZ's request (meeting of 20 October 2026), so keyless rentals can be tested before launch.

| Item | Included |
|---|---|
| **Vehicles** | Each LOCAZ vehicle linked to its C-Access device in Convadis's CCom server (REST API, OAuth2) |
| **Digital keys** | Each confirmed booking creates a reservation in CCom (vehicle, start/end time, authorised driver); changes and cancellations are synced |
| **Customer access** | The customer receives a link / QR code to load the key into **Convadis's C-App** and unlocks the vehicle by Bluetooth, even with no network |
| **Rules** | The key is only active during the rental, and only after the pickup check and the card security step are done |
| **Usage events** | Unlock/lock times read back from CCom and shown on the booking |
| **Admin** | Device status per vehicle; cancel or end a key from the booking |
| **Testing** | With LOCAZ's sample device and/or Convadis's development kit (car simulator) |

The LOCAZ mobile app (with Convadis's SDK built in, instead of C-App) comes after the MVP.

### 4.6 Step switches (testing mode)

The admin can switch steps of the rental process on or off, globally or per booking, while LOCAZ is testing (as already done in Contrazy). This covers:
- identity check;
- documents;
- contract signature;
- check-in photos and check-out photos;
- the hold at pickup;
- the C-Access digital key.

For example, check-in photos can be switched off until the mobile app exists. The card security step stays on for online bookings.

### 4.7 Invoices

- A rental invoice PDF for every booking, and one for every post-rental charge: sequential numbering, LOCAZ company details (SIREN, VAT number), customer details, VAT breakdown.
- A credit note for every refund.
- Sent to the customer by email and available in the customer area and the admin.
- CSV export for the accountant.

### 4.8 Delivered with the MVP

- Setup of `locaz.co/booking` on LOCAZ's domain (Vercel), with LOCAZ's Stripe account connected through Contrazy.
- A short admin guide, plus a handover session.
- Bug fixes for the delivered scope after launch.

---

## 5. Not in the MVP — after the MVP

These are planned and the MVP is built to accept them, but they are **not included in the 3,000 USD**. Each one is agreed in writing before work starts.

| Item | Why it comes after |
|---|---|
| **LOCAZ mobile app** (iOS / Android): offline check-in photos, Bluetooth unlock via the Convadis SDK (replacing C-App), push notifications | A website cannot work without network in a parking garage; only an installed app can. Needs a developer experienced with Bluetooth / hardware; Shakil helps LOCAZ find and brief one |
| Spec v2.1 Phase 2: full chargeback workflow, two-person approval above €200, roles per agency, monitoring and alerts | Spec marks them Phase 2; the MVP has the V1 minimum (admin email on dispute, single admin role for charges) |
| Quotes with expiry date and 50% advance payment | The MVP covers direct customers with a manual discount + payment link |
| Coupons / promo codes, seasonal and dynamic pricing | Can be added once real booking data exists |
| Maintenance module (interventions, vehicle reports with photos, deadline reminders) | The MVP has vehicle costs and inspection/insurance dates |
| Traffic ticket workflow (statuses, contest tracking, automated ANTAI export) | The MVP charges the admin fee and shows driver details |
| Getaround / Turo automatic sync | The MVP records their bookings manually with the source |
| Customer reviews, SMS/WhatsApp, marketing emails | Not needed to run the business at launch |
| Switching identity checks to Didit (free up to 500 checks/month) | The MVP uses Stripe Identity, already built |
| Full accounting (purchase orders, suppliers, cash book) and French e-invoicing platform connection | Handled by the accountant; the MVP issues rental invoices and exports CSV |
| Multiple agencies with agency managers | One company, several places, in the MVP |
| Apple Pay / Google Pay, Google sign-in, SMS phone verification | The MVP uses card payment and email verification |
| Two-factor authentication for admins | The MVP uses roles and strong passwords |
| Damage marks on a car diagram | The MVP records damage with photos and notes |
| Italian on the Contrazy screens (identity, contract, check-in/out) | The LOCAZ site and emails are in Italian in the MVP |

---

## 6. Customer journey (web)

1. **Search:** pickup and return place, dates and times.
2. **Results:** vehicles with total price and km included.
3. **Options:** protection, extra driver, baby seat, delivery…
4. **Summary:** full price, deductible, deposit, cancellation rules, 90-day card consent.
5. **Account:** created at checkout.
6. **Verify and sign:** licence, ID, selfie, contract signed on the phone.
7. **Pay:** rental paid; card secured for 90 days.
8. **Pickup:** guided photos, km and fuel; the C-Access digital key becomes active and the customer unlocks with the phone (or key handover for vehicles without a device).
9. **Return:** photos, km and fuel; extra km, fuel and late fees calculated; hold settled.
10. **Up to 90 days after return:** FPS, tolls, towing or ticket admin fees charged with proof if needed.

---

## 7. Non-functional requirements

| Topic | Requirement |
|---|---|
| Mobile first | Every customer step works on a phone |
| Performance | Search results in under 2 seconds |
| Security | HTTPS; card data only at Stripe; signed webhooks; role-based access; strong passwords; secrets outside the code |
| GDPR | Consent, privacy policy, retention periods (identity documents, photos, payment data), export/deletion on request |
| Languages | French (default), English and Italian |
| Hosting | Vercel; managed PostgreSQL on the same provider as Contrazy (Neon, EU), separate database; daily backups |
| Technology | Same stack as Contrazy: Next.js, PostgreSQL/Prisma, Stripe, Cloudinary, Resend |
| Devices | C-Access integrated through Convadis's CCom API (Section 4.5); the platform is ready for the mobile app to replace C-App |

---

## 8. Stripe account structure

Checked live on 20 October 2026:
- **Platform account "Contrazy":** owned by **LYNAEL** (France, company), fully verified, payments and payouts active, nothing outstanding.
- **Connected accounts:** none yet in live mode.

**Decision: no new company is needed now.**

| Account | Owner | Role |
|---|---|---|
| Contrazy platform | LYNAEL (holding) | Runs Contrazy: Connect, identity checks, platform settings |
| LOCAZ connected account | **LOCAZ SAS** | Receives all LOCAZ payments and payouts; holds LOCAZ's customers and the 90-day saved cards; business type car rental (MCC 7512) |

- LOCAZ connects from its Contrazy dashboard (about 10 minutes) in the name of LOCAZ SAS, with its own bank account. Customers see LOCAZ on their bank statement.
- **If a new tech company is created later:**
  - Stripe generally doesn't move an account to a different legal entity (and never to another country), so that company opens its own platform account and LOCAZ reconnects to it (about 10 minutes).
  - LOCAZ's history and payouts stay in its existing account.
  - Saved cards are only used for 90 days, so the switch has little impact.
  - The platform keys are configuration only; no code change.

## 9. Timeline

Work starts when the upfront payment is received (expected the week of 26 October). Progress is shared on Google Chat and on GitHub, with a demo at the weekly Tuesday meeting.

| Period | Delivered |
|---|---|
| Week 1 (from ~26 Oct) | Setup, data model, company settings, users, places, fleet, data import |
| Weeks 2–3 | Pricing engine, options and protection, planning calendar, manual bookings, customers, step switches |
| Weeks 4–5 | Booking website (FR/EN/IT), Contrazy connection (identity, contract, payment), card secured + consent |
| Week 6 | Check-in/check-out photos, 90-day charges (caps, retries, links, refunds, window), invoices |
| Week 7 | C-Access integration and tests with the device / dev kit, dashboard, emails |
| Week 8 (14–18 December) | Full QA in Stripe test mode, fixes, go-live on `locaz.co/booking`, **final MVP delivery** (mid-December, at the latest in the 3rd week of December) |
| From January 2027 | Tests with real customers, fixes and updates |
| February 2027 (target) | After MVP: LOCAZ mobile app (offline + Bluetooth unlock), depending on the mobile developer |

The C-Access tests depend on Convadis providing API access and the sample device or dev kit by mid-November.

---

## 10. Commercial terms

| Item | Terms |
|---|---|
| **MVP fixed price** | **3,000 USD** for everything in Section 4 |
| **Payment** | **1,800 USD upfront** to start (October 2026), of which 300 USD covers the AI development tools used throughout the project · **1,200 USD at final delivery** (mid-December, at the latest the 3rd week of December 2026) |
| **Total** | **3,000 USD** — the 300 USD is part of this total, not an extra |
| **Ownership** | Code and data belong to LOCAZ; no licence fee or subscription |
| **Not included** | Section 5 items; third-party costs paid directly by LOCAZ: Stripe fees (payments and Stripe Identity checks, about $1.50 each), hosting (Vercel, database, Cloudinary, Resend), Convadis devices and subscription (€215/device + €4.40/month), Convadis dev kit (€350, refundable) |
| **After the MVP** | Next phases (mobile app, extras) are scoped and agreed in writing before work starts |
| **Agreement** | A written agreement based on this PRD is signed by both parties before work starts |

---

## 11. What LOCAZ provides

1. The signed agreement and the upfront payment (1,800 USD).
2. Connects LOCAZ SAS's Stripe account in Contrazy (about 10 minutes, business type "car rental").
3. Access to the domain (GoDaddy) to set up `locaz.co/booking`.
4. Final prices per category: daily, packages, options, protection, deductibles, deposits. They can also be set directly in the admin.
5. Legal check of the 90-day consent text and the charge price schedule; updated CGV and privacy policy (fuel €36 + €3.50/L, protection names, licence 1 year, Stripe instead of Swikly, 90-day card clause).
6. Photos of the vehicles and places, and the logo.
7. By mid-November: the C-Access sample and/or Convadis development kit, and CCom API access (client credentials) from Convadis.
8. Italian texts reviewed by LOCAZ (translations are prepared in the platform).

---

## Appendix A — Feature comparison: RentHub, Fleetee, LOCAZ

Built from the RentHub review (27 Sept 2026) and the Fleetee trial review (14 Oct 2026). **MVP** = included in the 3,000 USD. **After** = Section 5.

| Feature | RentHub | Fleetee | LOCAZ |
|---|---|---|---|
| Fleet: categories, models, vehicles | Yes | Yes (types, categories, assets, Excel import) | **MVP** |
| Places / agencies with opening hours | Yes | Yes (agencies) | **MVP** (places) · multi-agency after |
| Planning calendar (day/week/month) | Yes | Yes (day, week, month, 3 months) | **MVP** |
| Booking sources | Yes (origins) | Yes (on site, phone, online + custom) | **MVP** (website, direct, Getaround, Turo, friends…) |
| Booking rules (minimum notice, max advance, min duration) | Yes | Yes (+ overbooking, manual price edit, past bookings) | **MVP** |
| Daily prices, weekday/weekend, duration tiers | Yes | Yes (price grid by category) | **MVP** |
| Hourly prices | Yes | Yes | **MVP** |
| Packages (week / month, km included) | Yes | Yes (tariff packages by start day, duration, km, season) | **MVP** (week, month) |
| Km tiers / unlimited km | Yes | Yes (km tiers, priced) | **MVP** |
| Options (per day / fixed, max price) | Yes | Yes (+ option groups) | **MVP** |
| Protection levels with deductible and deposit | Yes | Yes (franchise levels, deposits per category) | **MVP** |
| One-way / return fees | Yes | Yes (return fees, cancellation fees) | **MVP** |
| Seasons and dynamic pricing | Yes | Yes (season calendar, pricing groups) | After |
| Coupons | Yes | Yes (validity, max uses, duration, category) | After |
| Online booking website | Yes (booking engine) | Yes (website builder, deposit %, customer date changes) | **MVP** (`locaz.co/booking`, account at checkout) |
| Online check-in before rental (driver info, licence) | Not used | Yes (3 days before) | **MVP** (via Contrazy, at checkout) |
| Identity check with selfie | No | Not shown (licence upload, manual validation) | **MVP** (Contrazy / Stripe Identity, selfie option enabled) |
| E-signed rental contract | Remote signature setting | Yes (documents center) | **MVP** (Contrazy) |
| Online payment | Yes | Yes (payment links) | **MVP** |
| Online deposit | Card deposit settings | Yes (online deposit) | **MVP** (pickup hold + **90-day saved card**) |
| Charges after return (fines, tolls, damage) with consent | No | Not shown | **MVP** (spec v2.1 V1) |
| Check-in / check-out with photos | Yes (checklist) | Yes (Fleetee Check app, vehicle tour) | **MVP** (web) · offline app after |
| Damage claims / disputes | Yes | Yes (claims list) | **MVP** (Contrazy disputes) |
| Traffic tickets | Yes | Yes (statuses, contest) | **MVP** admin fee + driver details · full workflow after |
| Quotes | Yes | Yes (expiry date) | After (MVP: discount + payment link) |
| Customers, blacklist | Yes | Yes (private / business, import) | **MVP** |
| Users and roles | Yes | Yes (admin, agency manager, agent, per-module access) | **MVP** (4 roles) |
| Vehicle costs / maintenance | Yes | Yes (interventions, reports) | **MVP** costs · maintenance module after |
| Dashboard (revenue, occupancy, channels, avg price) | Basic | Yes | **MVP** (+ margin per vehicle, payback) |
| Invoices | Yes (full accounting) | Yes (deposit / rental / balance invoices) | **MVP** rental invoices + credit notes · full accounting after |
| Customer reviews, emails log | Yes | Yes | After |
| Keyless device | GPS menu (not used) | Not shown | **MVP** (C-Access via CCom + C-App) |
| Mobile app | No | Fleetee Check (staff inspections) | After (customer app, offline) |
| Monthly cost | Subscription | From 97 € HT/month (complete plan, < 20 vehicles) | None (owned) |

## Appendix B — C-Access (Convadis) reference

**What C-Access is**
- A Bluetooth (BLE) key actuator: the original vehicle key goes inside, and the box presses lock/unlock.
- It can also block starting the car, for keyless vehicles.
- The battery lasts about 3 years, with AES-encrypted communication.
- Once the reservation is on the phone, it works fully offline.

**How the platform connects**
1. Create each vehicle in Convadis's CCom server (REST API, OAuth2).
2. For each booking, create a **reservation** in CCom: vehicle, start/end time, authorised user.
3. Give the customer access to **C-App** (Convadis's app) through a profile QR code or link generated by CCom. Later, the LOCAZ app replaces C-App using Convadis's SDK (CAppLib).
4. Read usage events (unlock/lock times) back from CCom into the booking.

**Commercial and practical**
- Device pricing: €215 per device (10–49 devices) + €4.40 per device per month. Payment: 50% upfront, the rest in 3 instalments.
- Development kit: €350, refundable within 6 months.
- For vehicles with a physical key, a second key stays in the vehicle and is not secured, as Convadis notes.

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| MVP | The first version, included in the 3,000 USD (Section 4) |
| Card secured / saved card | Card token kept by Stripe, used for charges after the rental with the customer's consent |
| Hold (pre-authorisation) | Amount blocked on the card from pickup to return (about 7 days maximum) |
| Off-session charge | Charge made by LOCAZ later, without the customer present, under the consent given at booking |
| FPS | Forfait post-stationnement (municipal parking charge) |
| Deductible (franchise) | Maximum the customer pays per claim, depending on the protection chosen |
| CCom / C-App | Convadis's server and phone app for the C-Access key box |
| Contrazy | LOCAZ's platform for identity, contract, payment, deposit, inspections and disputes |
