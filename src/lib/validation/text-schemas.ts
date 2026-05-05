import { z } from "zod"

import { INPUT_LIMITS, PHONE_REGEX } from "@/lib/validation/input-limits"

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value
}

type RequiredTextOptions = {
  min?: number
  requiredMessage?: string
}

export function requiredText(
  label: string,
  max: number,
  options: RequiredTextOptions = {}
) {
  const min = options.min ?? 1

  return z.preprocess(
    trimString,
    z
      .string()
      .min(min, options.requiredMessage ?? `${label} is required`)
      .max(max, `${label} must be ${max} characters or fewer`)
  )
}

export function optionalText(label: string, max: number) {
  return z.preprocess(
    trimString,
    z.union([
      z.literal(""),
      z.string().max(max, `${label} must be ${max} characters or fewer`),
    ])
  )
}

export function optionalNullableText(label: string, max: number) {
  return z.preprocess(
    trimString,
    z.union([
      z.literal(""),
      z.string().max(max, `${label} must be ${max} characters or fewer`),
      z.null(),
    ])
  )
}

export function emailText(label = "Email address") {
  return z.preprocess(
    trimString,
    z
      .string()
      .max(INPUT_LIMITS.email, `${label} must be ${INPUT_LIMITS.email} characters or fewer`)
      .email(`Please provide a valid ${label.toLowerCase()}`)
  )
}

export function optionalEmailText(label = "Email address") {
  return z.preprocess(
    trimString,
    z.union([
      z.literal(""),
      z
        .string()
        .max(INPUT_LIMITS.email, `${label} must be ${INPUT_LIMITS.email} characters or fewer`)
        .email(`${label} must be valid`),
    ])
  )
}

export function phoneText(label = "Phone number", required = true) {
  const base = z
    .string()
    .max(INPUT_LIMITS.phone, `${label} must be ${INPUT_LIMITS.phone} characters or fewer`)
    .regex(PHONE_REGEX, "Enter a valid phone number with country code (e.g. +1 202 555 0100)")

  if (required) {
    return z.preprocess(
      trimString,
      base.min(1, `${label} is required`)
    )
  }

  return z.preprocess(trimString, z.union([z.literal(""), base]))
}
