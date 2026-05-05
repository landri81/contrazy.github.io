declare module "pagedjs" {
  export class Previewer {
    constructor(options?: Record<string, unknown>)
    preview(
      content: DocumentFragment | HTMLElement,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: HTMLElement
    ): Promise<unknown>
  }
}
