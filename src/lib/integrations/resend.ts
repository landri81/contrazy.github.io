import { Resend } from "resend"

import { env } from "@/lib/env"

export const resend = new Resend(env.RESEND_API_KEY)

const FROM_EMAIL = env.RESEND_FROM_EMAIL

async function deliverEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === "re_test_key_...") {
    return false
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })

    return true
  } catch (error) {
    console.error("Failed to send email", error)
    return false
  }
}

export async function sendTransactionCompletedEmail(to: string, clientName: string, vendorName: string, transactionId: string) {
  return deliverEmail({
    to,
    subject: `Transaction Completed with ${vendorName}`,
    html: `
      <h2>Hi ${clientName},</h2>
      <p>Your transaction with <strong>${vendorName}</strong> has been successfully completed.</p>
      <p>Transaction ID: ${transactionId}</p>
      <p>If you have any questions, please contact the vendor directly.</p>
      <br />
      <p>Thanks,<br />The Conntrazy Team</p>
    `,
  })
}

export async function sendVendorDepositAlert(to: string, vendorName: string, clientName: string, amount: number) {
  return deliverEmail({
    to,
    subject: `Deposit Authorized - ${clientName}`,
    html: `
      <h2>Hi ${vendorName},</h2>
      <p>A deposit hold of <strong>${(amount / 100).toFixed(2)}</strong> has been successfully authorized by ${clientName}.</p>
      <p>You can manage this hold from your dashboard.</p>
      <br />
      <p>Thanks,<br />The Conntrazy Team</p>
    `,
  })
}

export async function sendVendorDepositStatusEmail(
  to: string,
  vendorName: string,
  clientName: string,
  amount: number,
  action: "released" | "captured"
) {
  const actionLabel = action === "captured" ? "captured" : "released"
  const nextLine =
    action === "captured"
      ? "The held amount has now been converted into a charge."
      : "The held amount has now been released back to the client."

  return deliverEmail({
    to,
    subject: `Deposit ${actionLabel} - ${clientName}`,
    html: `
      <h2>Hi ${vendorName},</h2>
      <p>The deposit hold of <strong>${(amount / 100).toFixed(2)}</strong> for ${clientName} was ${actionLabel}.</p>
      <p>${nextLine}</p>
      <br />
      <p>Thanks,<br />The Conntrazy Team</p>
    `,
  })
}

export async function sendVendorReviewStatusEmail(
  to: string,
  businessName: string,
  reviewStatus: "APPROVED" | "REJECTED" | "SUSPENDED"
) {
  const readableStatus = reviewStatus.toLowerCase()
  const bodyCopy =
    reviewStatus === "APPROVED"
      ? "Your business profile is approved and ready to move into live setup."
      : reviewStatus === "REJECTED"
        ? "Your business profile was rejected. Please review your details and contact support if needed."
        : "Your business profile has been suspended. Please contact support before continuing operations."

  return deliverEmail({
    to,
    subject: `Conntrazy account ${readableStatus}`,
    html: `
      <h2>Hi ${businessName},</h2>
      <p>${bodyCopy}</p>
      <br />
      <p>Thanks,<br />The Conntrazy Team</p>
    `,
  })
}
