import nextEnv from "@next/env"
import bcrypt from "bcryptjs"
import { PrismaClient, RequirementType, StripeConnectionStatus, UserRole, VendorStatus } from "@prisma/client"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const prisma = new PrismaClient()
const password = "Passw0rd!Passw0rd!"

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
