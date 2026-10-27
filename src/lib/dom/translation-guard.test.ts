import { afterEach, describe, expect, it } from "vitest"

import { installTranslationGuard, TRANSLATION_GUARD_SCRIPT } from "./translation-guard"

/** A translated page must not crash React: removeChild / insertBefore on nodes a translator moved go through. */

/** The two DOM calls as browsers do them: they throw when the node is not a child of this parent. */
class FakeNode {
  parentNode: FakeNode | null = null
  childNodes: FakeNode[] = []
  constructor(readonly name: string) {}
  removeChild(child: FakeNode) {
    const index = this.childNodes.indexOf(child)
    if (index < 0) throw new Error("NotFoundError: removeChild")
    this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }
  insertBefore(node: FakeNode, reference: FakeNode | null) {
    node.parentNode?.removeChild(node)
    const index = reference ? this.childNodes.indexOf(reference) : this.childNodes.length
    if (index < 0) throw new Error("NotFoundError: insertBefore")
    this.childNodes.splice(index, 0, node)
    node.parentNode = this
    return node
  }
}

const original = { Node: (globalThis as { Node?: unknown }).Node }

function freshPrototype() {
  class Node extends FakeNode {}
  ;(globalThis as { Node?: unknown }).Node = Node
  return Node
}

afterEach(() => {
  ;(globalThis as { Node?: unknown }).Node = original.Node
})

describe("installTranslationGuard", () => {
  it("removes a node a translator moved from where it now is, and ignores one it took out of the page", () => {
    const Node = freshPrototype()
    installTranslationGuard()
    const button = new Node("button")
    const font = new Node("font")
    const label = new Node("#text")
    button.insertBefore(font, null)
    font.insertBefore(label, null)

    expect(() => button.removeChild(label)).not.toThrow()
    expect(font.childNodes).toEqual([])
    const detached = new Node("#text")
    expect(button.removeChild(detached)).toBe(detached)
  })

  it("inserts at the end when the reference node is no longer a child", () => {
    const Node = freshPrototype()
    installTranslationGuard()
    const parent = new Node("p")
    const moved = new Node("#text")
    const spinner = new Node("svg")
    expect(() => parent.insertBefore(spinner, moved)).not.toThrow()
    expect(parent.childNodes).toEqual([spinner])
  })

  it("leaves untouched pages as they are, and installs once", () => {
    const Node = freshPrototype()
    installTranslationGuard()
    const guarded = Node.prototype.removeChild
    installTranslationGuard()
    expect(Node.prototype.removeChild).toBe(guarded)
    const parent = new Node("ul")
    const first = new Node("li")
    const second = new Node("li")
    parent.insertBefore(second, null)
    parent.insertBefore(first, second)
    expect(parent.childNodes).toEqual([first, second])
    parent.removeChild(first)
    expect(parent.childNodes).toEqual([second])
  })

  it("ships as a script that runs on its own, as the page head runs it", () => {
    const Node = freshPrototype()
    new Function(TRANSLATION_GUARD_SCRIPT)()
    const parent = new Node("p")
    expect(() => parent.removeChild(new Node("#text"))).not.toThrow()
  })
})
