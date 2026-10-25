import { createHash } from "node:crypto"

import nextEnv from "@next/env"
import bcrypt from "bcryptjs"
import { PrismaClient, RequirementType, StripeConnectionStatus, UserRole, VendorStatus } from "@prisma/client"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const prisma = new PrismaClient()
const password = "Passw0rd!Passw0rd!"
// Test-mode partner API key of the approved vendor (synthetic, E2E database only).
const partnerApiKey = `cz_test_${"E2eKey".padEnd(32, "0")}`

async function createUserWithVendor({
  userId,
  vendorId,
  name,
  email,
  businessName,
  reviewStatus,
  stripeConnectionStatus = StripeConnectionStatus.NOT_CONNECTED,
}) {
  const passwordHash = await bcrypt.hash(password, 12)

  return prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      passwordHash,
      role: UserRole.VENDOR,
      vendorProfile: {
        create: {
          id: vendorId,
          businessName,
          businessEmail: email,
          supportEmail: `support+${vendorId}@contrazy.test`,
          businessPhone: "+33123456789",
          businessAddress: "1 Conntrazy Street",
          businessCountry: "France",
          reviewStatus,
          stripeConnectionStatus,
        },
      },
    },
    include: {
      vendorProfile: true,
    },
  })
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        in: [
          "e2e-admin@contrazy.test",
          "e2e-pending@contrazy.test",
          "e2e-review-pending@contrazy.test",
          "e2e-approved@contrazy.test",
          "e2e-foreign@contrazy.test",
        ],
      },
    },
  })

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "e2e-admin@contrazy.test",
          "e2e-pending@contrazy.test",
          "e2e-review-pending@contrazy.test",
          "e2e-approved@contrazy.test",
          "e2e-foreign@contrazy.test",
        ],
      },
    },
  })

  const admin = await prisma.user.create({
    data: {
      id: "e2e-admin-user",
      name: "E2E Admin",
      email: "e2e-admin@contrazy.test",
      passwordHash,
      role: UserRole.ADMIN,
    },
  })

  const pendingVendorUser = await createUserWithVendor({
    userId: "e2e-pending-user",
    vendorId: "e2e-pending-vendor",
    name: "Pending Vendor",
    email: "e2e-pending@contrazy.test",
    businessName: "Pending Cars",
    reviewStatus: VendorStatus.PENDING,
  })

  await createUserWithVendor({
    userId: "e2e-review-user",
    vendorId: "e2e-review-vendor",
    name: "Review Pending Vendor",
    email: "e2e-review-pending@contrazy.test",
    businessName: "Review Queue Cars",
    reviewStatus: VendorStatus.PENDING,
  })

  const approvedVendorUser = await createUserWithVendor({
    userId: "e2e-approved-user",
    vendorId: "e2e-approved-vendor",
    name: "Approved Vendor",
    email: "e2e-approved@contrazy.test",
    businessName: "Approved Rentals",
    reviewStatus: VendorStatus.APPROVED,
  })

  const foreignVendorUser = await createUserWithVendor({
    userId: "e2e-foreign-user",
    vendorId: "e2e-foreign-vendor",
    name: "Foreign Vendor",
    email: "e2e-foreign@contrazy.test",
    businessName: "Foreign Fleet",
    reviewStatus: VendorStatus.APPROVED,
  })

  const approvedContract = await prisma.contractTemplate.create({
    data: {
      id: "e2e-approved-contract",
      vendorId: approvedVendorUser.vendorProfile.id,
      name: "Standard Vehicle Agreement",
      description: "Reusable agreement for end-to-end browser tests.",
      content: "Agreement between {{vendorName}} and {{clientName}} for reference {{transactionReference}}.",
    },
  })

  const foreignContract = await prisma.contractTemplate.create({
    data: {
      id: "e2e-foreign-contract",
      vendorId: foreignVendorUser.vendorProfile.id,
      name: "Foreign Contract",
      content: "Do not attach this template to another vendor.",
    },
  })

  const foreignChecklist = await prisma.checklistTemplate.create({
    data: {
      id: "e2e-foreign-checklist",
      vendorId: foreignVendorUser.vendorProfile.id,
      name: "Foreign Checklist",
    },
  })

  const flowTransaction = await prisma.transaction.create({
    data: {
      id: "e2e-client-flow-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-FLOW",
      title: "E2E Client Flow",
      kind: "HYBRID",
      status: "LINK_SENT",
      requiresKyc: false,
      contractTemplateId: approvedContract.id,
      notes: "Seeded browser test flow",
      link: {
        create: {
          id: "e2e-client-flow-link",
          token: "e2e-client-flow",
          shortCode: "E2EFLOW",
          qrCodeSvg: "<svg></svg>",
        },
      },
      requirements: {
        create: {
          id: "e2e-client-flow-requirement",
          label: "Government ID",
          instructions: "Upload a photo or PDF of the ID document.",
          type: RequirementType.DOCUMENT,
          required: true,
        },
      },
    },
  })

  const kycTransaction = await prisma.transaction.create({
    data: {
      id: "e2e-kyc-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-KYC",
      title: "E2E KYC Flow",
      kind: "PAYMENT",
      status: "LINK_SENT",
      requiresKyc: true,
      contractTemplateId: approvedContract.id,
      link: {
        create: {
          id: "e2e-kyc-link",
          token: "e2e-kyc-flow",
          shortCode: "E2EKYC",
          qrCodeSvg: "<svg></svg>",
        },
      },
      requirements: {
        create: {
          id: "e2e-kyc-requirement",
          label: "Identity document",
          instructions: "Upload the identity document before the verification step.",
          type: RequirementType.DOCUMENT,
          required: true,
        },
      },
    },
  })

  const webhookTransaction = await prisma.transaction.create({
    data: {
      id: "e2e-webhook-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-WEBHOOK",
      title: "E2E Webhook Flow",
      kind: "PAYMENT",
      status: "SIGNED",
      amount: 25000,
      requiresKyc: false,
      notes: "Seeded webhook replay transaction",
    },
  })

  // Vendor pages sit behind an active platform plan (requireSubscribedVendorProfileAccess).
  await prisma.vendorSubscription.create({
    data: {
      vendorId: approvedVendorUser.vendorProfile.id,
      planKey: "PRO",
      billingInterval: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
    },
  })

  // Partner API (C2/C3): return links may point back to LOCAZ; one test key with every scope.
  await prisma.vendorProfile.update({
    where: { id: approvedVendorUser.vendorProfile.id },
    data: { partnerAllowedOrigins: ["https://locaz.co"] },
  })
  await prisma.partnerApiKey.create({
    data: {
      vendorId: approvedVendorUser.vendorProfile.id,
      name: "E2E key",
      prefix: partnerApiKey.slice(0, 16),
      hashedKey: createHash("sha256").update(partnerApiKey, "utf8").digest("hex"),
      scopes: ["bookings:read", "bookings:write", "charges:write", "webhooks:write"],
      mode: "TEST",
    },
  })

  // Card security (C5a): two partner bookings waiting at the card step (profile done, nothing to pay now).
  // The vendor needs a connected account id for the card routes; it is never called (no real Stripe in E2E).
  await prisma.vendorProfile.update({
    where: { id: approvedVendorUser.vendorProfile.id },
    data: { stripeAccountId: "acct_e2e_approved" },
  })
  for (const [suffix, locale] of [["", "fr"], ["-en", "en"]]) {
    const profile = await prisma.clientProfile.create({
      data: {
        vendorId: approvedVendorUser.vendorProfile.id,
        fullName: "Alice Martin",
        firstName: "Alice",
        lastName: "Martin",
        email: `alice.card${suffix}@locaz.test`,
        phone: "+33612345678",
        address: "1 rue de la Paix, 06000 Nice",
        country: "France",
        birthCity: "Nice",
        birthDate: new Date("1990-04-12"),
      },
    })
    await prisma.transaction.create({
      data: {
        id: `e2e-card-security-transaction${suffix}`,
        vendorId: approvedVendorUser.vendorProfile.id,
        clientProfileId: profile.id,
        reference: `TX-E2E-CARD${suffix.toUpperCase()}`,
        title: "Peugeot 208 rental",
        kind: "HYBRID",
        status: "LINK_SENT",
        requiresKyc: false,
        locale,
        source: "PARTNER_API",
        externalRef: `LZ-E2E-CARD${suffix.toUpperCase()}`,
        stepSwitches: { identity: false, selfie: false, documents: false, contract: false, checkIn: false, checkOut: false, payment: false, cardSecurity: true, hold: false },
        link: {
          create: {
            id: `e2e-card-security-link${suffix}`,
            token: `e2e-card-security${suffix}`,
            shortCode: `E2ECARD${suffix ? "EN" : "FR"}`,
            qrCodeSvg: "<svg></svg>",
          },
        },
      },
    })
  }

  // A partner booking whose card is already saved (C5c: return date, window, detach rules). Synthetic Stripe ids.
  const securedCustomer = await prisma.partnerCustomer.create({
    data: { vendorId: approvedVendorUser.vendorProfile.id, email: "alice.secured@locaz.test", name: "Alice Secured", stripeCustomerId: "cus_e2e_secured" },
  })
  await prisma.transaction.create({
    data: {
      id: "e2e-card-secured-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-CARD-OK",
      title: "Peugeot 208 rental",
      kind: "HYBRID",
      status: "COMPLETED",
      requiresKyc: false,
      locale: "fr",
      source: "PARTNER_API",
      externalRef: "LZ-E2E-CARD-OK",
      stepSwitches: { identity: false, selfie: false, documents: false, contract: false, checkIn: false, checkOut: false, payment: false, cardSecurity: true, hold: false },
      cardSecurity: {
        create: {
          partnerCustomerId: securedCustomer.id,
          stripeCustomerId: securedCustomer.stripeCustomerId,
          status: "SECURED",
          setupIntentId: "seti_e2e_secured",
          paymentMethodId: "pm_e2e_secured",
          cardBrand: "visa",
          cardLast4: "4242",
          securedAt: new Date("2026-11-01T10:00:00.000Z"),
        },
      },
    },
  })

  // A partner booking the customer has finished: the completion screen links back to LOCAZ.
  await prisma.transaction.create({
    data: {
      id: "e2e-partner-complete-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-PARTNER-DONE",
      title: "Peugeot 208 rental",
      kind: "HYBRID",
      status: "COMPLETED",
      requiresKyc: false,
      locale: "fr",
      source: "PARTNER_API",
      externalRef: "LZ-E2E-0002",
      returnUrl: "https://locaz.co/account/bookings/LZ-E2E-0002",
      stepSwitches: { identity: false, selfie: false, documents: false, contract: false, checkIn: false, checkOut: false, payment: false, cardSecurity: false, hold: false },
      link: {
        create: {
          id: "e2e-partner-complete-link",
          token: "e2e-partner-complete",
          shortCode: "E2EPDONE",
          qrCodeSvg: "<svg></svg>",
        },
      },
    },
  })

  const partnerTransaction = await prisma.transaction.create({
    data: {
      id: "e2e-partner-booking-transaction",
      vendorId: approvedVendorUser.vendorProfile.id,
      reference: "TX-E2E-PARTNER",
      title: "Peugeot 208 rental",
      kind: "HYBRID",
      status: "LINK_SENT",
      amount: 15000,
      depositAmount: 80000,
      requiresKyc: false,
      contractTemplateId: approvedContract.id,
      source: "PARTNER_API",
      externalRef: "LZ-E2E-0001",
      startAt: new Date("2026-11-02T08:00:00.000Z"),
      endAt: new Date("2026-11-05T17:00:00.000Z"),
      timezone: "Europe/Paris",
      stepSwitches: { identity: false, selfie: false, documents: true, contract: true, checkIn: false, checkOut: false, payment: true, cardSecurity: false, hold: true },
      rentalDetails: {
        vehicle: { model: "Peugeot 208", plate: "AB-123-CD", category: "Compact" },
        pickup: { place: "Nice Airport T2", address: "Rue Costes et Bellonte, 06200 Nice" },
        return: { place: "Nice Airport T2" },
        mileage: { unlimited: false, includedKm: 900, extraKmPrice: 25 },
        options: ["Child seat", "Additional driver"],
        protection: "Standard protection",
        deductible: 120000,
        deposit: 80000,
        fuelPolicy: "Full to full",
        priceLines: [
          { label: "Rental", quantity: 3, unit: "days", unitAmount: 4500, total: 13500 },
          { label: "Child seat", quantity: 1, unitAmount: 1500, total: 1500 },
        ],
      },
    },
  })

  console.log(
    JSON.stringify(
      {
        admin: admin.email,
        vendorPassword: password,
        pendingVendor: pendingVendorUser.email,
        approvedVendor: approvedVendorUser.email,
        foreignTemplateId: foreignContract.id,
        foreignChecklistId: foreignChecklist.id,
        clientFlowToken: flowTransaction.link?.token ?? "e2e-client-flow",
        kycFlowToken: kycTransaction.link?.token ?? "e2e-kyc-flow",
        webhookTransactionId: webhookTransaction.id,
        partnerTransactionId: partnerTransaction.id,
        partnerCompleteToken: "e2e-partner-complete",
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
