# Conntrazy Contract Flow Audit Plan

Date: 2026-05-04

This document is an audit and implementation plan only. No runtime code changes were made in this pass.

## Scope Reviewed

Reviewed areas:
- `prisma/schema.prisma`
- `src/app/api/vendor/profile/route.ts`
- `src/features/dashboard/components/vendor-profile-form.tsx`
- `src/features/dashboard/components/transaction-creation-form.tsx`
- `src/features/dashboard/components/contract-template-list.tsx`
- `src/features/dashboard/components/checklist-template-list.tsx`
- `src/features/client-flow/server/client-flow-data.ts`
- `src/features/client-flow/components/client-pages.tsx`
- `src/features/client-flow/components/client-uploads-form.tsx`
- `src/features/client-flow/components/contract-review-form.tsx`
- `src/features/client-flow/components/client-sign-form.tsx`
- `src/app/api/client/[token]/profile/route.ts`
- `src/app/api/client/[token]/documents/route.ts`
- `src/app/api/client/[token]/kyc/route.ts`
- `src/app/api/client/[token]/kyc/start-stripe-identity/route.ts`
- `src/app/api/client/[token]/contract/route.ts`
- `src/app/api/client/[token]/sign/route.ts`
- `src/app/api/client/[token]/payment-intent/route.ts`
- `src/app/api/client/[token]/payment-confirm/route.ts`
- `src/features/transactions/server/transaction-finance.ts`
- `src/app/api/vendor/transactions/[transactionId]/deposit/route.ts`
- `src/app/api/vendor/transactions/[transactionId]/dispute/route.ts`
- `src/app/api/vendor/transactions/[transactionId]/cancel/route.ts`
- `src/features/subscriptions/server/feature-gates.ts`

## Executive Summary

The codebase already has a real vendor-to-client workflow skeleton:
- vendor profile, contracts, checklist templates, Stripe Connect, transaction creation, secure links, client profile/documents/KYC/contract/signature/payment steps, deposit controls, disputes, emails, and transaction events all exist
- the product is not yet complete against the MVP contract-flow specification you provided

The main blockers are:
- vendor and client profile models do not match the required MVP fields
- contract handling is still template-text-based and does not produce an immutable final signed PDF artifact
- transaction contracts are not snapshotted at send time, so historical agreement integrity is not guaranteed
- the document requirement system is generic, but it is not mapped cleanly to the required MVP document categories
- `TEXT` requirements exist in the schema but are not supported by the client upload UI
- KYC quotas are now present in plan logic, including `Starter = 1 KYC`; the only remaining KYC gap is provider behavior if the older “basic plan = manual picture upload” rule is still required
- finance timing is still system-driven, not vendor-driven; there is no “charge after signing” vs “charge after service” control
- deposit fee and platform margin logic are not implemented in the Stripe/payment ledger flow

## Requirement Audit

### 1. Vendor Profile (MVP)

Required vendor-entered fields by spec:
- Business name
- First name
- Last name
- Address
- Country
- Company registration number / VAT Number
- Email
- Phone number

System-managed integration field:
- Stripe account ID

Current status: `PARTIAL`

What exists now:
- `VendorProfile` stores `businessName`, `businessEmail`, `supportEmail`, `businessPhone`, `businessAddress`, `businessCountry`, `stripeAccountId`
- the signed-in `User` stores a single `name`
- vendor profile UI already allows editing business name, phone, address, country, support email
- `stripeAccountId` is already persisted automatically when the vendor completes Stripe Standard Connect onboarding

What is missing:
- vendor owner `firstName` and `lastName` are not stored separately
- company registration number and VAT number are not stored
- business email is effectively locked to the account email, which is acceptable operationally, but it is not modeled explicitly as the full vendor-contact spec

Required update:
- extend `VendorProfile` with:
  - `ownerFirstName`
  - `ownerLastName`
  - `registrationNumber`
  - `vatNumber`
- keep `stripeAccountId` as a system-managed field populated by the Stripe Connect flow, not a vendor-editable profile input
- keep `User.name` as a derived display field or backfill it from first + last name
- update vendor profile form, schema, API route, dashboard summary cards, and admin/vendor review tables

### 2. Client Form (MVP)

Required by spec:
- First name
- Last name
- Company name if needed
- Address
- Country
- Email
- Phone number

Current status: `PARTIAL`

What exists now:
- `ClientProfile` stores `fullName`, `email`, `phone`, `companyName`
- client flow UI currently asks for full name, email, phone, company name

What is missing:
- no separate `firstName` and `lastName`
- no `address`
- no `country`
- no vendor-defined client form configuration; the client profile form is hard-coded

Required update:
- extend `ClientProfile` with:
  - `firstName`
  - `lastName`
  - `address`
  - `country`
- either keep `fullName` as a computed compatibility field, or migrate current usage to `firstName + lastName`
- add transaction-level or vendor-level field configuration for the client intake form if “can be defined by vendor” must remain part of MVP behavior

### 3. Contract / Terms Structure (MVP)

Required by spec:
- vendor can add the contract source
- source may be web, PDF, Word, or another fillable format
- contract auto-populates client fields
- signature is required inside the contract flow
- date and hour of signature are auto-filled
- final signed PDF is generated and stored

Current status: `PARTIAL / NOT COMPLETE`

What exists now:
- vendor can create reusable contract templates as plain text / web-authored template content
- merge tokens currently supported:
  - `{{clientName}}`
  - `{{clientEmail}}`
  - `{{clientPhone}}`
  - `{{clientCompany}}`
  - `{{vendorName}}`
  - `{{transactionReference}}`
  - `{{paymentAmount}}`
  - `{{depositAmount}}`
- client reviews rendered text, then signs on a canvas pad
- `SignatureRecord` stores:
  - signer name
  - signer email
  - signature image data URL
  - IP address
  - signed timestamp

Critical gaps:
- no immutable transaction-level contract snapshot exists
- `Transaction` only references `contractTemplateId`; if the vendor edits the template later, historical transactions may render different agreement content
- no support for PDF or DOCX as fillable/signable source formats
- no final signed PDF generation
- no final signed PDF storage URL / asset record / hash / download path
- signature date and hour are not merged into the rendered contract content
- no dedicated “final signed agreement artifact” model exists
- no contract attachment concept exists beyond generic uploaded documents

Recommended MVP decision:
- lock the canonical signable contract source to `web-authored HTML/rich text template`
- treat uploaded PDF/Word files as attachments unless you explicitly want a larger document-engine project
- this is the fastest realistic way to satisfy the “fillable like DocuSign and generate final signed PDF” requirement

Required update:
- add a transaction-level contract artifact model, for example:
  - `TransactionContractArtifact`
  - `transactionId`
  - `sourceTemplateId`
  - `renderedHtmlBeforeSignature`
  - `renderedHtmlAfterSignature`
  - `signatureImageUrl` or stored asset reference
  - `signedPdfUrl`
  - `signedPdfPublicId`
  - `signedPdfHash`
  - `generatedAt`
  - `signedAt`
  - `signedTimezone`
- snapshot the contract content when the transaction/link is created
- add merge fields for:
  - signer name
  - signed date
  - signed time
  - signed ISO timestamp
- generate the final signed PDF immediately after signature completion
- store the final PDF as an immutable asset and expose it in vendor transaction detail, client completion, and email receipts

### 4. Required Documents

Required by spec:
- ID via Stripe Identity or picture if basic plan
- optional uploads:
  - proof of address
  - driver license
  - company registration
  - contract attachment
  - custom documents
  - other (to name)
- vendor can define required documents per transaction

Current status: `PARTIAL`

What exists now:
- vendor defines checklist templates
- checklist items are copied into `TransactionRequirement[]` at transaction creation
- client can upload images and PDFs to Cloudinary
- `DocumentAsset` is stored per transaction and per requirement
- KYC has both manual-upload and Stripe Identity route handlers

Important gaps:
- document categories are generic only; there is no formal taxonomy for:
  - proof of address
  - driver license
  - company registration
  - contract attachment
  - custom
  - other (named)
- `RequirementType.TEXT` exists in the schema, but the client requirements UI only renders file uploads, so text requirements are currently dead behavior
- vendor defines documents per template, not truly per transaction after creation
- there is no transaction-level requirement editor before sending the link
- no dedicated contract-attachment handling exists
- no explicit “ID by manual photo for basic plan” behavior is wired through the current plan gate if that older rule still remains part of the approved MVP

Required update:
- add a document category enum or structured requirement metadata, for example:
  - `ID`
  - `PROOF_OF_ADDRESS`
  - `DRIVER_LICENSE`
  - `COMPANY_REGISTRATION`
  - `CONTRACT_ATTACHMENT`
  - `CUSTOM`
  - `OTHER`
- if `OTHER`, store a vendor-defined display label
- support `TEXT` requirements properly in the client journey
- add a transaction-level requirement editor in `/vendor/actions` before the link is launched
- keep checklist templates as defaults, but allow per-transaction overrides

### 5. KYC Handling

Required by spec:
- KYC handled by Stripe Identity
- for basic plan / basic flow, ID can be uploaded manually by picture

Current status: `PARTIAL WITH UPDATED PLAN BASELINE`

What exists now:
- manual KYC upload route exists
- Stripe Identity start route exists
- vendor transaction detail already has KYC review surfaces
- KYC quotas are already implemented in plan logic:
  - Starter: `1`
  - Pro: `10`
  - Business: `25`
  - Enterprise: unlimited/custom

Current assessment:
- `getKycLimit()` is already aligned with the current approved plan baseline, including `Starter = 1 KYC`
- `getKycProvider()` currently returns `stripe_identity`
- that provider behavior is only a gap if the older written rule “basic plan = manual picture upload” is still authoritative

Required update:
- keep the current quota model as the audit baseline:
  - Starter: `1`
  - Pro: `10`
  - Business: `25`
  - Enterprise: unlimited/custom
- confirm the provider rule explicitly in product docs:
  - if Starter should continue using the current KYC entitlement model as implemented, no quota change is needed
  - only split provider behavior by plan if the older “basic plan = manual picture upload” rule still applies
- ensure client KYC step, vendor review UI, and public/pricing copy all describe the final approved KYC behavior consistently

### 6. Payment & Deposit Decision Rules

Required by spec:
- deposit decision remains manual by vendor
- vendor can:
  - full capture
  - partial capture
  - release
- payment can be triggered by vendor:
  - just after signing
  - or after the service
- conditions:
  - contract must be signed
  - payment must be authorized
- no fee on standard payments
- fee only on captured deposits
- full audit trail required

Current status: `PARTIAL`

What exists now:
- deposit full capture / partial capture / release already exist
- dispute flow and deposit freeze behavior already exist
- transaction events, payment records, deposit records, and emails already provide a good audit base
- contract/signature gating already happens before the client payment step

Critical gaps:
- vendor cannot choose `after signing` vs `after service`
- finance timing is hardcoded by the system
- hybrid flow is hardcoded to:
  - deposit authorization first
  - service payment second
- customer flow currently expects finance completion inside the same onboarding journey
- transaction launch currently requires a service amount or deposit amount up front
- there is no vendor-side “trigger service payment later” action after service completion
- no fee model is implemented for captured deposits
- no persisted fee breakdown exists for:
  - Stripe fee
  - platform margin
  - vendor net
- no Stripe application-fee implementation exists in the current payment/capture logic

Required update:
- add a finance timing field, for example:
  - `paymentCollectionTiming = AFTER_SIGNING | AFTER_SERVICE`
- separate contract completion from service-payment completion
- allow transaction creation even when service payment is deferred to a vendor-triggered post-service action
- keep deposit authorization optional and independent
- add a vendor action to trigger the service payment request later
- add persisted fee fields on the captured-deposit side, for example:
  - `stripeFeeAmount`
  - `platformFeeAmount`
  - `netVendorAmount`
- confirm the Stripe Connect charge architecture for the required platform margin before implementation

### 7. Audit Trail

Required by spec:
- full audit trail

Current status: `MOSTLY PRESENT, BUT INCOMPLETE FOR CONTRACT ARTIFACTS AND FEES`

What exists now:
- `TransactionEvent`
- `AuditLog`
- `WebhookEvent`
- `Payment`
- `DepositAuthorization`
- `SignatureRecord` with IP and timestamp

What is missing:
- immutable contract snapshot history
- final signed PDF artifact metadata
- fee breakdown ledger for captured deposits
- explicit event trail for:
  - vendor-triggered payment request timing
  - final signed PDF generation
  - contract snapshot creation/version

## Recommended Implementation Plan

### Phase 0 — Lock Product Decisions

Before any code work, lock these decisions:
- canonical signable contract source for MVP:
  - recommended: web-authored template as the only signable contract source
  - PDF/Word remain attachments unless you want a larger document-engine scope
- basic-plan KYC behavior:
  - current baseline is `Starter = 1 KYC`; only revisit provider behavior if the older manual-upload note is still required
- service payment timing semantics:
  - after signing
  - after service
- captured deposit fee model:
  - exact Stripe fee assumptions
  - exact 0.5% Conntrazy margin behavior

### Phase 1 — Data Model Hardening

Required schema updates:
- `VendorProfile`
  - add first/last owner name
  - add registration/VAT fields
- `ClientProfile`
  - add first name, last name, address, country
- add transaction-level client field configuration
- add transaction-level contract snapshot/artifact model
- add structured requirement category metadata
- add finance timing fields and captured-fee fields

Migration work:
- backfill current `User.name -> VendorProfile.ownerFirstName/ownerLastName` where possible
- backfill current `ClientProfile.fullName -> firstName/lastName` best effort, or keep compatibility until a manual cleanup pass

### Phase 2 — Vendor Setup and Transaction Authoring

Update vendor workspace:
- vendor profile page must collect all required profile fields
- `/vendor/actions` must let the vendor choose:
  - contract template
  - per-transaction document requirements
  - KYC mode implied by plan
  - payment timing: after signing vs after service
  - deposit amount and service amount independently

Required UX update:
- keep templates as defaults
- add a per-transaction editor before link launch
- snapshot the full transaction contract + requirement configuration at launch

### Phase 3 — Client Intake and Document Flow

Update client profile step:
- split full name into first + last
- add address
- add country
- keep company name conditional when needed

Update documents step:
- support both file requirements and text requirements
- render category-aware labels and help text
- support named `Other`
- distinguish ID/KYC uploads from general supporting documents

### Phase 4 — Contract Rendering, Signature, and Final PDF

Required work:
- render from a transaction snapshot, not from the live mutable template
- include merge fields for signer and signed timestamp
- after signature:
  - generate final rendered agreement
  - embed signature image
  - embed signed date and time
  - generate immutable PDF
  - store asset reference

Vendor/client visibility:
- vendor transaction detail should show:
  - reviewed contract snapshot
  - signature metadata
  - downloadable final signed PDF
- client completion page and completion email should reference the final signed artifact

### Phase 5 — Finance Timing and Payment Orchestration

Required work:
- decouple “customer completed onboarding” from “service payment collected”
- if payment timing is `AFTER_SIGNING`:
  - current model can stay close to the existing flow
- if payment timing is `AFTER_SERVICE`:
  - client flow completes after contract/signature and any required deposit/KYC/doc steps
  - vendor later triggers service payment from the dashboard
  - same transaction remains the single source of truth

Deposit rules:
- keep full capture / partial capture / release
- capture only on authorized hold
- store fee and net breakdown on capture

### Phase 6 — Audit Trail, Emails, and Admin Visibility

Required work:
- record events for:
  - contract snapshot created
  - contract reviewed
  - signature completed
  - final signed PDF generated
  - service payment requested by vendor
  - service payment succeeded
  - deposit authorized / captured / released
- include fee and contract artifact references in admin/vendor audit views
- extend emails to include final agreement artifact access when appropriate

### Phase 7 — Verification and Sign-Off

Definition of done for this contract-flow scope:
- vendor profile fully matches MVP fields
- client form fully matches MVP fields
- vendor can create a transaction from a reusable contract + per-transaction document rules
- contract is snapshotted at send time
- client reviews and signs the transaction-specific contract
- final signed PDF is generated and stored immutably
- required uploads behave by category and plan
- KYC behavior matches the approved baseline, including `Starter = 1 KYC`
- vendor can choose payment timing:
  - after signing
  - after service
- deposit capture / partial capture / release work with fee ledger and audit trail
- vendor and admin have complete traceability

## Recommended Delivery Order

Best implementation order:
1. lock product decisions
2. schema changes and migrations
3. vendor/client field updates
4. contract snapshot + final PDF artifact
5. requirement/category system
6. finance timing split
7. fee ledger and Stripe margin implementation
8. regression and sign-off

## Highest-Risk Areas

The highest-risk items are:
- contract source-format scope creep if PDF/DOCX fill is treated as MVP instead of attachment scope
- historical contract integrity if template snapshotting is not done before further rollout
- finance redesign for `after service` payment timing
- Stripe platform-margin implementation on captured deposits under the current Connect architecture
- KYC provider expectations can still conflict with the older written spec unless the updated `Starter = 1 KYC` baseline is treated as the approved rule

## Bottom Line

The current codebase already has the workflow shell, but it is not yet contract-flow complete against the MVP specification.

The fastest path to a correct end-to-end MVP is:
- fix profile schemas
- add transaction-level contract snapshotting
- generate and store final signed PDF artifacts
- make document requirements category-aware and transaction-editable
- split finance timing so vendors can choose `after signing` or `after service`
- implement captured-deposit fee accounting explicitly
