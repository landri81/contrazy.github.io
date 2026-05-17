import { Resend } from "resend"

import { env } from "@/lib/env"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { getSiteUrl } from "@/lib/site-url"

export const resend = new Resend(env.RESEND_API_KEY)

const FROM_EMAIL = env.RESEND_FROM_EMAIL

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatEmailMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function deliverEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === "re_test_key_...") return false
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
    return true
  } catch (error) {
    console.error("Failed to send email", error)
    return false
  }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function emailHeader(siteUrl: string, vendorLogoUrl?: string | null, vendorName?: string | null): string {
  const contrazyLogo = "https://contrazy.com/logo/logo-contrazy-white.png"
  if (vendorLogoUrl && vendorName) {
    return `<tr>
      <td style="background:#0c1e2f;padding:20px 32px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="vertical-align:middle">
            <img src="${escapeHtml(vendorLogoUrl)}" height="36" style="max-width:110px;height:36px;object-fit:contain;border-radius:6px;background:#ffffff;padding:4px 8px;display:block" alt="${escapeHtml(vendorName)}" />
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 14px">
            <span style="color:#3a5a7a;font-size:20px;font-weight:200;line-height:1">+</span>
          </td>
          <td style="text-align:right;vertical-align:middle">
            <img src="${escapeHtml(contrazyLogo)}" height="22" alt="Contrazy" style="max-width:110px;display:block;margin-left:auto" />
            <div style="font-size:9px;color:#3a5a7a;margin-top:5px;letter-spacing:0.1em;text-transform:uppercase;text-align:right">Powered by Contrazy</div>
          </td>
        </tr></table>
      </td>
    </tr>`
  }
  return `<tr>
    <td style="background:#0c1e2f;padding:20px 32px">
      <img src="${escapeHtml(contrazyLogo)}" height="28" alt="Contrazy" style="max-width:130px;display:block" />
    </td>
  </tr>`
}

function buildEmailHtml({
  content,
  siteUrl,
  vendorLogoUrl,
  vendorName,
  locale,
}: {
  content: string
  siteUrl: string
  vendorLogoUrl?: string | null
  vendorName?: string | null
  locale?: string
}): string {
  const isFr = locale === "fr"
  const year = new Date().getFullYear()
  const contrazyLogoDark = "https://contrazy.com/logo/logo-contrazy-dark.png"
  const footerNote = isFr
    ? `© ${year} Contrazy — Tous droits réservés. Cet e-mail vous a été envoyé dans le cadre d'une transaction Contrazy.`
    : `© ${year} Contrazy — All rights reserved. This email was sent as part of a Contrazy transaction.`

  return `<!DOCTYPE html>
<html lang="${isFr ? "fr" : "en"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Contrazy</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(12,30,47,0.10)">
  ${emailHeader(siteUrl, vendorLogoUrl, vendorName)}
  <tr>
    <td style="background:#ffffff;padding:36px 32px 40px">
      ${content}
    </td>
  </tr>
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center">
      <img src="${escapeHtml(contrazyLogoDark)}" height="16" alt="Contrazy" style="opacity:0.3;display:block;margin:0 auto 10px" />
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7">${footerNote}</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function ctaButton(label: string, href: string, bg = "#0d9488"): string {
  return `<p style="text-align:center;margin:28px 0 8px">
    <a href="${href}" target="_blank" rel="noreferrer" style="display:inline-block;background:${bg};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.01em">${label}</a>
  </p>`
}

function detailTable(rows: [string, string][]): string {
  const inner = rows
    .map(
      ([label, value], i) =>
        `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#f1f5f9"}">
          <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap;width:38%">${label}</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0f172a">${value}</td>
        </tr>`
    )
    .join("")
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:20px 0;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">${inner}</table>`
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 18px;font-size:22px;font-weight:700;color:#0c1e2f;letter-spacing:-0.01em">${text}</h2>`
}

function greet(name: string, isFr: boolean): string {
  return h2(isFr ? `Bonjour ${name},` : `Hi ${name},`)
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.65">${text}</p>`
}

function alertBox(text: string, bg: string, border: string): string {
  return `<div style="margin:20px 0;padding:14px 16px;background:${bg};border-left:4px solid ${border};border-radius:8px;font-size:14px;color:#334155;line-height:1.65">${text}</div>`
}

// ─── Email functions ───────────────────────────────────────────────────────────

/** Notifies the superadmin that a vendor has submitted / updated their profile for review. Always in French. */
export async function sendAdminVendorProfileSubmittedEmail(
  adminEmail: string,
  vendorBusinessName: string,
  vendorEmail: string,
  userId: string,
  isFirstSubmission: boolean
) {
  const siteUrl = getSiteUrl()
  const reviewUrl = `${siteUrl}/fr/admin/users/${userId}`
  const tag = isFirstSubmission ? "[Nouveau prestataire]" : "[Profil mis à jour]"

  const content = [
    h2("Nouveau profil prestataire en attente de validation"),
    detailTable([
      ["Entreprise", escapeHtml(vendorBusinessName)],
      ["Email", escapeHtml(vendorEmail)],
      ["Statut", isFirstSubmission ? "Première soumission" : "Profil mis à jour"],
    ]),
    p("Ce prestataire attend votre approbation pour pouvoir connecter Stripe et commencer à envoyer des transactions à ses clients."),
    ctaButton("Examiner le profil prestataire", reviewUrl, "#0c1e2f"),
  ].join("")

  return deliverEmail({
    to: adminEmail,
    subject: `${tag} ${vendorBusinessName} — validation requise`,
    html: buildEmailHtml({ content, siteUrl, locale: "fr" }),
  })
}

/** Notifies the superadmin that a new vendor has signed up. Always in French. */
export async function sendAdminNewVendorSignupEmail(
  adminEmail: string,
  vendorName: string,
  vendorEmail: string,
  userId: string
) {
  const siteUrl = getSiteUrl()
  const reviewUrl = `${siteUrl}/fr/admin/users/${userId}`

  const content = [
    h2("Nouveau prestataire inscrit"),
    detailTable([
      ["Nom", escapeHtml(vendorName)],
      ["Email", escapeHtml(vendorEmail)],
    ]),
    p("Un nouveau prestataire vient de créer un compte. Son profil est en attente de complétion et de validation."),
    ctaButton("Voir le compte", reviewUrl, "#0c1e2f"),
  ].join("")

  return deliverEmail({
    to: adminEmail,
    subject: `[Inscription] ${vendorName} — ${vendorEmail}`,
    html: buildEmailHtml({ content, siteUrl, locale: "fr" }),
  })
}

export async function sendBulkTransactionLinkEmail(
  to: string,
  vendorName: string,
  transactionTitle: string,
  transactionReference: string,
  secureLink: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const isFr = locale === "fr"
  const siteUrl = getSiteUrl()
  const safeVendorName = escapeHtml(vendorName)
  const safeTitle = escapeHtml(transactionTitle)
  const safeRef = escapeHtml(transactionReference)

  const content = isFr
    ? [
        greet("", isFr).replace("Bonjour ,", "Bonjour,"),
        p(`<strong>${safeVendorName}</strong> vous a envoyé un dossier sécurisé à compléter.`),
        detailTable([
          ["Transaction", safeTitle],
          ["Référence", safeRef],
        ]),
        p("Depuis ce lien unique, vous pouvez renseigner votre profil, fournir les documents demandés, vérifier votre identité, signer le contrat et finaliser le paiement."),
        ctaButton("Ouvrir le dossier sécurisé", secureLink),
        p(`<span style="font-size:12px;color:#94a3b8">Si vous n'attendiez pas ce message, vous pouvez ignorer cet e-mail en toute sécurité.</span>`),
      ].join("")
    : [
        h2("You have a secure client flow to complete"),
        p(`<strong>${safeVendorName}</strong> has sent you a secure flow to complete.`),
        detailTable([
          ["Transaction", safeTitle],
          ["Reference", safeRef],
        ]),
        p("From this single secure link you can fill in your profile, provide requested documents, verify your identity, sign the agreement, and complete payment."),
        ctaButton("Open secure link", secureLink),
        p(`<span style="font-size:12px;color:#94a3b8">If you weren't expecting this, you can safely ignore this email.</span>`),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Dossier sécurisé — ${vendorName}` : `Secure client link — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendTransactionCompletedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionId: string,
  signedAgreementUrl?: string | null,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const signedHref = resolveDocumentAssetUrl(signedAgreementUrl, `${transactionId}-signed.pdf`, siteUrl)
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`Votre transaction avec <strong>${safeVendor}</strong> a été complétée avec succès.`),
        detailTable([["Référence", escapeHtml(transactionId)]]),
        signedHref ? ctaButton("Télécharger votre accord signé", signedHref) : "",
        p("Pour toute question, contactez le prestataire directement."),
        alertBox("Ce document constitue la preuve de votre accord électronique. Conservez-le précieusement.", "#f0fdf4", "#22c55e"),
      ].join("")
    : [
        greet(safeClient, false),
        p(`Your transaction with <strong>${safeVendor}</strong> has been successfully completed.`),
        detailTable([["Reference", escapeHtml(transactionId)]]),
        signedHref ? ctaButton("Download your signed agreement", signedHref) : "",
        p("If you have any questions, please contact the vendor directly."),
        alertBox("This document serves as proof of your electronic agreement. Keep it safe.", "#f0fdf4", "#22c55e"),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Transaction complétée avec ${vendorName}` : `Transaction completed with ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendVendorDepositAlert(
  to: string,
  vendorName: string,
  clientName: string,
  amount: number,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const formatted = formatEmailMoney(amount, "EUR")

  const content = isFr
    ? [
        greet(safeVendor, true),
        p(`Un dépôt de garantie de <strong>${formatted}</strong> a été autorisé par <strong>${safeClient}</strong>.`),
        p("Vous pouvez capturer ou libérer ce dépôt depuis votre tableau de bord."),
        ctaButton("Gérer le dépôt", `${siteUrl}/fr/vendor/transactions`),
        alertBox("Le dépôt expirera automatiquement si aucune action n'est effectuée dans les 7 jours.", "#fef9c3", "#eab308"),
      ].join("")
    : [
        greet(safeVendor, false),
        p(`A deposit hold of <strong>${formatted}</strong> has been successfully authorized by <strong>${safeClient}</strong>.`),
        p("You can capture or release this hold from your vendor dashboard."),
        ctaButton("Manage deposit", `${siteUrl}/en/vendor/transactions`),
        alertBox("The deposit authorization will expire automatically if no action is taken within 7 days.", "#fef9c3", "#eab308"),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt autorisé — ${clientName}` : `Deposit authorized — ${clientName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendVendorDepositStatusEmail(
  to: string,
  vendorName: string,
  clientName: string,
  amount: number,
  currency: string,
  action: "released" | "captured",
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const formatted = formatEmailMoney(amount, currency)
  const isCaptured = action === "captured"

  const content = isFr
    ? [
        greet(safeVendor, true),
        p(`Le dépôt de garantie de <strong>${formatted}</strong> pour <strong>${safeClient}</strong> a été <strong>${isCaptured ? "capturé" : "libéré"}</strong>.`),
        alertBox(
          isCaptured
            ? "Le montant retenu a été converti en prélèvement définitif."
            : "Le montant retenu a été libéré et restitué au client.",
          isCaptured ? "#f0fdf4" : "#fff7ed",
          isCaptured ? "#22c55e" : "#f97316"
        ),
      ].join("")
    : [
        greet(safeVendor, false),
        p(`The deposit hold of <strong>${formatted}</strong> for <strong>${safeClient}</strong> was <strong>${action}</strong>.`),
        alertBox(
          isCaptured
            ? "The held amount has been converted into a permanent charge."
            : "The held amount has been released back to the client.",
          isCaptured ? "#f0fdf4" : "#fff7ed",
          isCaptured ? "#22c55e" : "#f97316"
        ),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr
      ? `Dépôt ${isCaptured ? "capturé" : "libéré"} — ${clientName}`
      : `Deposit ${action} — ${clientName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendCustomerDepositStatusEmail(
  to: string,
  clientName: string,
  vendorName: string,
  amount: number,
  currency: string,
  action: "released" | "captured",
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)
  const isCaptured = action === "captured"

  const content = isFr
    ? [
        greet(safeClient, true),
        p(isCaptured
          ? `Le prestataire <strong>${safeVendor}</strong> a prélevé <strong>${formatted}</strong> depuis votre dépôt de garantie autorisé.`
          : `Votre dépôt de garantie de <strong>${formatted}</strong> avec <strong>${safeVendor}</strong> a été libéré. Le montant ne sera pas prélevé.`),
        alertBox(
          isCaptured
            ? "Ce prélèvement apparaîtra sur votre relevé bancaire dans les prochains jours."
            : "Le montant sera restitué sur votre compte selon les délais de votre banque.",
          isCaptured ? "#fef2f2" : "#f0fdf4",
          isCaptured ? "#ef4444" : "#22c55e"
        ),
      ].join("")
    : [
        greet(safeClient, false),
        p(isCaptured
          ? `Vendor <strong>${safeVendor}</strong> has captured <strong>${formatted}</strong> from your authorized deposit hold.`
          : `Your <strong>${formatted}</strong> deposit hold with <strong>${safeVendor}</strong> has been released. You will not be charged.`),
        alertBox(
          isCaptured
            ? "This charge will appear on your bank statement within a few business days."
            : "The hold has been lifted and funds will return to your account per your bank's timeline.",
          isCaptured ? "#fef2f2" : "#f0fdf4",
          isCaptured ? "#ef4444" : "#22c55e"
        ),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr
      ? `Dépôt ${isCaptured ? "débité" : "libéré"} — ${vendorName}`
      : `Deposit ${action} — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
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
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`<strong>${safeVendor}</strong> a demandé le paiement du service pour la transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
        detailTable([
          ["Prestataire", safeVendor],
          ["Référence", escapeHtml(transactionReference)],
          ["Montant dû", formatted],
        ]),
        ctaButton("Effectuer le paiement", paymentUrl),
        p("Les autres détails de votre accord restent inchangés. Utilisez le même flux sécurisé pour finaliser le paiement."),
      ].join("")
    : [
        greet(safeClient, false),
        p(`<strong>${safeVendor}</strong> has requested the service payment for transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
        detailTable([
          ["Vendor", safeVendor],
          ["Reference", escapeHtml(transactionReference)],
          ["Amount due", formatted],
        ]),
        ctaButton("Complete payment", paymentUrl),
        p("Your agreement details remain unchanged. Use the same secure link to finalize the payment step."),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Paiement demandé — ${vendorName}` : `Payment requested — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

/** Notifies the superadmin about a new dispute. Always in French. */
export async function sendAdminDisputeAlert(
  adminEmail: string,
  vendorName: string,
  clientName: string,
  transactionRef: string,
  summary: string,
  disputeId: string
) {
  const siteUrl = getSiteUrl()
  const disputeUrl = `${siteUrl}/fr/admin`

  const content = [
    h2("⚠️ Litige en attente de votre décision"),
    detailTable([
      ["Prestataire", escapeHtml(vendorName)],
      ["Client", escapeHtml(clientName)],
      ["Transaction", escapeHtml(transactionRef)],
      ["ID du litige", disputeId],
    ]),
    alertBox(`<strong>Déclaration du prestataire :</strong><br />${escapeHtml(summary)}`, "#fffbeb", "#f59e0b"),
    p("Le dépôt de garantie reste bloqué jusqu'à votre décision."),
    ctaButton("Examiner le litige dans le tableau de bord", disputeUrl, "#0c1e2f"),
  ].join("")

  return deliverEmail({
    to: adminEmail,
    subject: `[Action requise] Litige ouvert — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, locale: "fr" }),
  })
}

export async function sendVendorDisputeResolved(
  to: string,
  vendorName: string,
  clientName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const won = outcome === "vendor_wins"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const safeResolution = resolution ? escapeHtml(resolution) : ""

  const content = isFr
    ? [
        greet(safeVendor, true),
        p(`Le litige concernant votre transaction avec <strong>${safeClient}</strong> a été résolu.`),
        alertBox(
          (won
            ? "Décision en votre faveur — le dépôt a été capturé."
            : "Décision en faveur du client — le dépôt a été libéré.") +
            (safeResolution ? `<br /><br /><strong>Note admin :</strong> ${safeResolution}` : ""),
          won ? "#f0fdf4" : "#fff7ed",
          won ? "#22c55e" : "#f97316"
        ),
      ].join("")
    : [
        greet(safeVendor, false),
        p(`The dispute regarding your transaction with <strong>${safeClient}</strong> has been resolved.`),
        alertBox(
          (won
            ? "Decision in your favour — the deposit has been captured."
            : "Decision in the client's favour — the deposit has been released.") +
            (safeResolution ? `<br /><br /><strong>Admin note:</strong> ${safeResolution}` : ""),
          won ? "#f0fdf4" : "#fff7ed",
          won ? "#22c55e" : "#f97316"
        ),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr
      ? `Litige résolu — ${won ? "Décision en votre faveur" : "Décision en faveur du client"}`
      : `Dispute resolved — ${won ? "Decision in your favour" : "Decision in client's favour"}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendClientDisputeResolved(
  to: string,
  clientName: string,
  vendorName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const won = outcome === "client_wins"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const safeResolution = resolution ? escapeHtml(resolution) : ""

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`Le litige soulevé par <strong>${safeVendor}</strong> concernant votre transaction a été résolu.`),
        alertBox(
          (won
            ? "Le dépôt de garantie a été libéré. Aucun prélèvement ne sera effectué."
            : "La réclamation du prestataire a été retenue et le dépôt a été capturé.") +
            (safeResolution ? `<br /><br /><strong>Note admin :</strong> ${safeResolution}` : ""),
          won ? "#f0fdf4" : "#fff7ed",
          won ? "#22c55e" : "#f97316"
        ),
      ].join("")
    : [
        greet(safeClient, false),
        p(`The dispute raised by <strong>${safeVendor}</strong> regarding your transaction has been resolved.`),
        alertBox(
          (won
            ? "The deposit hold has been released. No charge was made."
            : "The vendor's claim was upheld and the deposit was captured.") +
            (safeResolution ? `<br /><br /><strong>Admin note:</strong> ${safeResolution}` : ""),
          won ? "#f0fdf4" : "#fff7ed",
          won ? "#22c55e" : "#f97316"
        ),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Litige résolu — ${vendorName}` : `Dispute resolved — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendContactAutoReply(to: string, firstName: string, locale?: string) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeName = escapeHtml(firstName)

  const content = isFr
    ? [
        greet(safeName, true),
        p("Merci de nous avoir contactés. Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais."),
        p("Si votre demande est urgente, n'hésitez pas à nous relancer en répondant directement à cet e-mail."),
      ].join("")
    : [
        greet(safeName, false),
        p("Thanks for reaching out. We've received your message and will get back to you as soon as possible."),
        p("If your request is urgent, feel free to follow up by replying directly to this email."),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? "Nous avons bien reçu votre message" : "We've received your message",
    html: buildEmailHtml({ content, siteUrl, locale }),
  })
}

/** Notifies the superadmin about a new contact form submission. Always in French. */
export async function sendAdminContactNotification(
  adminEmail: string,
  firstName: string,
  lastName: string,
  senderEmail: string,
  message: string,
  contactId: string,
  locale: string
) {
  const siteUrl = getSiteUrl()

  const content = [
    h2("Nouveau message via le formulaire de contact"),
    detailTable([
      ["Nom", escapeHtml(`${firstName} ${lastName}`)],
      ["Email", escapeHtml(senderEmail)],
      ["Langue", locale.toUpperCase()],
      ["ID message", contactId],
    ]),
    alertBox(escapeHtml(message), "#f8fafc", "#6366f1"),
    ctaButton("Voir dans le tableau de bord admin", `${siteUrl}/fr/admin`),
  ].join("")

  return deliverEmail({
    to: adminEmail,
    subject: `[Nouveau contact] ${firstName} ${lastName} — ${senderEmail}`,
    html: buildEmailHtml({ content, siteUrl, locale: "fr" }),
  })
}

export async function sendContactReply(
  to: string,
  firstName: string,
  replyText: string,
  originalMessage: string,
  locale?: string
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeName = escapeHtml(firstName)

  const content = isFr
    ? [
        greet(safeName, true),
        p("Merci pour votre message. Voici notre réponse :"),
        alertBox(escapeHtml(replyText), "#f0fdf4", "#22c55e"),
        `<details style="margin-top:24px"><summary style="font-size:12px;color:#94a3b8;cursor:pointer">Votre message original</summary>
        <div style="margin-top:8px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#6b7280;white-space:pre-wrap">${escapeHtml(originalMessage)}</div></details>`,
      ].join("")
    : [
        greet(safeName, false),
        p("Thank you for your message. Here is our reply:"),
        alertBox(escapeHtml(replyText), "#f0fdf4", "#22c55e"),
        `<details style="margin-top:24px"><summary style="font-size:12px;color:#94a3b8;cursor:pointer">Your original message</summary>
        <div style="margin-top:8px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#6b7280;white-space:pre-wrap">${escapeHtml(originalMessage)}</div></details>`,
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? "Réponse à votre message — Contrazy" : "Reply to your message — Contrazy",
    html: buildEmailHtml({ content, siteUrl, locale }),
  })
}

export async function sendCheckOutRequestEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionReference: string,
  checkOutUrl: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`<strong>${safeVendor}</strong> vous invite à effectuer le check-out pour la transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
        p("Ouvrez le lien sécurisé ci-dessous pour compléter le rapport de fin de service."),
        ctaButton("Accéder au check-out", checkOutUrl),
      ].join("")
    : [
        greet(safeClient, false),
        p(`<strong>${safeVendor}</strong> has requested the service check-out for transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
        p("Open the link below to complete your end-of-service report."),
        ctaButton("Open check-out", checkOutUrl),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Check-out demandé — ${vendorName}` : `Check-out requested — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendDepositChargedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  amount: number,
  currency: string,
  autoRefundAt: Date | null,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)
  const refundDateStr = autoRefundAt
    ? autoRefundAt.toLocaleDateString(isFr ? "fr-FR" : "en-US", { dateStyle: "long" })
    : null

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`Un dépôt de garantie de <strong>${formatted}</strong> a été débité pour votre transaction avec <strong>${safeVendor}</strong>.`),
        refundDateStr ? alertBox(`Un remboursement automatique sera effectué le <strong>${refundDateStr}</strong> si le prestataire ne décide pas de conserver le dépôt.`, "#fef9c3", "#eab308") : "",
        p("Pour toute question, contactez le prestataire directement."),
      ].join("")
    : [
        greet(safeClient, false),
        p(`A security deposit of <strong>${formatted}</strong> has been charged for your transaction with <strong>${safeVendor}</strong>.`),
        refundDateStr ? alertBox(`An automatic refund will be issued on <strong>${refundDateStr}</strong> unless the vendor decides to keep the deposit.`, "#fef9c3", "#eab308") : "",
        p("If you have any questions, please contact the vendor directly."),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt de garantie débité — ${vendorName}` : `Security deposit charged — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendDepositAutoRefundedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  amount: number,
  currency: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)

  const content = isFr
    ? [
        greet(safeClient, true),
        p(`Votre dépôt de garantie de <strong>${formatted}</strong> avec <strong>${safeVendor}</strong> a été remboursé automatiquement.`),
        alertBox("Le remboursement devrait apparaître sur votre relevé bancaire dans les prochains jours ouvrables.", "#f0fdf4", "#22c55e"),
      ].join("")
    : [
        greet(safeClient, false),
        p(`Your security deposit of <strong>${formatted}</strong> with <strong>${safeVendor}</strong> has been automatically refunded.`),
        alertBox("The refund should appear on your bank statement within the next few business days.", "#f0fdf4", "#22c55e"),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt remboursé — ${vendorName}` : `Security deposit refunded — ${vendorName}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

export async function sendVendorFeeReceiptEmail(
  to: string,
  vendorName: string,
  transactionRef: string,
  feeType: "long_deposit" | "deposit_capture",
  depositAmount: number,
  stripeFee: number,
  platformFee: number,
  currency: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const fmt = (n: number) => formatEmailMoney(n, currency)
  const total = stripeFee + platformFee
  const date = new Date().toLocaleDateString(isFr ? "fr-FR" : "en-US", { dateStyle: "long" })
  const typeLabel = isFr
    ? feeType === "long_deposit" ? "Dépôt longue durée" : "Capture de caution"
    : feeType === "long_deposit" ? "Extended deposit" : "Deposit capture"

  const content = isFr
    ? [
        greet(safeVendor, true),
        p(`Voici le reçu de frais pour la transaction <strong>${escapeHtml(transactionRef)}</strong>.`),
        detailTable([
          ["Date", date],
          ["Type de frais", typeLabel],
          ["Montant du dépôt", fmt(depositAmount)],
          ["Frais Stripe", fmt(stripeFee)],
          ["Frais Contrazy", fmt(platformFee)],
          ["Total frais", fmt(total)],
        ]),
        p(`<span style="font-size:13px;color:#64748b">Ces frais ont été automatiquement collectés lors du traitement du dépôt. Ce reçu est fourni à titre informatif.</span>`),
      ].join("")
    : [
        greet(safeVendor, false),
        p(`Fee receipt for transaction <strong>${escapeHtml(transactionRef)}</strong>.`),
        detailTable([
          ["Date", date],
          ["Fee type", typeLabel],
          ["Deposit amount", fmt(depositAmount)],
          ["Stripe fee", fmt(stripeFee)],
          ["Contrazy fee", fmt(platformFee)],
          ["Total fees", fmt(total)],
        ]),
        p(`<span style="font-size:13px;color:#64748b">These fees were automatically collected during deposit processing. This receipt is provided for your records.</span>`),
      ].join("")

  return deliverEmail({
    to,
    subject: isFr ? `Reçu de frais — ${transactionRef}` : `Fee receipt — ${transactionRef}`,
    html: buildEmailHtml({ content, siteUrl, vendorLogoUrl, vendorName, locale }),
  })
}

function buildCleanEmailHtml(bodyHtml: string, locale?: string): string {
  const isFr = locale === "fr"
  const year = new Date().getFullYear()
  const footerNote = isFr
    ? `© ${year} Contrazy — Tous droits réservés.`
    : `© ${year} Contrazy — All rights reserved.`

  return `<!DOCTYPE html>
<html lang="${isFr ? "fr" : "en"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Contrazy</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td style="padding:40px 32px 24px">
  <table role="presentation" style="max-width:580px;width:100%">
    <tr><td style="padding-bottom:32px">
      <img src="https://contrazy.com/logo/logo-contrazy-dark.png" height="28" alt="Contrazy" style="display:block;max-width:140px" />
    </td></tr>
    <tr><td style="font-size:15px;line-height:1.7;color:#1a1a1a">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding-top:40px;border-top:1px solid #e5e7eb;margin-top:32px">
      <p style="margin:0;font-size:11px;color:#9ca3af">${footerNote}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

function cleanP(text: string): string {
  return `<p style="margin:0 0 16px">${text}</p>`
}

function cleanList(items: string[]): string {
  const lis = items.map((item) => `<li style="margin-bottom:6px">${item}</li>`).join("")
  return `<ul style="margin:0 0 16px;padding-left:20px">${lis}</ul>`
}

function cleanSignature(isFr: boolean): string {
  return `
    <p style="margin:24px 0 12px">${isFr ? "Cordialement," : "Best regards,"}</p>
    <img src="https://contrazy.com/logo/logo-contrazy-dark.png" height="22" alt="Contrazy" style="display:block;max-width:110px" />`
}

export async function sendVendorReviewStatusEmail(
  to: string,
  businessName: string,
  reviewStatus: "APPROVED" | "REJECTED" | "SUSPENDED",
  locale?: string,
  vendorLogoUrl?: string | null,
  ownerFirstName?: string | null
) {
  const isFr = locale === "fr"
  const firstName = escapeHtml(ownerFirstName?.trim() || businessName)
  const company = escapeHtml(businessName)

  if (reviewStatus === "APPROVED") {
    const html = isFr
      ? buildCleanEmailHtml(
          [
            cleanP(`Bonjour ${firstName},`),
            cleanP(`Le profil de votre société <strong>« ${company} »</strong> a bien été créé sur notre plateforme et est désormais prêt à être utilisé.`),
            cleanP("Afin d'activer définitivement votre compte, nous vous invitons à :"),
            cleanList([
              "Vérifier les informations renseignées",
              "Connecter votre compte Stripe à la plateforme",
              "Compléter les éventuels documents ou informations manquants si nécessaire",
            ]),
            cleanP("Une fois ces étapes finalisées, votre accès sera pleinement opérationnel."),
            cleanP("Notre équipe reste à votre disposition pour toute question ou besoin d'accompagnement."),
            cleanSignature(true),
          ].join(""),
          "fr"
        )
      : buildCleanEmailHtml(
          [
            cleanP(`Hello ${firstName},`),
            cleanP(`The profile for your company <strong>"${company}"</strong> has been successfully created on our platform and is now ready to use.`),
            cleanP("To fully activate your account, please:"),
            cleanList([
              "Review the information provided",
              "Connect your Stripe account to the platform",
              "Complete any missing documents or information if required",
            ]),
            cleanP("Once these steps are completed, your account will be fully operational."),
            cleanP("If you need any assistance, our team remains available to support you."),
            cleanSignature(false),
          ].join(""),
          "en"
        )

    return deliverEmail({
      to,
      subject: isFr ? "Activation de votre compte Contrazy" : "Account Activation - Contrazy",
      html,
    })
  }

  // REJECTED / SUSPENDED — clean minimal format
  const siteUrl = getSiteUrl()
  const html = isFr
    ? buildCleanEmailHtml(
        [
          cleanP(`Bonjour ${firstName},`),
          reviewStatus === "REJECTED"
            ? cleanP(`Après examen de votre profil, nous ne sommes pas en mesure d'approuver le compte <strong>« ${company} »</strong> pour le moment. Veuillez vérifier vos informations et soumettre à nouveau, ou contacter notre équipe si vous avez des questions.`)
            : cleanP(`Le compte <strong>« ${company} »</strong> a été suspendu. Veuillez contacter notre équipe avant de reprendre toute activité sur la plateforme.`),
          cleanP(`<a href="${siteUrl}/fr/contact" style="color:#0d9488">Contacter l'équipe Contrazy</a>`),
          cleanSignature(true),
        ].join(""),
        "fr"
      )
    : buildCleanEmailHtml(
        [
          cleanP(`Hello ${firstName},`),
          reviewStatus === "REJECTED"
            ? cleanP(`After reviewing your business profile, we are unable to approve the account <strong>"${company}"</strong> at this time. Please review your details and resubmit, or contact our team if you have any questions.`)
            : cleanP(`The account <strong>"${company}"</strong> has been suspended. Please contact our team before resuming any activity on the platform.`),
          cleanP(`<a href="${siteUrl}/en/contact" style="color:#0d9488">Contact the Contrazy team</a>`),
          cleanSignature(false),
        ].join(""),
        "en"
      )

  const subjects = {
    REJECTED: { fr: "Votre demande de compte Contrazy", en: "Your Contrazy account application" },
    SUSPENDED: { fr: "Votre compte Contrazy a été suspendu", en: "Your Contrazy account has been suspended" },
  }

  return deliverEmail({
    to,
    subject: isFr ? subjects[reviewStatus].fr : subjects[reviewStatus].en,
    html,
  })
}

/** Welcome email sent to a new vendor after account creation. */
export async function sendVendorWelcomeEmail(
  to: string,
  vendorName: string,
  locale?: string
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const dashboardUrl = `${siteUrl}/${isFr ? "fr" : "en"}/vendor/profile`
  const safeName = escapeHtml(vendorName)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cleanP(`Bonjour ${safeName},`),
          cleanP("Bienvenue sur Contrazy ! Votre compte prestataire a bien été créé."),
          cleanP("Pour commencer, nous vous invitons à :"),
          cleanList([
            `<a href="${dashboardUrl}" style="color:#0d9488">Compléter votre profil d’entreprise</a>`,
            "Attendre la validation de l’équipe Contrazy",
            "Connecter votre compte Stripe pour activer les paiements",
            "Créer vos premiers modèles de contrat et envoyer des transactions",
          ]),
          cleanP("Notre équipe reste à votre disposition pour toute question."),
          cleanSignature(true),
        ].join(""),
        "fr"
      )
    : buildCleanEmailHtml(
        [
          cleanP(`Hello ${safeName},`),
          cleanP("Welcome to Contrazy! Your vendor account has been successfully created."),
          cleanP("To get started, please:"),
          cleanList([
            `<a href="${dashboardUrl}" style="color:#0d9488">Complete your business profile</a>`,
            "Wait for Contrazy team approval",
            "Connect your Stripe account to enable payments",
            "Create your first contract templates and send transactions",
          ]),
          cleanP("Our team is available if you need any assistance."),
          cleanSignature(false),
        ].join(""),
        "en"
      )

  return deliverEmail({
    to,
    subject: isFr ? "Bienvenue sur Contrazy !" : "Welcome to Contrazy!",
    html,
  })
}

/** Password reset email — clean minimal format. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale?: string
) {
  const isFr = locale === "fr"

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cleanP("Bonjour,"),
          cleanP("Vous avez demandé la réinitialisation de votre mot de passe Contrazy."),
          cleanP(`Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.`),
          cleanP(`<a href="${resetUrl}" style="color:#0d9488;font-weight:600">Réinitialiser mon mot de passe</a>`),
          cleanP(`<span style="font-size:13px;color:#6b7280">Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe reste inchangé.</span>`),
          cleanSignature(true),
        ].join(""),
        "fr"
      )
    : buildCleanEmailHtml(
        [
          cleanP("Hello,"),
          cleanP("You requested a password reset for your Contrazy account."),
          cleanP(`Click the link below to set a new password. This link expires in <strong>1 hour</strong>.`),
          cleanP(`<a href="${resetUrl}" style="color:#0d9488;font-weight:600">Reset my password</a>`),
          cleanP(`<span style="font-size:13px;color:#6b7280">If you didn't request this reset, you can safely ignore this email — your password remains unchanged.</span>`),
          cleanSignature(false),
        ].join(""),
        "en"
      )

  return deliverEmail({
    to,
    subject: isFr ? "Réinitialisation de votre mot de passe Contrazy" : "Reset your Contrazy password",
    html,
  })
}
