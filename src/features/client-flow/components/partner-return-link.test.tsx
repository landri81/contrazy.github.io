import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../../../messages/en.json"
import frMessages from "../../../../messages/fr.json"
import { ClientLinkCancelledState } from "@/features/client-flow/components/client-link-cancelled-state"
import { PartnerReturnLink } from "@/features/client-flow/components/partner-return-link"
import {
  initialPartnerReturnCountdown,
  PARTNER_RETURN_COUNTDOWN_SECONDS,
  partnerReturnCountdownReducer,
  type PartnerReturnCountdownState,
} from "@/features/client-flow/partner-return-countdown"
import { resolvePartnerReturnTarget, type PartnerReturnStatus } from "@/lib/partner-api/return-link"

// The cancelled screen links home through the locale-aware navigation; a plain anchor is enough here.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const ALLOWED = ["https://locaz.co", "http://localhost:3000"]

function partnerTransaction(overrides: Partial<Parameters<typeof resolvePartnerReturnTarget>[0]> = {}) {
  return {
    source: "PARTNER_API",
    returnUrl: "https://locaz.co/reservations/retour?lang=fr",
    externalRef: "LOCAZ-BK-42",
    vendor: { businessName: "LOCAZ", partnerAllowedOrigins: ALLOWED },
    link: { cancelledBy: "CLIENT" },
    ...overrides,
  }
}

function render(node: React.ReactNode, locale: "en" | "fr" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages} timeZone="Europe/Paris">
      {node}
    </NextIntlClientProvider>
  )
}

/** What the completion page renders for the action area: the button only when a target resolves. */
function renderCompletion(transaction: Parameters<typeof resolvePartnerReturnTarget>[0], locale: "en" | "fr" = "en") {
  const target = resolvePartnerReturnTarget(transaction, "completed")
  return render(target ? <PartnerReturnLink {...target} /> : null, locale)
}

function renderCancelled(transaction: Parameters<typeof resolvePartnerReturnTarget>[0]) {
  return render(
    <ClientLinkCancelledState vendorName="LOCAZ" partnerReturn={resolvePartnerReturnTarget(transaction, "cancelled")} />
  )
}

/** href of the return button, HTML entities decoded. */
function decodeHref(markup: string) {
  const href = markup.match(/<a[^>]*href="([^"]+)"[^>]*data-testid="partner-return-link"/)?.[1]
  return href ? href.replace(/&amp;/g, "&") : null
}

describe("resolvePartnerReturnTarget", () => {
  it.each<[PartnerReturnStatus]>([["completed"], ["cancelled"]])(
    "builds returnUrl?booking=<externalRef>&status=%s and keeps existing query parameters",
    (status) => {
      expect(resolvePartnerReturnTarget(partnerTransaction(), status)).toEqual({
        href: `https://locaz.co/reservations/retour?lang=fr&booking=LOCAZ-BK-42&status=${status}`,
        partnerName: "LOCAZ",
      })
    }
  )

  it.each([
    ["an origin outside the allow-list", { returnUrl: "https://evil.example/return" }],
    ["a look-alike origin", { returnUrl: "https://locaz.co.evil.example/return" }],
    ["a different scheme", { returnUrl: "http://locaz.co/return" }],
    ["a different port", { returnUrl: "https://locaz.co:8443/return" }],
    ["no returnUrl", { returnUrl: null }],
    ["no externalRef", { externalRef: null }],
    ["an empty allow-list", { vendor: { businessName: "LOCAZ", partnerAllowedOrigins: [] } }],
    ["no vendor", { vendor: null }],
    ["a dashboard transaction", { source: "DASHBOARD" }],
  ])("returns null for %s", (_label, overrides) => {
    expect(resolvePartnerReturnTarget(partnerTransaction(overrides as never), "completed")).toBeNull()
  })

  it("links back after a cancellation only when the customer cancelled", () => {
    for (const cancelledBy of ["VENDOR", "ADMIN", "SYSTEM", null]) {
      expect(resolvePartnerReturnTarget(partnerTransaction({ link: { cancelledBy } }), "cancelled")).toBeNull()
    }
  })

  it("falls back to the return host when the vendor has no business name", () => {
    const target = resolvePartnerReturnTarget(
      partnerTransaction({ vendor: { businessName: " ", partnerAllowedOrigins: ALLOWED } }),
      "completed"
    )

    expect(target?.partnerName).toBe("locaz.co")
  })
})

describe("partner return link on the completion and cancelled screens", () => {
  it("renders the primary 'Return to LOCAZ' button for an allowed origin", () => {
    const markup = renderCompletion(partnerTransaction())

    expect(markup).toContain("Return to LOCAZ")
    expect(decodeHref(markup)).toBe("https://locaz.co/reservations/retour?lang=fr&booking=LOCAZ-BK-42&status=completed")
  })

  it("renders the French label", () => {
    expect(renderCompletion(partnerTransaction(), "fr")).toContain("Revenir sur LOCAZ")
  })

  it.each([
    ["a disallowed origin", { returnUrl: "https://evil.example/return" }],
    ["a missing returnUrl", { returnUrl: null }],
    ["a dashboard transaction", { source: "DASHBOARD" }],
  ])("renders nothing for %s", (_label, overrides) => {
    const markup = renderCompletion(partnerTransaction(overrides as never))

    expect(markup).toBe("")
    expect(markup).not.toContain("evil.example")
  })

  it("replaces 'Return Home' on the cancelled screen after a customer cancel", () => {
    const markup = renderCancelled(partnerTransaction())

    expect(markup).toContain("Return to LOCAZ")
    expect(decodeHref(markup)).toBe("https://locaz.co/reservations/retour?lang=fr&booking=LOCAZ-BK-42&status=cancelled")
    expect(markup).not.toContain("Return Home")
  })

  it("keeps the regular cancelled screen for a disallowed origin or a vendor cancel", () => {
    for (const overrides of [{ returnUrl: "https://evil.example/return" }, { link: { cancelledBy: "VENDOR" } }]) {
      const markup = renderCancelled(partnerTransaction(overrides))

      expect(markup).not.toContain("partner-return-link")
      expect(markup).toContain("Return Home")
    }
  })

  it("does not count down or redirect before the motion preference is known (server render)", () => {
    const markup = renderCompletion(partnerTransaction())

    expect(markup).not.toContain("partner-return-countdown")
    expect(markup).not.toContain("Taking you back")
    expect(markup).toContain('aria-live="polite"')
  })
})

describe("partner return countdown", () => {
  const run = (actions: Parameters<typeof partnerReturnCountdownReducer>[1][]) =>
    actions.reduce<PartnerReturnCountdownState>(partnerReturnCountdownReducer, initialPartnerReturnCountdown)

  it("counts down 5 seconds, then redirects", () => {
    expect(PARTNER_RETURN_COUNTDOWN_SECONDS).toBe(5)

    let state = run([{ type: "start", reducedMotion: false }])
    expect(state).toEqual({ phase: "counting", remaining: 5 })

    for (const remaining of [4, 3, 2, 1]) {
      state = partnerReturnCountdownReducer(state, { type: "tick" })
      expect(state).toEqual({ phase: "counting", remaining })
    }

    expect(partnerReturnCountdownReducer(state, { type: "tick" })).toEqual({ phase: "redirecting", remaining: 0 })
  })

  it("under reduced motion shows no countdown and never redirects automatically", () => {
    const state = run([{ type: "start", reducedMotion: true }, { type: "tick" }, { type: "tick" }, { type: "tick" }, { type: "tick" }, { type: "tick" }, { type: "tick" }])

    expect(state.phase).toBe("manual")
  })

  it("lets the customer stay on the page", () => {
    const state = run([{ type: "start", reducedMotion: false }, { type: "tick" }, { type: "stop" }, { type: "tick" }, { type: "tick" }, { type: "tick" }, { type: "tick" }])

    expect(state).toEqual({ phase: "stopped", remaining: 4 })
  })

  it("does nothing until started and starts only once", () => {
    expect(run([{ type: "tick" }, { type: "stop" }])).toEqual(initialPartnerReturnCountdown)
    expect(run([{ type: "start", reducedMotion: true }, { type: "start", reducedMotion: false }]).phase).toBe("manual")
  })
})
