declare module "html-to-text" {
  export type HtmlToTextOptions = {
    wordwrap?: number | false
    preserveNewlines?: boolean
    selectors?: Array<{
      selector: string
      options?: Record<string, unknown>
    }>
  }

  export function convert(html: string, options?: HtmlToTextOptions): string
}
