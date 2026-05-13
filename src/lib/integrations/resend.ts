import { Resend } from "resend"

import { env } from "@/lib/env"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { getSiteUrl } from "@/lib/site-url"

export const resend = new Resend(env.RESEND_API_KEY)

const FROM_EMAIL = env.RESEND_FROM_EMAIL

function formatEmailMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100)
}

function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

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

export async function sendBulkTransactionLinkEmail(
  to: string,
  vendorName: string,
  transactionTitle: string,
  transactionReference: string,
  secureLink: string,
  locale?: string
) {
  const isFr = locale === "fr"
  const safeVendorName = escapeEmailHtml(vendorName)
  const safeTitle = escapeEmailHtml(transactionTitle)
  const safeReference = escapeEmailHtml(transactionReference)
  const safeLink = escapeEmailHtml(secureLink)

  return deliverEmail({
    to,
    subject: isFr ? `Lien sécurisé — ${vendorName}` : `Secure client link - ${vendorName}`,
    html: isFr
      ? `
        <h2>Bonjour,</h2>
        <p><strong>${safeVendorName}</strong> vous a envoyé un flux sécurisé à compléter.</p>
        <p>Transaction : <strong>${safeTitle}</strong></p>
        <p>Référence : <strong>${safeReference}</strong></p>
        <p><a href="${safeLink}" target="_blank" rel="noreferrer">Ouvrir le lien sécurisé</a></p>
        <p>Vous pourrez renseigner votre profil, fournir les documents demandés, vérifier votre identité si nécessaire, signer le contrat et finaliser le paiement depuis ce lien unique.</p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hello,</h2>
        <p><strong>${safeVendorName}</strong> sent you a secure client flow to complete.</p>
        <p>Transaction: <strong>${safeTitle}</strong></p>
        <p>Reference: <strong>${safeReference}</strong></p>
        <p><a href="${safeLink}" target="_blank" rel="noreferrer">Open the secure link</a></p>
        <p>You can complete your profile, provide requested documents, verify identity if needed, sign the agreement, and finish payment from this single link.</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `,
  })
}

export async function sendTransactionCompletedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionId: string,
  signedAgreementUrl?: string | null,
  locale?: string
) {
  const signedAgreementHref = resolveDocumentAssetUrl(signedAgreementUrl, `${transactionId}-signed.pdf`, getSiteUrl())
  const isFr = locale === "fr"

  return deliverEmail({
    to,
    subject: isFr ? `Transaction complétée avec ${vendorName}` : `Transaction Completed with ${vendorName}`,
    html: isFr
      ? `
        <h2>Bonjour ${clientName},</h2>
        <p>Votre transaction avec <strong>${vendorName}</strong> a été complétée avec succès.</p>
        <p>Référence de transaction : ${transactionId}</p>
        ${
          signedAgreementHref
            ? `<p><a href="${signedAgreementHref}" target="_blank" rel="noreferrer">Télécharger votre accord signé</a></p>`
            : ""
        }
        <p>Pour toute question, veuillez contacter le prestataire directement.</p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hi ${clientName},</h2>
        <p>Your transaction with <strong>${vendorName}</strong> has been successfully completed.</p>
        <p>Transaction ID: ${transactionId}</p>
        ${
          signedAgreementHref
            ? `<p><a href="${signedAgreementHref}" target="_blank" rel="noreferrer">Download your signed agreement</a></p>`
            : ""
        }
        <p>If you have any questions, please contact the vendor directly.</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `,
  })
}

export async function sendVendorDepositAlert(to: string, vendorName: string, clientName: string, amount: number, locale?: string) {
  const isFr = locale === "fr"
  return deliverEmail({
    to,
    subject: isFr ? `Dépôt autorisé — ${clientName}` : `Deposit Authorized - ${clientName}`,
    html: isFr
      ? `
        <h2>Bonjour ${vendorName},</h2>
        <p>Un dépôt de garantie de <strong>${(amount / 100).toFixed(2)}</strong> a été autorisé avec succès par ${clientName}.</p>
        <p>Vous pouvez gérer ce dépôt depuis votre tableau de bord.</p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
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
  currency: string,
  action: "released" | "captured",
  locale?: string
) {
  const isFr = locale === "fr"
  const actionLabel = action === "captured" ? "captured" : "released"
  const actionLabelFr = action === "captured" ? "capturé" : "libéré"
  const nextLine =
    action === "captured"
      ? "The held amount has now been converted into a charge."
      : "The held amount has now been released back to the client."
  const nextLineFr =
    action === "captured"
      ? "Le montant retenu a été converti en prélèvement."
      : "Le montant retenu a été libéré et restitué au client."

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt ${actionLabelFr} — ${clientName}` : `Deposit ${actionLabel} - ${clientName}`,
    html: isFr
      ? `
        <h2>Bonjour ${vendorName},</h2>
        <p>Le dépôt de garantie de <strong>${formatEmailMoney(amount, currency)}</strong> pour ${clientName} a été ${actionLabelFr}.</p>
        <p>${nextLineFr}</p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hi ${vendorName},</h2>
        <p>The deposit hold of <strong>${formatEmailMoney(amount, currency)}</strong> for ${clientName} was ${actionLabel}.</p>
        <p>${nextLine}</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `,
  })
}

export async function sendCustomerDepositStatusEmail(
  to: string,
  clientName: string,
  vendorName: string,
  amount: number,
  currency: string,
  action: "released" | "captured",
  locale?: string
) {
  const isFr = locale === "fr"
  const actionLabel = action === "captured" ? "captured" : "released"
  const actionLabelFr = action === "captured" ? "capturé" : "libéré"
  const bodyCopy =
    action === "captured"
      ? `The vendor has captured ${formatEmailMoney(amount, currency)} from your authorized deposit hold.`
      : `The vendor has released your ${formatEmailMoney(amount, currency)} deposit hold. The hold is no longer active in the payment flow.`
  const bodyCopyFr =
    action === "captured"
      ? `Le prestataire a prélevé ${formatEmailMoney(amount, currency)} depuis votre dépôt de garantie autorisé.`
      : `Le prestataire a libéré votre dépôt de garantie de ${formatEmailMoney(amount, currency)}. Le dépôt n'est plus actif.`

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt ${actionLabelFr} — ${vendorName}` : `Deposit ${actionLabel} - ${vendorName}`,
    html: isFr
      ? `
        <h2>Bonjour ${clientName},</h2>
        <p>${bodyCopyFr}</p>
        <p>Prestataire : <strong>${vendorName}</strong></p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hi ${clientName},</h2>
        <p>${bodyCopy}</p>
        <p>Vendor: <strong>${vendorName}</strong></p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `,
  })
}

export async function sendDeferredServicePaymentRequestEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionReference: string,
  amount: number,
  currency: string,
  paymentUrl: string,
  locale?: string
) {
  const isFr = locale === "fr"
  return deliverEmail({
    to,
    subject: isFr ? `Paiement demandé — ${vendorName}` : `Payment requested — ${vendorName}`,
    html: isFr
      ? `
        <h2>Bonjour ${clientName},</h2>
        <p>${vendorName} a demandé le paiement du service pour la transaction <strong>${transactionReference}</strong>.</p>
        <p>Montant dû : <strong>${formatEmailMoney(amount, currency)}</strong></p>
        <p><a href="${paymentUrl}" target="_blank" rel="noreferrer">Ouvrir le lien de paiement sécurisé</a></p>
        <p>Les autres détails de votre accord restent inchangés. Utilisez le même flux sécurisé pour finaliser le paiement.</p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hi ${clientName},</h2>
        <p>${vendorName} has now requested the service payment for transaction <strong>${transactionReference}</strong>.</p>
        <p>Amount due: <strong>${formatEmailMoney(amount, currency)}</strong></p>
        <p><a href="${paymentUrl}" target="_blank" rel="noreferrer">Open the secure payment link</a></p>
        <p>The rest of your agreement details remain unchanged. Use the same secure flow to complete the payment step.</p>
        <br />
        <p>Thanks,<br />The Conntrazy Team</p>
      `,
  })
}

export async function sendAdminDisputeAlert(
  adminEmail: string,
  vendorName: string,
  clientName: string,
  transactionRef: string,
  summary: string,
  disputeId: string
) {
  return deliverEmail({
    to: adminEmail,
    subject: `[Action Required] Dispute opened — ${vendorName}`,
    html: `
      <h2>A new dispute requires your review</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#666">Vendor</td><td style="padding:6px 0;font-weight:600">${vendorName}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Client</td><td style="padding:6px 0">${clientName}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Transaction</td><td style="padding:6px 0">${transactionRef}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Dispute ID</td><td style="padding:6px 0;font-family:monospace">${disputeId}</td></tr>
      </table>
      <div style="margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px">
        <p style="margin:0;font-size:14px;color:#92400e"><strong>Vendor's statement:</strong><br/>${summary}</p>
      </div>
      <p>The deposit hold remains active until you make a decision.</p>
      <p>Log in to the admin dashboard to review and resolve this dispute.</p>
      <br />
      <p>— Contrazy Platform</p>
    `,
  })
}

export async function sendVendorDisputeResolved(
  to: string,
  vendorName: string,
  clientName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string
) {
  const won = outcome === "vendor_wins"

  return deliverEmail({
    to,
    subject: `Dispute resolved — ${won ? "Decision in your favour" : "Decision in client's favour"}`,
    html: `
      <h2>Hi ${vendorName},</h2>
      <p>The dispute regarding your transaction with <strong>${clientName}</strong> has been resolved.</p>
      <div style="margin:16px 0;padding:12px 16px;background:${won ? "#f0fdf4" : "#fff7ed"};border-left:4px solid ${won ? "#22c55e" : "#f97316"};border-radius:4px">
        <p style="margin:0;font-size:14px"><strong>Outcome:</strong> ${won ? "Decision in your favour — the deposit has been captured." : "Decision in the client's favour — the deposit has been released."}</p>
        ${resolution ? `<p style="margin:8px 0 0;font-size:13px;color:#555"><strong>Admin note:</strong> ${resolution}</p>` : ""}
      </div>
      <br />
      <p>— Contrazy Platform</p>
    `,
  })
}

export async function sendClientDisputeResolved(
  to: string,
  clientName: string,
  vendorName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string
) {
  const won = outcome === "client_wins"

  return deliverEmail({
    to,
    subject: `Dispute resolved — ${vendorName}`,
    html: `
      <h2>Hi ${clientName},</h2>
      <p>The dispute raised by <strong>${vendorName}</strong> regarding your transaction has been resolved.</p>
      <div style="margin:16px 0;padding:12px 16px;background:${won ? "#f0fdf4" : "#fff7ed"};border-left:4px solid ${won ? "#22c55e" : "#f97316"};border-radius:4px">
        <p style="margin:0;font-size:14px"><strong>Outcome:</strong> ${won ? "The deposit hold has been released. No charge was made." : "The vendor's claim was upheld and the deposit was captured."}</p>
        ${resolution ? `<p style="margin:8px 0 0;font-size:13px;color:#555"><strong>Admin note:</strong> ${resolution}</p>` : ""}
      </div>
      <br />
      <p>— Contrazy Platform</p>
    `,
  })
}

export async function sendContactAutoReply(
  to: string,
  firstName: string,
  locale?: string
) {
  const isFr = locale === "fr"
  return deliverEmail({
    to,
    subject: isFr ? "Nous avons bien reçu votre message" : "We've received your message",
    html: isFr
      ? `
        <h2>Bonjour ${firstName},</h2>
        <p>Merci de nous avoir contactés. Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
        <p>Si votre demande est urgente, n'hésitez pas à nous relancer en répondant directement à cet e-mail.</p>
        <br />
        <p>Cordialement,<br />L'équipe Contrazy</p>
      `
      : `
        <h2>Hi ${firstName},</h2>
        <p>Thanks for reaching out. We've received your message and will get back to you as soon as possible.</p>
        <p>If your request is urgent, feel free to follow up by replying directly to this email.</p>
        <br />
        <p>Best regards,<br />The Contrazy Team</p>
      `,
  })
}

export async function sendAdminContactNotification(
  adminEmail: string,
  firstName: string,
  lastName: string,
  senderEmail: string,
  message: string,
  contactId: string,
  locale: string
) {
  return deliverEmail({
    to: adminEmail,
    subject: `[New Contact] ${firstName} ${lastName} — ${senderEmail}`,
    html: `
      <h2>New contact form submission</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#666">Name</td><td style="padding:6px 0;font-weight:600">${firstName} ${lastName}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${senderEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Locale</td><td style="padding:6px 0">${locale.toUpperCase()}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Message ID</td><td style="padding:6px 0;font-family:monospace">${contactId}</td></tr>
      </table>
      <div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:4px solid #6366f1;border-radius:4px">
        <p style="margin:0;font-size:14px;white-space:pre-wrap">${message}</p>
      </div>
      <p>Log in to the admin dashboard to view and reply to this message.</p>
      <br />
      <p>— Contrazy Platform</p>
    `,
  })
}

export async function sendContactReply(
  to: string,
  firstName: string,
  replyText: string,
  originalMessage: string,
  locale?: string
) {
  const isFr = locale === "fr"
  return deliverEmail({
    to,
    subject: isFr ? "Réponse à votre message — Contrazy" : "Reply to your message — Contrazy",
    html: isFr
      ? `
        <h2>Bonjour ${firstName},</h2>
        <p>Merci pour votre message. Voici notre réponse :</p>
        <div style="margin:16px 0;padding:12px 16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px">
          <p style="margin:0;font-size:14px;white-space:pre-wrap">${replyText}</p>
        </div>
        <details style="margin-top:24px">
          <summary style="font-size:12px;color:#9ca3af;cursor:pointer">Votre message original</summary>
          <div style="margin-top:8px;padding:12px;background:#f9fafb;border-radius:4px;font-size:13px;color:#6b7280;white-space:pre-wrap">${originalMessage}</div>
        </details>
        <br />
        <p>Cordialement,<br />L'équipe Contrazy</p>
      `
      : `
        <h2>Hi ${firstName},</h2>
        <p>Thank you for your message. Here is our reply:</p>
        <div style="margin:16px 0;padding:12px 16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px">
          <p style="margin:0;font-size:14px;white-space:pre-wrap">${replyText}</p>
        </div>
        <details style="margin-top:24px">
          <summary style="font-size:12px;color:#9ca3af;cursor:pointer">Your original message</summary>
          <div style="margin-top:8px;padding:12px;background:#f9fafb;border-radius:4px;font-size:13px;color:#6b7280;white-space:pre-wrap">${originalMessage}</div>
        </details>
        <br />
        <p>Best regards,<br />The Contrazy Team</p>
      `,
  })
}

export async function sendCheckOutRequestEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionReference: string,
  checkOutUrl: string,
  locale?: string
) {
  const isFr = locale === "fr"
  return deliverEmail({
    to,
    subject: isFr ? `Check-out demandé — ${vendorName}` : `Check-out requested — ${vendorName}`,
    html: isFr
      ? `
        <h2>Bonjour ${clientName},</h2>
        <p>${vendorName} vous invite à effectuer le check-out pour la transaction <strong>${transactionReference}</strong>.</p>
        <p>Ouvrez le lien sécurisé ci-dessous pour compléter le rapport de fin de service.</p>
        <p><a href="${checkOutUrl}" target="_blank" rel="noreferrer">Accéder au check-out sécurisé</a></p>
        <br />
        <p>Merci,<br />L'équipe Conntrazy</p>
      `
      : `
        <h2>Hi ${clientName},</h2>
        <p>${vendorName} has requested the service check-out for transaction <strong>${transactionReference}</strong>.</p>
        <p>Open the secure link below to complete your end-of-service report.</p>
        <p><a href="${checkOutUrl}" target="_blank" rel="noreferrer">Open the secure check-out link</a></p>
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
