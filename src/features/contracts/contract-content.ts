const htmlTagPattern = /<\/?[a-z][\s\S]*>/i

export function hasContractHtmlMarkup(content: string) {
  return htmlTagPattern.test(content)
}

export function escapeContractHtml(content: string) {
  return content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function normalizeContractTemplateMarkup(content: string) {
  const trimmed = content.trim()

  if (!trimmed) {
    return "<p><br></p>"
  }

  if (hasContractHtmlMarkup(trimmed)) {
    return trimmed
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split(/\n/).map(escapeContractHtml).join("<br>")}</p>`)
    .join("")

  return paragraphs || "<p><br></p>"
}

function decodeBasicEntities(content: string) {
  return content
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
}

export function stripContractMarkup(content: string) {
  const normalized = normalizeContractTemplateMarkup(content)

  return decodeBasicEntities(
    normalized
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|blockquote|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}
