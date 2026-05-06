/**
 * Shared document model for contract rendering.
 *
 * Both the browser preview (ContractDocumentViewer) and the server-side PDF
 * builder (buildSignedContractPdf) derive their structure from the same
 * DocumentBlock representation so heading levels, paragraph rules, list
 * treatment, and whitespace handling stay aligned as the codebase evolves.
 *
 * The browser renderer passes DocumentBlocks implicitly through CSS class
 * rules on the rendered HTML elements. The PDF builder walks the block array
 * directly to emit pdf-lib drawing calls. Either way the source of truth for
 * "what constitutes a heading / list-item / paragraph" lives here.
 */

export type DocumentBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "para"; text: string }
  | { type: "li"; text: string }
  | { type: "blank" }

// ─── HTML entity decoding ────────────────────────────────────────────────────
// Mirrors the entity set handled by escapeContractHtml / decodeBasicEntities
// in contract-content.ts so the round-trip is lossless.

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function innerText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .trim()
  )
}

// ─── HTML → DocumentBlock[] ──────────────────────────────────────────────────
//
// Accepts sanitised contract HTML (output of renderContractContent /
// normalizeContractTemplateMarkup + sanitize-html) and returns an ordered
// array of typed blocks. The browser viewer renders these implicitly via DOM
// injection; the PDF builder consumes the array directly.
//
// Supported input elements: h1–h3, p, li (inside ol/ul), blockquote, br.
// Any other tags are transparently skipped; their text content is preserved
// if they wrap text directly (handled by the fallback plain-text pattern).

export function htmlToDocumentBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = []
  let rest = html.replace(/\r\n?/g, "\n")

  const patterns: Array<[RegExp, (m: RegExpMatchArray) => void]> = [
    // Headings
    [
      /^<h1[^>]*>([\s\S]*?)<\/h1>/i,
      (m) => { const t = innerText(m[1]); if (t) blocks.push({ type: "h1", text: t }) },
    ],
    [
      /^<h2[^>]*>([\s\S]*?)<\/h2>/i,
      (m) => { const t = innerText(m[1]); if (t) blocks.push({ type: "h2", text: t }) },
    ],
    [
      /^<h3[^>]*>([\s\S]*?)<\/h3>/i,
      (m) => { const t = innerText(m[1]); if (t) blocks.push({ type: "h3", text: t }) },
    ],
    // List items (rendered before ol/ul wrappers are skipped)
    [
      /^<li[^>]*>([\s\S]*?)<\/li>/i,
      (m) => { const t = innerText(m[1]); if (t) blocks.push({ type: "li", text: `• ${t}` }) },
    ],
    // Paragraphs — br inside a <p> produces a blank DocumentBlock
    [
      /^<p[^>]*>([\s\S]*?)<\/p>/i,
      (m) => {
        const text = decodeEntities(
          m[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
        )
        for (const line of text.split("\n")) {
          const t = line.trim()
          if (t) blocks.push({ type: "para", text: t })
          else blocks.push({ type: "blank" })
        }
      },
    ],
    // Blockquote — rendered as an indented paragraph
    [
      /^<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i,
      (m) => {
        const t = innerText(m[1])
        if (t) blocks.push({ type: "para", text: `  "${t}"` })
      },
    ],
    // Skip all other tags (ol, ul, strong, em, a, …) — text extracted below
    [/^<[^>]+>/, () => {}],
    // Bare text nodes between tags
    [
      /^[^<]+/,
      (m) => {
        const t = decodeEntities(m[0]).trim()
        if (t) blocks.push({ type: "para", text: t })
      },
    ],
  ]

  while (rest.length > 0) {
    // Skip pure-whitespace sequences
    if (/^\s+$/.test(rest.slice(0, 1))) {
      const ws = rest.match(/^\s+/)
      if (ws) { rest = rest.slice(ws[0].length); continue }
    }

    let matched = false
    for (const [pattern, handler] of patterns) {
      const m = rest.match(pattern)
      if (m) {
        handler(m)
        rest = rest.slice(m[0].length)
        matched = true
        break
      }
    }
    if (!matched) rest = rest.slice(1)
  }

  return blocks
}
