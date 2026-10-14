# LOCAZ — Decision log

Answers from Aziz LANDRI to Section 14 of PRD v1.0, received 1 October 2026 (original: [client-answers-2026-10-01.png](client-answers-2026-10-01.png)), and how each one is applied in PRD v1.1.

| # | Question | Aziz's answer | Applied in PRD v1.1 |
|---|---|---|---|
| 1 | Minimum licence age | Minimum age 21, licence held 1 year | 21 years, licence 1 year. The website FAQ ("2 years") must be updated |
| 2 | Late return rule | "30" | 30-minute tolerance, then 1 extra rental day (CGV art. 3.3). Configurable |
| 3 | Fuel refill | €36 + €3.50/L | €36 + €3.50/L. The CGV (€20 + €2.20/L) must be updated |
| 4 | Deposit over 7 days | Re-authorise | Request a 30-day extended authorisation on every deposit; when a card is not eligible, re-authorise automatically every 7 days using the saved card |
| 5 | Protection names | Standard / Comfort / 0 Franchise | Used everywhere; website and CGV to be updated |
| 6 | Option prices for vans/trucks | Same prices as cars; LOCAZ sets final prices in the admin | Same prices by default; editable per category |
| 7 | Hourly rental online | P1 | Moved to launch scope |
| 8 | Airport/station delivery | Keep, fixed fee and hours | Kept; opening hours moved to P1 |
| 9 | Selfie check | Every customer | Every customer |
| 10 | Device suppliers | Agree | Chosen by LOCAZ after supplier meetings |
| 11 | Domain | Why not locaz.co/booking? | `locaz.co/booking` on the same domain (Vercel rewrites) |
| 12 | Month package for cars | One for each category | Month package for every category |
| 13 | Truck week package | Should be less; set up after development | LOCAZ sets prices in the admin after development |
| 14 | "Request a quote" | Yes | Kept as P2 |

## Follow-up question (1 October 2026)

**Keeping the customer's card to charge fines that arrive months later.** Aziz suggested Stripe `SetupIntent` or `setup_future_usage = off_session`. Applied in PRD v1.1, section 7.7:
- the card is saved at checkout with `setup_future_usage = off_session` and the customer's explicit consent;
- later charges are off-session merchant-initiated payments;
- if the bank asks for authentication, the customer gets a payment link.

For fines, LOCAZ designates the driver to ANTAI within 45 days and charges the €25 handling fee.

## Commercial terms (sent with PRD v1.1)

- Total: **9,500 USD** for the scope of PRD v1.1, Phases 0–3. The native mobile app is not included.
- **3,000 USD upfront** to start; **6,500 USD** balance on delivery.

## Update — 13 October 2026

- **Price:** Aziz rejected the 9,500 USD full scope (maximum 3,000 USD, compared with Fleetee at about 97 € HT/month).
- **Final offer:** 3,000 USD, 100% upfront by payment link, for the launch version. Phase 2 is quoted separately.
- **Scope request:** Aziz confirmed "same scope", but needs a real solution to keep customers' card tokens for 90 days. He sent *LOCAZ Stripe Deposit Spec v2.1* (saved card via SetupIntent / `setup_future_usage`, hold at pickup, French consent clause, caps, idempotency, retry policy by decline type, payment links, refunds, 90-day window, QA checklist).
- **Decision:**
  - A **basic version** is included in the 3,000 USD: card saved and consent logged, hold at pickup, admin charge with proof, caps and 90-day guard, payment link on failure, admin refunds.
  - The **full automation of spec V1** (automatic retries, reminders, D+75 alert, auto-detach, versioned caps, full QA) is an add-on quoted separately.
  - Spec Phase 2 (dispute workflow, roles/approval, monitoring) comes later.
- **Didit** (didit.me), suggested by Aziz for identity checks: 500 free full KYC checks per month, then $0.33. Stripe Identity is about $1.50. Launch uses Stripe Identity (already built in Contrazy); switching to Didit is an add-on.
- Meeting brief: [LOCAZ-Meeting-Brief-2026-10-13.pdf](LOCAZ-Meeting-Brief-2026-10-13.pdf).

## Meeting of 13 October 2026 → PRD v2.0 (14 October 2026)

- **MVP clarity:** Aziz needs one unambiguous list of what the 3,000 USD includes. PRD v2.0 uses only "MVP (in the 3,000 USD)" and "after the MVP"; the P1/P2 labels are dropped.
- **Payment:** 1,500 USD upfront (October 2026) + 1,500 USD at MVP delivery (December 2026). This matches Aziz's own payment sheet. After the MVP, Aziz proposed a monthly amount (100 USD/month); not yet agreed.
- **90-day card:** Aziz's Stripe Deposit Spec v2.1 (V1 part) is **in the MVP**. Spec Phase 2 comes after.
- **Photos:** check-in/check-out photos are mandatory in the MVP.
- **Device:** Convadis C-Access (BLE key box, offline; CCom REST API; C-App or SDK). 215 €/device + 4.40 €/month; dev kit 350 € refundable. Aziz ordered one sample. Integration comes after the web MVP.
- **App:** a native app is needed for offline use in parking garages (photos + Bluetooth unlock). Planned about one month after launch.
- **Dashboard:** Aziz wants the platform to replace his Excel tracking (revenue by channel, month and vehicle; vehicle costs; margin). Included in the MVP, with a one-time import of the Excel history.
- **Fleetee:** trial reviewed read-only on 14 October 2026; comparison in PRD Appendix A.
- **Archive:** PRD v1.1 (EN PDF, FR markdown and PDF) moved to `archive/`.

## PRD v2.1 (15 October 2026)

- **Payment terms changed:** **1,800 USD upfront** (includes 300 USD for the AI development tools used throughout the project) + **1,200 USD at final delivery** (mid-December, at the latest the 3rd week of December 2026). Total unchanged: **3,000 USD**; the 300 USD is not an extra.
- **Buildability recheck against the Contrazy code.** These are moved out of the MVP because they would be new work:
  - Apple Pay / Google Pay (Contrazy accepts cards only);
  - Google sign-in for customers;
  - SMS phone verification (no SMS provider; email code instead);
  - admin 2FA;
  - damage marks on a car diagram (photos and notes instead).
- **Kept in the MVP as a small change:** the Stripe Identity matching-selfie option (not enabled in Contrazy today).
- **Third-party costs:** Stripe Identity fees (about $1.50 per check) added to the list.
- The v2.0 PDF is replaced by `LOCAZ-Booking-Platform-PRD-v2.1.pdf`.
