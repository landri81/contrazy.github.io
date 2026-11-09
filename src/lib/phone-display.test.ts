import { describe, expect, it } from "vitest"

import { displayPhone } from "./phone-display"

describe("displayPhone", () => {
  it("spaces an international number the way it is read", () => {
    expect(displayPhone("+33744712273")).toBe("+33 7 44 71 22 73")
    expect(displayPhone(" +33141859484 ")).toBe("+33 1 41 85 94 84")
    expect(displayPhone("+447700900123")).toBe("+44 7700 900123")
  })

  it("keeps a number it cannot read as typed", () => {
    expect(displayPhone("07 44 71 22 73")).toBe("07 44 71 22 73")
    expect(displayPhone("+33 7 44 71 22 73")).toBe("+33 7 44 71 22 73")
  })
})
