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
