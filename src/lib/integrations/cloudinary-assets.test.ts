import { describe, expect, it } from "vitest"

import { trimmedCloudinaryImageUrl } from "./cloudinary-assets"

describe("trimmedCloudinaryImageUrl", () => {
  const logo = "https://res.cloudinary.com/demo/image/upload/v1782932986/conntrazy/vendor-logos/v1/logo.jpg"

  it("asks Cloudinary to cut the logo's plain border", () => {
    expect(trimmedCloudinaryImageUrl(logo)).toBe("https://res.cloudinary.com/demo/image/upload/e_trim/v1782932986/conntrazy/vendor-logos/v1/logo.jpg")
  })

  it("trims once and keeps other URLs as they are", () => {
    expect(trimmedCloudinaryImageUrl(trimmedCloudinaryImageUrl(logo))).toBe(trimmedCloudinaryImageUrl(logo))
    expect(trimmedCloudinaryImageUrl("https://www.locaz.co/logo.png")).toBe("https://www.locaz.co/logo.png")
    expect(trimmedCloudinaryImageUrl("https://res.cloudinary.com/demo/raw/upload/v1/contract.pdf")).toBe("https://res.cloudinary.com/demo/raw/upload/v1/contract.pdf")
  })
})
