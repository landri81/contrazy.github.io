import { Resend } from "resend"

import { CONTRAZY_COMPANY } from "@/lib/config/contrazy-company"
import { env } from "@/lib/env"
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

// ─── Template ─────────────────────────────────────────────────────────────────

function buildCleanEmailHtml(
  bodyHtml: string,
  options?: {
    locale?: string
    vendorLogoUrl?: string | null
    vendorName?: string | null
  }
): string {
  const isFr = options?.locale === "fr"
  const year = new Date().getFullYear()
  const footerNote = isFr
    ? `© ${year} Contrazy — Tous droits réservés.`
    : `© ${year} Contrazy — All rights reserved.`

  const contrazyDark = "https://contrazy.com/logo/logo-contrazy-dark.png"

  let logoHtml: string
  if (options?.vendorLogoUrl && options?.vendorName) {
    logoHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="vertical-align:middle;padding-right:14px">
            <img src="${escapeHtml(options.vendorLogoUrl)}" height="34" alt="${escapeHtml(options.vendorName)}"
              style="max-width:120px;height:34px;object-fit:contain;display:block;border-radius:4px" />
          </td>
          <td style="vertical-align:middle;padding-right:14px;color:#cbd5e1;font-size:20px;font-weight:200;line-height:1">×</td>
          <td style="vertical-align:middle">
            <img src="${escapeHtml(contrazyDark)}" height="22" alt="Contrazy"
              style="max-width:110px;display:block" />
          </td>
        </tr>
      </table>`
  } else {
    logoHtml = `<img src="${escapeHtml(contrazyDark)}" height="28" alt="Contrazy" style="display:block;max-width:140px" />`
  }

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
    <tr><td style="padding-bottom:36px">${logoHtml}</td></tr>
    <tr><td style="font-size:15px;line-height:1.75;color:#1a1a1a">${bodyHtml}</td></tr>
    <tr><td style="padding-top:36px;border-top:1px solid #e5e7eb;margin-top:32px">
      <p style="margin:0;font-size:11px;color:#9ca3af">${footerNote}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Content helpers ──────────────────────────────────────────────────────────

function cp(text: string): string {
  return `<p style="margin:0 0 14px">${text}</p>`
}

function clist(items: string[]): string {
  const lis = items.map((i) => `<li style="margin-bottom:6px">${i}</li>`).join("")
  return `<ul style="margin:0 0 16px;padding-left:20px">${lis}</ul>`
}

function clink(text: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#0d9488;font-weight:600;text-decoration:underline">${text}</a>`
}

function ccta(label: string, href: string): string {
  return `<p style="margin:24px 0">
    <a href="${escapeHtml(href)}" target="_blank" rel="noreferrer"
       style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.01em">${label}</a>
  </p>`
}

function cdetail(label: string, value: string): string {
  return `<p style="margin:0 0 6px;font-size:14px">
    <span style="color:#6b7280">${label}:</span>&nbsp;<strong style="color:#111827">${value}</strong>
  </p>`
}

function cdivider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />`
}

function csig(isFr: boolean): string {
  return `<p style="margin:28px 0 4px">${isFr ? "Merci," : "Thank you,"}</p>
    <p style="margin:0;font-weight:700;color:#0f172a">${isFr ? "L'équipe Contrazy" : "The Contrazy Team"}</p>`
}

export type SubmittedDoc = {
  label: string
  type?: string | null
  slotLabel?: string | null
  fileName?: string | null
  assetUrl?: string | null
  textValue?: string | null
}

function cdocumentList(docs: SubmittedDoc[], isFr: boolean): string {
  if (docs.length === 0) return ""
  const items = docs.map((d) => {
    const slot = d.slotLabel ? ` — ${escapeHtml(d.slotLabel)}` : ""
    const name = d.fileName ? ` <span style="color:#9ca3af;font-size:13px">(${escapeHtml(d.fileName)})</span>` : ""
    return `<li style="margin-bottom:5px">${escapeHtml(d.label)}${slot}${name}</li>`
  })
  return `<p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#374151">
    ${isFr ? "Documents soumis :" : "Submitted documents:"}
  </p>
  <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:1.6">
    ${items.join("")}
  </ul>`
}

// ─── Admin email functions ────────────────────────────────────────────────────

/** Admin notification when a vendor submits / updates their profile. Always in French. */
export async function sendAdminVendorProfileSubmittedEmail(
  adminEmail: string,
  vendorBusinessName: string,
  vendorEmail: string,
  userId: string,
  isFirstSubmission: boolean
) {
  const siteUrl = getSiteUrl()
  const reviewUrl = `${siteUrl}/fr/admin/users/${userId}`
  const tag = isFirstSubmission ? "[Nouveau profil]" : "[Profil mis à jour]"

  const html = buildCleanEmailHtml(
    [
      cp("Bonjour Admin,"),
      cp(isFirstSubmission
        ? `Un nouveau prestataire vient de soumettre son profil sur Contrazy et nécessite votre validation.`
        : `Un prestataire a mis à jour son profil sur Contrazy et nécessite votre validation.`),
      cdivider(),
      cdetail("Entreprise", escapeHtml(vendorBusinessName)),
      cdetail("Email", escapeHtml(vendorEmail)),
      cdetail("Type", isFirstSubmission ? "Première soumission" : "Mise à jour du profil"),
      cdivider(),
      ccta("Accéder au panneau d'administration", reviewUrl),
      csig(true),
    ].join(""),
    { locale: "fr" }
  )

  return deliverEmail({
    to: adminEmail,
    subject: `${tag} ${vendorBusinessName} — validation requise`,
    html,
  })
}

/** Admin notification when a new vendor signs up. Always in French. */
export async function sendAdminNewVendorSignupEmail(
  adminEmail: string,
  vendorName: string,
  vendorEmail: string,
  userId: string
) {
  const siteUrl = getSiteUrl()
  const reviewUrl = `${siteUrl}/fr/admin/users/${userId}`

  const html = buildCleanEmailHtml(
    [
      cp("Bonjour Admin,"),
      cp("Un nouveau prestataire vient de créer un compte sur Contrazy et nécessite une validation."),
      cdivider(),
      cdetail("Nom / Entreprise", escapeHtml(vendorName)),
      cdetail("Email", escapeHtml(vendorEmail)),
      cdivider(),
      cp("Veuillez examiner et approuver ce profil afin d'activer son accès à la plateforme."),
      ccta("Accéder au panneau d'administration", reviewUrl),
      csig(true),
    ].join(""),
    { locale: "fr" }
  )

  return deliverEmail({
    to: adminEmail,
    subject: `[Inscription] ${vendorName} — ${vendorEmail}`,
    html,
  })
}

/** Admin dispute alert. Always in French. */
/** Admin audit notification when a dispute is opened. Always French. Read-only — admin takes no action. */
export async function sendAdminDisputeAlert(
  adminEmail: string,
  vendorName: string,
  clientName: string,
  transactionRef: string,
  summary: string,
  disputeId: string
) {
  const siteUrl = getSiteUrl()

  const html = buildCleanEmailHtml(
    [
      cp("Bonjour Admin,"),
      cp("Un prestataire a ouvert un litige sur une transaction Contrazy. Ce litige est géré directement par le prestataire."),
      cdivider(),
      cdetail("Prestataire", escapeHtml(vendorName)),
      cdetail("Client", escapeHtml(clientName)),
      cdetail("Référence transaction", escapeHtml(transactionRef)),
      cdetail("ID du litige", disputeId),
      cdivider(),
      cp(`<strong>Déclaration du prestataire :</strong><br />${escapeHtml(summary)}`),
      cp(`<span style="color:#6b7280;font-size:13px">Le prestataire peut résoudre ce litige directement depuis son tableau de bord. Vous pouvez consulter le dossier en lecture seule.</span>`),
      ccta("Voir le dossier (lecture seule)", `${siteUrl}/fr/admin/disputes/${disputeId}`),
      csig(true),
    ].join(""),
    { locale: "fr" }
  )

  return deliverEmail({
    to: adminEmail,
    subject: `[Audit] Litige ouvert — ${vendorName}`,
    html,
  })
}

type DisputeEvidenceItem = { assetUrl: string; publicId: string; fileName: string }

type DisputeEmailDetails = {
  transactionRef: string
  transactionTitle?: string | null
  depositAmount?: number | null
  currency?: string
  signedAgreementUrl?: string | null
  evidenceImages?: DisputeEvidenceItem[]
}

function cevidenceSection(evidence: DisputeEvidenceItem[], isFr: boolean): string {
  if (!evidence || evidence.length === 0) return ""

  const images = evidence.filter((e) => !e.fileName.toLowerCase().endsWith(".pdf") && !e.assetUrl.includes("/raw/"))
  const docs = evidence.filter((e) => e.fileName.toLowerCase().endsWith(".pdf") || e.assetUrl.includes("/raw/"))

  const imgHtml = images.length > 0
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px">
        <tr>${images.map((img) =>
          `<td style="padding-right:8px;vertical-align:top">
            <a href="${escapeHtml(img.assetUrl)}" target="_blank" rel="noreferrer">
              <img src="${escapeHtml(img.assetUrl)}" alt="${escapeHtml(img.fileName)}"
                   width="90" height="90"
                   style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;display:block" />
            </a>
          </td>`
        ).join("")}</tr>
      </table>`
    : ""

  const docHtml = docs.length > 0
    ? `<ul style="margin:4px 0 12px;padding-left:18px;font-size:13px;color:#374151">
        ${docs.map((d) =>
          `<li style="margin-bottom:4px"><a href="${escapeHtml(d.assetUrl)}" target="_blank" rel="noreferrer" style="color:#0d9488;font-weight:500;text-decoration:underline">${escapeHtml(d.fileName)}</a></li>`
        ).join("")}
      </ul>`
    : ""

  if (!imgHtml && !docHtml) return ""

  return `${cdivider()}
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em">
      ${isFr ? "Pièces justificatives" : "Evidence attached"}
    </p>
    ${imgHtml}${docHtml}`
}

/** Sent to vendor confirming they opened a dispute — with case details and next-step CTA. */
export async function sendVendorDisputeOpenedEmail(
  to: string,
  vendorName: string,
  clientName: string,
  disputeId: string,
  summary: string,
  details: DisputeEmailDetails,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const isFr = locale === "fr"
  const siteUrl = getSiteUrl()
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const safeRef = escapeHtml(details.transactionRef)
  const safeTitle = details.transactionTitle ? escapeHtml(details.transactionTitle) : null
  const depositFormatted = details.depositAmount && details.depositAmount > 0
    ? formatEmailMoney(details.depositAmount, details.currency ?? "EUR")
    : null
  const dashboardUrl = `${siteUrl}/${isFr ? "fr" : "en"}/vendor/disputes`

  const transactionSection = [
    cdetail(isFr ? "Référence" : "Reference", safeRef),
    safeTitle ? cdetail(isFr ? "Transaction" : "Transaction", safeTitle) : "",
    depositFormatted ? cdetail(isFr ? "Dépôt de garantie" : "Deposit hold", depositFormatted) : "",
    cdetail(isFr ? "ID du litige" : "Case ID", disputeId),
  ].join("")

  const evidenceSection = cevidenceSection(details.evidenceImages ?? [], isFr)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeVendor},`),
          cp(`Votre litige concernant la transaction avec <strong>${safeClient}</strong> a bien été enregistré.`),
          cdivider(),
          cp(`<strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Détails du dossier</strong>`),
          transactionSection,
          cdivider(),
          cp(`<strong>Votre déclaration :</strong><br />${escapeHtml(summary)}`),
          evidenceSection,
          cdivider(),
          cp(`<strong>Prochaines étapes :</strong>`),
          clist([
            "Le dépôt de garantie est maintenu actif.",
            "Vous pouvez résoudre ce litige directement depuis votre tableau de bord.",
            "Vous choisissez de capturer (conserver) ou libérer le dépôt.",
            "Le client sera notifié de votre décision.",
          ]),
          details.signedAgreementUrl
            ? cp(`Accord signé : ${clink("Télécharger le contrat signé", details.signedAgreementUrl)}`)
            : "",
          ccta("Gérer le litige", dashboardUrl),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeVendor},`),
          cp(`Your dispute regarding the transaction with <strong>${safeClient}</strong> has been successfully recorded.`),
          cdivider(),
          cp(`<strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Case details</strong>`),
          transactionSection,
          cdivider(),
          cp(`<strong>Your statement:</strong><br />${escapeHtml(summary)}`),
          evidenceSection,
          cdivider(),
          cp(`<strong>Next steps:</strong>`),
          clist([
            "The deposit hold remains active.",
            "You can resolve this dispute directly from your dashboard.",
            "You choose to capture (keep) or release the deposit.",
            "The client will be notified of your decision.",
          ]),
          details.signedAgreementUrl
            ? cp(`Signed agreement: ${clink("Download signed contract", details.signedAgreementUrl)}`)
            : "",
          ccta("Manage dispute", dashboardUrl),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Litige ouvert — ${safeRef} — ${safeClient}`
      : `Dispute opened — ${safeRef} — ${safeClient}`,
    html,
  })
}

/** Sent to client notifying them a dispute has been opened on their transaction. */
export async function sendClientDisputeOpenedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  disputeId: string,
  summary: string,
  details: DisputeEmailDetails,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const safeRef = escapeHtml(details.transactionRef)
  const safeTitle = details.transactionTitle ? escapeHtml(details.transactionTitle) : null
  const depositFormatted = details.depositAmount && details.depositAmount > 0
    ? formatEmailMoney(details.depositAmount, details.currency ?? "EUR")
    : null

  const transactionSection = [
    cdetail(isFr ? "Prestataire" : "Vendor", safeVendor),
    cdetail(isFr ? "Référence" : "Reference", safeRef),
    safeTitle ? cdetail(isFr ? "Transaction" : "Transaction", safeTitle) : "",
    depositFormatted ? cdetail(isFr ? "Dépôt de garantie" : "Deposit hold", depositFormatted) : "",
    cdetail(isFr ? "ID du litige" : "Case ID", disputeId),
  ].join("")

  const evidenceSection = cevidenceSection(details.evidenceImages ?? [], isFr)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> a ouvert un litige concernant votre transaction <strong>${safeRef}</strong>.`),
          cdivider(),
          transactionSection,
          cdivider(),
          cp(`<strong>Déclaration du prestataire :</strong><br />${escapeHtml(summary)}`),
          evidenceSection,
          cdivider(),
          cp(`<strong>Ce qu'il se passe :</strong>`),
          clist([
            "Le dépôt de garantie reste bloqué pendant la durée du litige.",
            "Le prestataire examinera le dossier et prendra une décision.",
            "Vous serez notifié(e) dès qu'une décision sera rendue.",
          ]),
          details.signedAgreementUrl
            ? cp(`Accord signé : ${clink("Télécharger le contrat signé", details.signedAgreementUrl)}`)
            : "",
          cp(`<span style="color:#6b7280;font-size:13px">Si vous avez des questions, contactez directement ${safeVendor}.</span>`),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> has opened a dispute regarding your transaction <strong>${safeRef}</strong>.`),
          cdivider(),
          transactionSection,
          cdivider(),
          cp(`<strong>Vendor's statement:</strong><br />${escapeHtml(summary)}`),
          evidenceSection,
          cdivider(),
          cp(`<strong>What this means:</strong>`),
          clist([
            "The deposit hold remains active while the dispute is open.",
            "The vendor will review the case and make a decision.",
            "You will be notified once a decision has been made.",
          ]),
          details.signedAgreementUrl
            ? cp(`Signed agreement: ${clink("Download signed contract", details.signedAgreementUrl)}`)
            : "",
          cp(`<span style="color:#6b7280;font-size:13px">If you have questions, please contact ${safeVendor} directly.</span>`),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Litige ouvert — ${safeRef} — ${safeVendor}`
      : `Dispute opened — ${safeRef} — ${safeVendor}`,
    html,
  })
}

/** Admin contact form notification. Always in French. */
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

  const html = buildCleanEmailHtml(
    [
      cp("Bonjour Admin,"),
      cp("Un nouveau message a été soumis via le formulaire de contact Contrazy."),
      cdivider(),
      cdetail("Nom", escapeHtml(`${firstName} ${lastName}`)),
      cdetail("Email", escapeHtml(senderEmail)),
      cdetail("Langue", locale.toUpperCase()),
      cdetail("ID message", contactId),
      cdivider(),
      cp(`<strong>Message :</strong><br /><span style="white-space:pre-wrap;color:#374151">${escapeHtml(message)}</span>`),
      ccta("Voir dans le tableau de bord admin", `${siteUrl}/fr/admin`),
      csig(true),
    ].join(""),
    { locale: "fr" }
  )

  return deliverEmail({
    to: adminEmail,
    subject: `[Nouveau contact] ${firstName} ${lastName} — ${senderEmail}`,
    html,
  })
}

// ─── Vendor email functions ───────────────────────────────────────────────────

/** Vendor review status update — APPROVED uses clean professional template. */
export async function sendVendorReviewStatusEmail(
  to: string,
  businessName: string,
  reviewStatus: "APPROVED" | "REJECTED" | "SUSPENDED",
  locale?: string,
  vendorLogoUrl?: string | null,
  ownerFirstName?: string | null
) {
  const siteUrl = getSiteUrl()
  const isFr = locale === "fr"
  const firstName = escapeHtml(ownerFirstName?.trim() || businessName)
  const company = escapeHtml(businessName)
  const dashboardUrl = `${siteUrl}/${isFr ? "fr" : "en"}/vendor/profile`

  if (reviewStatus === "APPROVED") {
    const html = isFr
      ? buildCleanEmailHtml(
          [
            cp(`Bonjour ${firstName},`),
            cp(`Votre profil <strong>${company}</strong> a été validé par notre équipe.`),
            cp("Votre compte est désormais entièrement actif. Vous pouvez maintenant :"),
            clist([
              "Créer et gérer vos contrats",
              "Gérer vos cautions et paiements",
              "Inviter vos clients et suivre vos transactions",
            ]),
            ccta("Accéder à mon espace", dashboardUrl),
            csig(true),
          ].join(""),
          { locale: "fr" }
        )
      : buildCleanEmailHtml(
          [
            cp(`Hello ${firstName},`),
            cp(`Your profile <strong>${company}</strong> has been approved by our team.`),
            cp("Your account is now fully active. You can now:"),
            clist([
              "Create and manage contracts",
              "Manage deposits and payments",
              "Invite clients and track transactions",
            ]),
            ccta("Access my dashboard", dashboardUrl),
            csig(false),
          ].join(""),
          { locale: "en" }
        )

    return deliverEmail({
      to,
      subject: isFr ? "Votre profil Contrazy a été approuvé" : "Your Contrazy profile has been approved",
      html,
    })
  }

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${firstName},`),
          reviewStatus === "REJECTED"
            ? cp(`Après examen de votre profil <strong>${company}</strong>, nous ne sommes pas en mesure de le valider pour le moment.`)
            : cp(`Le compte <strong>${company}</strong> a été suspendu sur notre plateforme.`),
          reviewStatus === "REJECTED"
            ? cp("Veuillez vérifier les informations renseignées et soumettre à nouveau votre profil, ou contacter notre équipe pour plus d'informations.")
            : cp("Veuillez contacter notre équipe avant de reprendre toute activité sur la plateforme."),
          cp(clink("Contacter l'équipe Contrazy", `${siteUrl}/fr/contact`)),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${firstName},`),
          reviewStatus === "REJECTED"
            ? cp(`After reviewing your profile <strong>${company}</strong>, we are unable to approve it at this time.`)
            : cp(`The account <strong>${company}</strong> has been suspended on our platform.`),
          reviewStatus === "REJECTED"
            ? cp("Please review your information and resubmit your profile, or contact our team if you have any questions.")
            : cp("Please contact our team before resuming any activity on the platform."),
          cp(clink("Contact the Contrazy team", `${siteUrl}/en/contact`)),
          csig(false),
        ].join(""),
        { locale: "en" }
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
  const safeName = escapeHtml(vendorName)
  const dashboardUrl = `${siteUrl}/${isFr ? "fr" : "en"}/vendor/profile`

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeName},`),
          cp("Votre inscription sur Contrazy a bien été prise en compte. Votre compte a été créé avec succès et est actuellement en cours de vérification par notre équipe."),
          cp("Prochaines étapes :"),
          clist([
            "Vérifier votre adresse email",
            "Compléter votre profil si nécessaire",
            "Attendre la validation de votre compte par un administrateur",
          ]),
          cp("Vous recevrez une notification dès que votre profil sera approuvé."),
          ccta("Accéder à mon espace", dashboardUrl),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeName},`),
          cp("Your Contrazy signup has been successfully completed. Your account has been created and is currently under review by our team."),
          cp("Next steps:"),
          clist([
            "Verify your email address",
            "Complete your profile if required",
            "Wait for admin approval of your account",
          ]),
          cp("You will receive a notification once your profile has been approved."),
          ccta("Access my account", dashboardUrl),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr ? "Bienvenue sur Contrazy" : "Welcome to Contrazy",
    html,
  })
}

/** Password reset email. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale?: string
) {
  const isFr = locale === "fr"

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp("Bonjour,"),
          cp("Vous avez demandé la réinitialisation de votre mot de passe Contrazy."),
          cp(`Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.`),
          ccta("Réinitialiser mon mot de passe", resetUrl),
          cp(`<span style="font-size:13px;color:#6b7280">Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe reste inchangé.</span>`),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp("Hello,"),
          cp("You requested a password reset for your Contrazy account."),
          cp(`Click the link below to set a new password. This link expires in <strong>1 hour</strong>.`),
          ccta("Reset my password", resetUrl),
          cp(`<span style="font-size:13px;color:#6b7280">If you didn't request this reset, you can safely ignore this email — your password remains unchanged.</span>`),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr ? "Réinitialisation de votre mot de passe Contrazy" : "Reset your Contrazy password",
    html,
  })
}

/** Vendor fee invoice email — sent after a fee-bearing deposit operation. */
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
  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const fmt = (n: number) => formatEmailMoney(n, currency)
  const date = new Date().toLocaleDateString(isFr ? "fr-FR" : "en-GB", { dateStyle: "long" })
  const typeLabel = isFr
    ? feeType === "long_deposit" ? "Dépôt longue durée" : "Capture de caution"
    : feeType === "long_deposit" ? "Extended deposit" : "Deposit capture"

  // VAT breakdown — integer cents, platformFee is stored VAT-inclusive (TTC)
  const feeInclVat = platformFee
  const feeExclVat = Math.round(platformFee / 1.2)
  const vatAmount = feeInclVat - feeExclVat

  const siteUrl = getSiteUrl()
  const billingUrl = `${siteUrl}/${isFr ? "fr" : "en"}/vendor/billing`

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeVendor},`),
          cp(`Une facture de frais Contrazy a été générée pour la transaction <strong>${escapeHtml(transactionRef)}</strong>.`),
          cdivider(),
          cdetail("Date", date),
          cdetail("Type d'opération", typeLabel),
          cdivider(),
          `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.07em">Frais de service Contrazy</p>`,
          cdetail("Frais Contrazy (TTC)", fmt(feeInclVat)),
          cdetail("Frais Contrazy (HT)", fmt(feeExclVat)),
          cdetail("TVA (20 %)", fmt(vatAmount)),
          `<p style="margin:12px 0 4px;font-size:15px;font-weight:800;color:#0f172a">Total à payer : <span style="color:#0d9488">${fmt(feeInclVat)}</span></p>`,
          cdivider(),
          `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">À titre indicatif — Montant brut : <strong>${fmt(depositAmount)}</strong> | Frais Stripe : <strong>${fmt(stripeFee)}</strong></p>`,
          cp(`<span style="font-size:12px;color:#9ca3af">Les frais Stripe sont facturés séparément et restent disponibles dans votre espace Stripe.</span>`),
          ccta("Télécharger ma facture PDF", billingUrl),
          cdivider(),
          `<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Émis par</p>`,
          `<p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a">${CONTRAZY_COMPANY.name}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">${CONTRAZY_COMPANY.email}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">${CONTRAZY_COMPANY.address.replace(/\n/g, ", ")}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">N° TVA : ${CONTRAZY_COMPANY.vatNumber}</p>`,
          `<p style="margin:0 0 14px;font-size:12px;color:#6b7280">SIREN : ${CONTRAZY_COMPANY.registrationNumber}</p>`,
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeVendor},`),
          cp(`A Contrazy fee invoice has been generated for transaction <strong>${escapeHtml(transactionRef)}</strong>.`),
          cdivider(),
          cdetail("Date", date),
          cdetail("Operation type", typeLabel),
          cdivider(),
          `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.07em">Contrazy Service Charges</p>`,
          cdetail("Contrazy fee (incl. VAT)", fmt(feeInclVat)),
          cdetail("Contrazy fee (excl. VAT)", fmt(feeExclVat)),
          cdetail("VAT (20%)", fmt(vatAmount)),
          `<p style="margin:12px 0 4px;font-size:15px;font-weight:800;color:#0f172a">Total due: <span style="color:#0d9488">${fmt(feeInclVat)}</span></p>`,
          cdivider(),
          `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">For reference — Gross amount: <strong>${fmt(depositAmount)}</strong> | Stripe fee: <strong>${fmt(stripeFee)}</strong></p>`,
          cp(`<span style="font-size:12px;color:#9ca3af">Stripe fees are invoiced separately and remain available in your Stripe dashboard.</span>`),
          ccta("Download my PDF invoice", billingUrl),
          cdivider(),
          `<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Issued by</p>`,
          `<p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a">${CONTRAZY_COMPANY.name}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">${CONTRAZY_COMPANY.email}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">${CONTRAZY_COMPANY.address.replace(/\n/g, ", ")}</p>`,
          `<p style="margin:0 0 2px;font-size:12px;color:#6b7280">VAT number: ${CONTRAZY_COMPANY.vatNumber}</p>`,
          `<p style="margin:0 0 14px;font-size:12px;color:#6b7280">Reg. n°: ${CONTRAZY_COMPANY.registrationNumber}</p>`,
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Facture de frais Contrazy — ${transactionRef}`
      : `Contrazy fee invoice — ${transactionRef}`,
    html,
  })
}

/** Vendor notification that a deposit hold has been authorized by a client. */
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

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeVendor},`),
          cp(`Un dépôt de garantie de <strong>${formatted}</strong> a été autorisé par votre client <strong>${safeClient}</strong>.`),
          cp("Vous pouvez capturer ou libérer ce dépôt depuis votre tableau de bord."),
          cp(`<span style="font-size:13px;color:#6b7280">Le dépôt expirera automatiquement si aucune action n'est effectuée dans les 7 jours.</span>`),
          ccta("Gérer le dépôt", `${siteUrl}/fr/vendor/transactions`),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeVendor},`),
          cp(`A deposit hold of <strong>${formatted}</strong> has been successfully authorized by your client <strong>${safeClient}</strong>.`),
          cp("You can capture or release this hold from your vendor dashboard."),
          cp(`<span style="font-size:13px;color:#6b7280">The deposit authorization will expire automatically if no action is taken within 7 days.</span>`),
          ccta("Manage deposit", `${siteUrl}/en/vendor/transactions`),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt autorisé — ${clientName}` : `Deposit authorized — ${clientName}`,
    html,
  })
}

/** Vendor notification that their deposit was captured or released. */
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
  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const formatted = formatEmailMoney(amount, currency)
  const isCaptured = action === "captured"

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeVendor},`),
          cp(`Le dépôt de garantie de <strong>${formatted}</strong> pour votre client <strong>${safeClient}</strong> a été <strong>${isCaptured ? "capturé" : "libéré"}</strong>.`),
          cp(isCaptured
            ? "Le montant retenu a été converti en prélèvement définitif."
            : "Le montant retenu a été libéré et restitué au client."),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeVendor},`),
          cp(`The deposit hold of <strong>${formatted}</strong> for your client <strong>${safeClient}</strong> was <strong>${action}</strong>.`),
          cp(isCaptured
            ? "The held amount has been converted into a permanent charge."
            : "The held amount has been released back to the client."),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Dépôt ${isCaptured ? "capturé" : "libéré"} — ${clientName}`
      : `Deposit ${action} — ${clientName}`,
    html,
  })
}

/** Vendor dispute resolved notification. */
export async function sendVendorDisputeResolved(
  to: string,
  vendorName: string,
  clientName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string,
  locale?: string,
  vendorLogoUrl?: string | null,
  details?: DisputeEmailDetails
) {
  const isFr = locale === "fr"
  const won = outcome === "vendor_wins"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const safeResolution = resolution ? escapeHtml(resolution) : ""
  const safeRef = details?.transactionRef ? escapeHtml(details.transactionRef) : null
  const depositFormatted = details?.depositAmount && details.depositAmount > 0
    ? formatEmailMoney(details.depositAmount, details.currency ?? "EUR")
    : null

  const breakdownSection = [
    safeRef ? cdetail(isFr ? "Référence" : "Reference", safeRef) : "",
    cdetail(isFr ? "Client" : "Client", safeClient),
    depositFormatted ? cdetail(isFr ? "Dépôt de garantie" : "Deposit hold", depositFormatted) : "",
    cdetail(isFr ? "Décision" : "Decision", isFr
      ? (won ? "En votre faveur" : "En faveur du client")
      : (won ? "In your favour" : "In the client's favour")),
    cdetail(isFr ? "Résultat" : "Outcome", isFr
      ? (won ? "Dépôt capturé — montant acquis." : "Dépôt libéré — remboursé au client.")
      : (won ? "Deposit captured — funds retained." : "Deposit released — refunded to client.")),
  ].join("")

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeVendor},`),
          cp(`Le litige concernant votre transaction avec <strong>${safeClient}</strong> a été clôturé.`),
          cdivider(),
          breakdownSection,
          safeResolution ? `${cdivider()}${cp(`<strong>Note de résolution :</strong> ${safeResolution}`)}` : "",
          details?.signedAgreementUrl
            ? cp(`Accord signé : ${clink("Télécharger le contrat signé", details.signedAgreementUrl)}`)
            : "",
          cdivider(),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeVendor},`),
          cp(`The dispute regarding your transaction with <strong>${safeClient}</strong> has been closed.`),
          cdivider(),
          breakdownSection,
          safeResolution ? `${cdivider()}${cp(`<strong>Resolution note:</strong> ${safeResolution}`)}` : "",
          details?.signedAgreementUrl
            ? cp(`Signed agreement: ${clink("Download signed contract", details.signedAgreementUrl)}`)
            : "",
          cdivider(),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Litige clôturé — ${won ? "Dépôt capturé" : "Dépôt libéré"}${safeRef ? ` — ${safeRef}` : ""}`
      : `Dispute closed — ${won ? "Deposit captured" : "Deposit released"}${safeRef ? ` — ${safeRef}` : ""}`,
    html,
  })
}

// ─── Vendor-to-client email functions ─────────────────────────────────────────

/** Secure link sent to a client to start the onboarding flow. */
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
  const safeVendorName = escapeHtml(vendorName)
  const safeTitle = escapeHtml(transactionTitle)
  const safeRef = escapeHtml(transactionReference)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp("Bonjour,"),
          cp(`<strong>${safeVendorName}</strong> vous invite à compléter votre dossier pour : <strong>${safeTitle}</strong>.`),
          cdivider(),
          cdetail("Référence", safeRef),
          cdivider(),
          cp("Actions attendues :"),
          clist([
            "Vérifier vos informations personnelles",
            "Fournir les documents demandés",
            "Signer le contrat si demandé",
            "Finaliser le paiement ou la caution",
          ]),
          ccta("Accéder au dossier sécurisé", secureLink),
          cp(`<span style="font-size:13px;color:#6b7280">Si vous n'attendiez pas ce message, vous pouvez ignorer cet e-mail en toute sécurité.</span>`),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp("Hello,"),
          cp(`<strong>${safeVendorName}</strong> invites you to complete your file for: <strong>${safeTitle}</strong>.`),
          cdivider(),
          cdetail("Reference", safeRef),
          cdivider(),
          cp("Required actions:"),
          clist([
            "Review your personal information",
            "Provide the requested documents",
            "Sign the contract if requested",
            "Complete the payment or deposit",
          ]),
          ccta("Access your secure file", secureLink),
          cp(`<span style="font-size:13px;color:#6b7280">If you weren't expecting this, you can safely ignore this email.</span>`),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Dossier sécurisé — ${vendorName}` : `Secure client link — ${vendorName}`,
    html,
  })
}

/** Transaction completed notification to the client. */
export async function sendTransactionCompletedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionId: string,
  signedAgreementUrl?: string | null,
  locale?: string,
  vendorLogoUrl?: string | null,
  documents?: SubmittedDoc[]
) {
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const safeRef = escapeHtml(transactionId)
  const docList = documents && documents.length > 0 ? cdocumentList(documents, isFr) : ""

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`Votre transaction avec <strong>${safeVendor}</strong> a été complétée avec succès.`),
          cdivider(),
          cdetail("Référence", safeRef),
          cdivider(),
          docList,
          signedAgreementUrl
            ? cp(`Votre accord signé est disponible : ${clink("Télécharger le contrat signé", signedAgreementUrl)}`)
            : "",
          cp("Pour toute question, contactez le prestataire directement."),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`Your transaction with <strong>${safeVendor}</strong> has been successfully completed.`),
          cdivider(),
          cdetail("Reference", safeRef),
          cdivider(),
          docList,
          signedAgreementUrl
            ? cp(`Your signed agreement is available: ${clink("Download signed contract", signedAgreementUrl)}`)
            : "",
          cp("If you have any questions, please contact the vendor directly."),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Transaction complétée — ${vendorName}` : `Transaction completed — ${vendorName}`,
    html,
  })
}

type VendorTransactionCompletedInput = {
  to: string
  vendorName: string
  clientName: string
  clientEmail: string
  clientPhone?: string | null
  clientCompany?: string | null
  transactionReference: string
  transactionTitle: string
  serviceDate?: Date | null
  amount?: number | null
  depositAmount?: number | null
  currency: string
  notes?: string | null
  signedAgreementUrl?: string | null
  documents?: SubmittedDoc[]
  locale?: string
  vendorLogoUrl?: string | null
}

/** Transaction completed notification to the vendor. */
export async function sendVendorTransactionCompletedEmail(input: VendorTransactionCompletedInput) {
  const {
    to, vendorName, clientName, clientEmail, clientPhone, clientCompany,
    transactionReference, transactionTitle, serviceDate, amount, depositAmount,
    currency, notes, signedAgreementUrl, documents, locale, vendorLogoUrl,
  } = input

  const isFr = locale === "fr"
  const safeVendor = escapeHtml(vendorName)
  const safeClient = escapeHtml(clientName)
  const safeRef = escapeHtml(transactionReference)
  const safeTitle = escapeHtml(transactionTitle)

  const formatMoney = (val: number) => formatEmailMoney(val, currency)

  const serviceDateStr = serviceDate
    ? serviceDate.toLocaleDateString(isFr ? "fr-FR" : "en-US", { dateStyle: "long" })
    : null

  const clientSection = [
    cdetail(isFr ? "Nom" : "Name", safeClient),
    cdetail(isFr ? "Email" : "Email", escapeHtml(clientEmail)),
    clientPhone ? cdetail(isFr ? "Téléphone" : "Phone", escapeHtml(clientPhone)) : "",
    clientCompany ? cdetail(isFr ? "Entreprise" : "Company", escapeHtml(clientCompany)) : "",
  ].join("")

  const transactionSection = [
    cdetail(isFr ? "Référence" : "Reference", safeRef),
    cdetail(isFr ? "Titre" : "Title", safeTitle),
    serviceDateStr ? cdetail(isFr ? "Date de service" : "Service date", serviceDateStr) : "",
    amount && amount > 0 ? cdetail(isFr ? "Montant" : "Amount", formatMoney(amount)) : "",
    depositAmount && depositAmount > 0 ? cdetail(isFr ? "Dépôt de garantie" : "Deposit hold", formatMoney(depositAmount)) : "",
  ].join("")

  const notesSection = notes?.trim()
    ? `${cdivider()}${cp(`<span style="color:#6b7280">${isFr ? "Notes :" : "Notes:"}</span> ${escapeHtml(notes.trim())}`)}`
    : ""

  const docList = documents && documents.length > 0 ? cdocumentList(documents, isFr) : ""

  const agreementLine = signedAgreementUrl
    ? cp(isFr
        ? `L'accord signé est disponible : ${clink("Télécharger le contrat signé", signedAgreementUrl)}`
        : `The signed agreement is available: ${clink("Download signed contract", signedAgreementUrl)}`)
    : ""

  const html = buildCleanEmailHtml(
    [
      cp(isFr ? `Bonjour ${safeVendor},` : `Hello ${safeVendor},`),
      cp(isFr
        ? `<strong>${safeClient}</strong> a finalisé la transaction <strong>${safeRef}</strong>.`
        : `<strong>${safeClient}</strong> has completed transaction <strong>${safeRef}</strong>.`),
      cdivider(),
      cp(`<strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">${isFr ? "Détails de la transaction" : "Transaction details"}</strong>`),
      transactionSection,
      cdivider(),
      cp(`<strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">${isFr ? "Informations client" : "Client information"}</strong>`),
      clientSection,
      notesSection,
      docList ? cdivider() : "",
      docList,
      agreementLine ? cdivider() : "",
      agreementLine,
      cdivider(),
      csig(isFr),
    ].join(""),
    { locale: isFr ? "fr" : "en", vendorLogoUrl, vendorName }
  )

  return deliverEmail({
    to,
    subject: isFr
      ? `Transaction finalisée — ${safeRef} — ${safeClient}`
      : `Transaction completed — ${safeRef} — ${safeClient}`,
    html,
  })
}

/** Client notification of a deposit charge. */
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
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)
  const refundDateStr = autoRefundAt
    ? autoRefundAt.toLocaleDateString(isFr ? "fr-FR" : "en-US", { dateStyle: "long" })
    : null

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`Un dépôt de garantie de <strong>${formatted}</strong> a été débité pour votre transaction avec <strong>${safeVendor}</strong>.`),
          refundDateStr
            ? cp(`Un remboursement automatique sera effectué le <strong>${refundDateStr}</strong> si le prestataire ne décide pas de conserver le dépôt.`)
            : "",
          cp("Pour toute question, contactez le prestataire directement."),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`A security deposit of <strong>${formatted}</strong> has been charged for your transaction with <strong>${safeVendor}</strong>.`),
          refundDateStr
            ? cp(`An automatic refund will be issued on <strong>${refundDateStr}</strong> unless the vendor decides to keep the deposit.`)
            : "",
          cp("If you have any questions, please contact the vendor directly."),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt de garantie débité — ${vendorName}` : `Security deposit charged — ${vendorName}`,
    html,
  })
}

/** Client notification that their deposit was automatically refunded. */
export async function sendDepositAutoRefundedEmail(
  to: string,
  clientName: string,
  vendorName: string,
  amount: number,
  currency: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`Votre dépôt de garantie de <strong>${formatted}</strong> avec <strong>${safeVendor}</strong> a été remboursé automatiquement.`),
          cp("Le remboursement devrait apparaître sur votre relevé bancaire dans les prochains jours ouvrables."),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`Your security deposit of <strong>${formatted}</strong> with <strong>${safeVendor}</strong> has been automatically refunded.`),
          cp("The refund should appear on your bank statement within the next few business days."),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Dépôt remboursé — ${vendorName}` : `Security deposit refunded — ${vendorName}`,
    html,
  })
}

/** Client notification that their deposit was captured or released. */
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
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)
  const isCaptured = action === "captured"

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          isCaptured
            ? cp(`Le prestataire <strong>${safeVendor}</strong> a prélevé <strong>${formatted}</strong> depuis votre dépôt de garantie autorisé.`)
            : cp(`Votre dépôt de garantie de <strong>${formatted}</strong> avec <strong>${safeVendor}</strong> a été libéré. Aucun prélèvement ne sera effectué.`),
          isCaptured
            ? cp("Ce prélèvement apparaîtra sur votre relevé bancaire dans les prochains jours ouvrables.")
            : cp("Le montant sera restitué sur votre compte selon les délais de votre banque."),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          isCaptured
            ? cp(`Vendor <strong>${safeVendor}</strong> has charged <strong>${formatted}</strong> from your authorized security deposit.`)
            : cp(`Your <strong>${formatted}</strong> security deposit hold with <strong>${safeVendor}</strong> has been released. You will not be charged.`),
          isCaptured
            ? cp("This charge will appear on your bank statement within a few business days.")
            : cp("The hold has been lifted and funds will return to your account per your bank's timeline."),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Dépôt ${isCaptured ? "débité" : "libéré"} — ${vendorName}`
      : `Deposit ${action} — ${vendorName}`,
    html,
  })
}

/** Client notification that a service payment is due (deferred payment flow). */
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
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const formatted = formatEmailMoney(amount, currency)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> a demandé le paiement du service pour la transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
          cdivider(),
          cdetail("Prestataire", safeVendor),
          cdetail("Référence", escapeHtml(transactionReference)),
          cdetail("Montant dû", formatted),
          cdivider(),
          ccta("Effectuer le paiement", paymentUrl),
          cp("Les autres détails de votre accord restent inchangés."),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> has requested the service payment for transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
          cdivider(),
          cdetail("Vendor", safeVendor),
          cdetail("Reference", escapeHtml(transactionReference)),
          cdetail("Amount due", formatted),
          cdivider(),
          ccta("Complete payment", paymentUrl),
          cp("Your agreement details remain unchanged."),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Paiement demandé — ${vendorName}` : `Payment requested — ${vendorName}`,
    html,
  })
}

/** Client check-out request. */
export async function sendCheckOutRequestEmail(
  to: string,
  clientName: string,
  vendorName: string,
  transactionReference: string,
  checkOutUrl: string,
  locale?: string,
  vendorLogoUrl?: string | null
) {
  const isFr = locale === "fr"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> vous invite à effectuer le check-out pour la transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
          cp("Veuillez ouvrir le lien sécurisé ci-dessous afin de compléter le rapport de fin de service."),
          ccta("Accéder au check-out sécurisé", checkOutUrl),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`<strong>${safeVendor}</strong> has requested the service check-out for transaction <strong>${escapeHtml(transactionReference)}</strong>.`),
          cp("Please open the secure link below to complete your end-of-service report."),
          ccta("Access secure check-out", checkOutUrl),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr ? `Check-out demandé — ${vendorName}` : `Check-out requested — ${vendorName}`,
    html,
  })
}

/** Client dispute resolved notification. */
export async function sendClientDisputeResolved(
  to: string,
  clientName: string,
  vendorName: string,
  outcome: "vendor_wins" | "client_wins",
  resolution: string,
  locale?: string,
  vendorLogoUrl?: string | null,
  details?: DisputeEmailDetails
) {
  const isFr = locale === "fr"
  const won = outcome === "client_wins"
  const safeClient = escapeHtml(clientName)
  const safeVendor = escapeHtml(vendorName)
  const safeResolution = resolution ? escapeHtml(resolution) : ""
  const safeRef = details?.transactionRef ? escapeHtml(details.transactionRef) : null
  const depositFormatted = details?.depositAmount && details.depositAmount > 0
    ? formatEmailMoney(details.depositAmount, details.currency ?? "EUR")
    : null

  const breakdownSection = [
    cdetail(isFr ? "Prestataire" : "Vendor", safeVendor),
    safeRef ? cdetail(isFr ? "Référence" : "Reference", safeRef) : "",
    depositFormatted ? cdetail(isFr ? "Dépôt de garantie" : "Deposit hold", depositFormatted) : "",
    cdetail(isFr ? "Décision" : "Decision", isFr
      ? (won ? "En votre faveur" : "En faveur du prestataire")
      : (won ? "In your favour" : "In the vendor's favour")),
    cdetail(isFr ? "Résultat" : "Outcome", isFr
      ? (won ? "Dépôt libéré — aucun prélèvement effectué." : "Dépôt capturé — la réclamation du prestataire a été retenue.")
      : (won ? "Deposit released — no charge was made." : "Deposit captured — the vendor's claim was upheld.")),
  ].join("")

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeClient},`),
          cp(`Le litige soulevé par <strong>${safeVendor}</strong> concernant votre transaction a été clôturé.`),
          cdivider(),
          breakdownSection,
          safeResolution ? `${cdivider()}${cp(`<strong>Note de résolution :</strong> ${safeResolution}`)}` : "",
          details?.signedAgreementUrl
            ? cp(`Accord signé : ${clink("Télécharger le contrat signé", details.signedAgreementUrl)}`)
            : "",
          cdivider(),
          csig(true),
        ].join(""),
        { locale: "fr", vendorLogoUrl, vendorName }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeClient},`),
          cp(`The dispute raised by <strong>${safeVendor}</strong> regarding your transaction has been closed.`),
          cdivider(),
          breakdownSection,
          safeResolution ? `${cdivider()}${cp(`<strong>Resolution note:</strong> ${safeResolution}`)}` : "",
          details?.signedAgreementUrl
            ? cp(`Signed agreement: ${clink("Download signed contract", details.signedAgreementUrl)}`)
            : "",
          cdivider(),
          csig(false),
        ].join(""),
        { locale: "en", vendorLogoUrl, vendorName }
      )

  return deliverEmail({
    to,
    subject: isFr
      ? `Litige clôturé — ${won ? "Dépôt libéré" : "Dépôt capturé"}${safeRef ? ` — ${safeRef}` : ""}`
      : `Dispute closed — ${won ? "Deposit released" : "Deposit captured"}${safeRef ? ` — ${safeRef}` : ""}`,
    html,
  })
}

/** Contact form auto-reply to the sender. */
export async function sendContactAutoReply(to: string, firstName: string, locale?: string) {
  const isFr = locale === "fr"
  const safeName = escapeHtml(firstName)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeName},`),
          cp("Merci de nous avoir contactés. Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais."),
          cp("Si votre demande est urgente, n'hésitez pas à nous relancer en répondant directement à cet e-mail."),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeName},`),
          cp("Thank you for reaching out. We've received your message and will get back to you as soon as possible."),
          cp("If your request is urgent, feel free to follow up by replying directly to this email."),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr ? "Nous avons bien reçu votre message" : "We've received your message — Contrazy",
    html,
  })
}

/** Admin reply to a contact form message. */
export async function sendContactReply(
  to: string,
  firstName: string,
  replyText: string,
  originalMessage: string,
  locale?: string
) {
  const isFr = locale === "fr"
  const safeName = escapeHtml(firstName)

  const html = isFr
    ? buildCleanEmailHtml(
        [
          cp(`Bonjour ${safeName},`),
          cp("Merci pour votre message. Voici notre réponse :"),
          cdivider(),
          cp(`<span style="white-space:pre-wrap">${escapeHtml(replyText)}</span>`),
          cdivider(),
          cp(`<span style="font-size:13px;color:#6b7280"><strong>Votre message original :</strong><br /><span style="white-space:pre-wrap">${escapeHtml(originalMessage)}</span></span>`),
          csig(true),
        ].join(""),
        { locale: "fr" }
      )
    : buildCleanEmailHtml(
        [
          cp(`Hello ${safeName},`),
          cp("Thank you for your message. Here is our reply:"),
          cdivider(),
          cp(`<span style="white-space:pre-wrap">${escapeHtml(replyText)}</span>`),
          cdivider(),
          cp(`<span style="font-size:13px;color:#6b7280"><strong>Your original message:</strong><br /><span style="white-space:pre-wrap">${escapeHtml(originalMessage)}</span></span>`),
          csig(false),
        ].join(""),
        { locale: "en" }
      )

  return deliverEmail({
    to,
    subject: isFr ? "Réponse à votre message — Contrazy" : "Reply to your message — Contrazy",
    html,
  })
}
