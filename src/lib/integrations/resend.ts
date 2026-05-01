import { Resend } from "resend"

import { env } from "@/lib/env"

export const resend = new Resend(env.RESEND_API_KEY)

const FROM_EMAIL = "Conntrazy <notifications@conntrazy.com>" // Should be env var in production

export async function sendTransactionCompletedEmail(to: string, clientName: string, vendorName: string, transactionId: string) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === "re_test_key_...") return

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Transaction Completed with ${vendorName}`,
      html: `
        <h2>Hi ${clientName},</h2>
        <p>Your transaction with <strong>${vendorName}</strong> has been successfully completed.</p>
        <p>Transaction ID: ${transactionId}</p>
        <p>If you have any questions, please contact the vendor directly.</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `
    })
  } catch (error) {
    console.error("Failed to send completion email", error)
  }
}

export async function sendVendorDepositAlert(to: string, vendorName: string, clientName: string, amount: number) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === "re_test_key_...") return

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Deposit Authorized - ${clientName}`,
      html: `
        <h2>Hi ${vendorName},</h2>
        <p>A deposit hold of <strong>${(amount / 100).toFixed(2)}</strong> has been successfully authorized by ${clientName}.</p>
        <p>You can manage this hold from your dashboard.</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `
    })
  } catch (error) {
    console.error("Failed to send deposit alert email", error)
  }
}
