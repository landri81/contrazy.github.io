# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: finance-ledger.spec.ts >> vendor full deposit capture records the fixed fee breakdown and audit trail
- Location: tests\e2e\finance-ledger.spec.ts:206:5

# Error details

```
Error: This API call cannot be made with a publishable API key. Please use a secret API key. You can find a list of your API keys at https://dashboard.stripe.com/account/apikeys.
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto"
  2   | 
  3   | import { loadEnvConfig } from "@next/env"
  4   | import { expect, test } from "@playwright/test"
  5   | import { PaymentKind, PrismaClient } from "@prisma/client"
  6   | import Stripe from "stripe"
  7   | 
  8   | import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"
  9   | 
  10  | loadEnvConfig(process.cwd())
  11  | 
  12  | const prisma = new PrismaClient()
  13  | const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  14  | 
  15  | if (!stripeSecretKey) {
  16  |   throw new Error("STRIPE_SECRET_KEY is required for finance e2e tests.")
  17  | }
  18  | 
  19  | const stripe = new Stripe(stripeSecretKey)
  20  | 
  21  | const APPROVED_VENDOR_ID = "e2e-approved-vendor"
  22  | const APPROVED_VENDOR_USER_ID = "e2e-approved-user"
  23  | const ADMIN_USER_ID = "e2e-admin-user"
  24  | 
  25  | function buildSuffix(prefix: string) {
  26  |   return `${prefix}-${randomUUID().slice(0, 8)}`
  27  | }
  28  | 
  29  | function buildCurrencyAmountLabel(amount: number) {
  30  |   return Math.round(amount)
  31  | }
  32  | 
  33  | function expectedCapturedFees(amount: number) {
  34  |   const normalizedAmount = buildCurrencyAmountLabel(amount)
  35  | 
  36  |   return {
  37  |     stripeFeeAmount: Math.round(normalizedAmount * 0.015) + 25,
  38  |     platformFeeAmount: Math.round(normalizedAmount * 0.005),
  39  |     vendorNetAmount:
  40  |       normalizedAmount -
  41  |       (Math.round(normalizedAmount * 0.015) + 25) -
  42  |       Math.round(normalizedAmount * 0.005),
  43  |   }
  44  | }
  45  | 
  46  | async function createManualCaptureIntent(amount: number) {
> 47  |   return stripe.paymentIntents.create({
      |                                ^ Error: This API call cannot be made with a publishable API key. Please use a secret API key. You can find a list of your API keys at https://dashboard.stripe.com/account/apikeys.
  48  |     amount,
  49  |     currency: "eur",
  50  |     capture_method: "manual",
  51  |     payment_method: "pm_card_visa",
  52  |     payment_method_types: ["card"],
  53  |     confirm: true,
  54  |   })
  55  | }
  56  | 
  57  | async function createClientProfile(seed: string) {
  58  |   return prisma.clientProfile.create({
  59  |     data: {
  60  |       vendorId: APPROVED_VENDOR_ID,
  61  |       fullName: `Finance ${seed}`,
  62  |       firstName: "Finance",
  63  |       lastName: seed,
  64  |       email: `${seed}@contrazy.test`,
  65  |       phone: "+33123456789",
  66  |       address: "1 Audit Street",
  67  |       country: "France",
  68  |     },
  69  |   })
  70  | }
  71  | 
  72  | async function createDepositTransaction(seed: string, amount: number) {
  73  |   const clientProfile = await createClientProfile(seed)
  74  |   const intent = await createManualCaptureIntent(amount)
  75  |   const transactionId = buildSuffix(`txn-${seed}`)
  76  | 
  77  |   const transaction = await prisma.transaction.create({
  78  |     data: {
  79  |       id: transactionId,
  80  |       vendorId: APPROVED_VENDOR_ID,
  81  |       clientProfileId: clientProfile.id,
  82  |       reference: buildSuffix(`REF-${seed}`).toUpperCase(),
  83  |       title: `Finance ${seed}`,
  84  |       status: "PAYMENT_AUTHORIZED",
  85  |       currency: "EUR",
  86  |       depositAmount: amount,
  87  |       depositAuthorization: {
  88  |         create: {
  89  |           status: "AUTHORIZED",
  90  |           amount,
  91  |           currency: "EUR",
  92  |           stripeIntentId: intent.id,
  93  |           authorizedAt: new Date(),
  94  |         },
  95  |       },
  96  |     },
  97  |     include: {
  98  |       depositAuthorization: true,
  99  |       clientProfile: true,
  100 |     },
  101 |   })
  102 | 
  103 |   return { clientProfile, intent, transaction }
  104 | }
  105 | 
  106 | async function createDeferredServicePaymentTransaction(seed: string, amount: number) {
  107 |   const clientProfile = await createClientProfile(seed)
  108 |   const transactionId = buildSuffix(`txn-${seed}`)
  109 | 
  110 |   const transaction = await prisma.transaction.create({
  111 |     data: {
  112 |       id: transactionId,
  113 |       vendorId: APPROVED_VENDOR_ID,
  114 |       clientProfileId: clientProfile.id,
  115 |       reference: buildSuffix(`REF-${seed}`).toUpperCase(),
  116 |       title: `Deferred ${seed}`,
  117 |       status: "SIGNED",
  118 |       currency: "EUR",
  119 |       amount,
  120 |       paymentCollectionTiming: "AFTER_SERVICE",
  121 |       customerCompletedAt: new Date(),
  122 |       link: {
  123 |         create: {
  124 |           token: buildSuffix(`token-${seed}`),
  125 |         },
  126 |       },
  127 |     },
  128 |     include: {
  129 |       link: true,
  130 |       clientProfile: true,
  131 |     },
  132 |   })
  133 | 
  134 |   return { clientProfile, transaction }
  135 | }
  136 | 
  137 | async function createDisputeTransaction(seed: string, amount: number) {
  138 |   const { clientProfile, transaction } = await createDepositTransaction(seed, amount)
  139 | 
  140 |   const dispute = await prisma.dispute.create({
  141 |     data: {
  142 |       transactionId: transaction.id,
  143 |       status: "OPEN",
  144 |       summary: "Client disputed the vendor claim during e2e verification.",
  145 |     },
  146 |   })
  147 | 
```