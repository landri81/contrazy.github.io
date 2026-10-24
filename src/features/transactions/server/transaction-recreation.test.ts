import { KycSelfieCheck, KycStatus, type KycVerification } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }))

const { buildReusableKycSeed, canReuseVerifiedKyc } = await import(
  "@/features/transactions/server/transaction-recreation"
)

function sourceWithKyc(overrides: Partial<KycVerification> = {}) {
  const kycVerification: KycVerification = {
    id: "kyc_1",
    transactionId: "tx_source",
    provider: "Stripe Identity",
    status: KycStatus.VERIFIED,
    providerReference: "vs_source",
    summary: null,
    verifiedAt: new Date("2026-10-01T10:00:00.000Z"),
    selfieCheck: KycSelfieCheck.NOT_REQUESTED,
    selfieErrorCode: null,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    ...overrides,
  }

  return { kycVerification }
}

describe("canReuseVerifiedKyc", () => {
  it("does not reuse a verified document-only KYC when the new transaction requires a selfie", () => {
    const source = sourceWithKyc({ selfieCheck: KycSelfieCheck.NOT_REQUESTED })

    expect(canReuseVerifiedKyc(source, true, true)).toBe(false)
    expect(buildReusableKycSeed(source, true, true)).toBeNull()
  })

  it("does not reuse a verified KYC whose selfie did not match when a selfie is required", () => {
    const source = sourceWithKyc({
      selfieCheck: KycSelfieCheck.UNVERIFIED,
      selfieErrorCode: "selfie_face_mismatch",
    })

    expect(canReuseVerifiedKyc(source, true, true)).toBe(false)
  })

  it("reuses a verified KYC with a matched selfie and carries the selfie result over", () => {
    const source = sourceWithKyc({ selfieCheck: KycSelfieCheck.VERIFIED })

    expect(canReuseVerifiedKyc(source, true, true)).toBe(true)
    expect(buildReusableKycSeed(source, true, true)).toEqual({
      provider: "Stripe Identity",
      status: KycStatus.VERIFIED,
      providerReference: "vs_source",
      summary: null,
      verifiedAt: new Date("2026-10-01T10:00:00.000Z"),
      selfieCheck: KycSelfieCheck.VERIFIED,
      selfieErrorCode: null,
    })
  })

  it("keeps the pre-C4 behaviour when no selfie is required", () => {
    const documentOnly = sourceWithKyc({ selfieCheck: KycSelfieCheck.NOT_REQUESTED })
    const withSelfie = sourceWithKyc({ selfieCheck: KycSelfieCheck.VERIFIED })

    expect(canReuseVerifiedKyc(documentOnly, true)).toBe(true)
    expect(canReuseVerifiedKyc(documentOnly, true, false)).toBe(true)
    expect(canReuseVerifiedKyc(withSelfie, true, false)).toBe(true)
    expect(buildReusableKycSeed(documentOnly, true, false)).toMatchObject({
      status: KycStatus.VERIFIED,
      selfieCheck: KycSelfieCheck.NOT_REQUESTED,
    })
  })

  it.each([KycStatus.PENDING, KycStatus.FAILED])("never reuses a %s KYC", (status) => {
    const source = sourceWithKyc({ status, selfieCheck: KycSelfieCheck.VERIFIED })

    expect(canReuseVerifiedKyc(source, true, false)).toBe(false)
    expect(canReuseVerifiedKyc(source, true, true)).toBe(false)
    expect(buildReusableKycSeed(source, true, true)).toBeNull()
  })

  it("never reuses when the new transaction does not require KYC or there is no source KYC", () => {
    expect(canReuseVerifiedKyc(sourceWithKyc(), false)).toBe(false)
    expect(canReuseVerifiedKyc(null, true)).toBe(false)
    expect(canReuseVerifiedKyc({ kycVerification: null }, true, true)).toBe(false)
  })
})
