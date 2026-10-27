/**
 * Browser translators (Chrome's Google Translate, Edge, Safari) replace the page's text nodes with their own <font>
 * elements while React still holds the original nodes. The next update that removes one of them, or inserts next to
 * it, throws a NotFoundError (removeChild / insertBefore) and the page falls to "This page couldn't load": a translated
 * French LOCAZ booking page crashed this way (27 Oct), and Contrazy's customer flow is French by default too. Run before
 * React starts, this guard lets those two calls go through when a translator moved the node (the usual workaround,
 * facebook/react#11538): the removal happens where the node now is, the insertion at the end of the parent. Untranslated
 * pages never reach it.
 */
export function installTranslationGuard() {
  if (typeof Node !== "function" || !Node.prototype) return
  const proto = Node.prototype as Node & { __translationGuard?: boolean }
  if (proto.__translationGuard) return

  const removeChild = proto.removeChild
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child && child.parentNode !== this) {
      if (child.parentNode) return removeChild.call(child.parentNode, child) as T
      return child
    }
    return removeChild.call(this, child) as T
  }

  const insertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return insertBefore.call(this, node, null) as T
    return insertBefore.call(this, node, reference) as T
  }

  proto.__translationGuard = true
}

/** The guard as an inline script for the document head (the CSP allows inline scripts). */
export const TRANSLATION_GUARD_SCRIPT = `(${installTranslationGuard.toString()})()`
