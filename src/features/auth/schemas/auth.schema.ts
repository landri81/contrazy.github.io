import { z } from "zod"

import {
  INPUT_LIMITS,
  LOGIN_PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/input-limits"
import { emailText, requiredText } from "@/lib/validation/text-schemas"

export const loginSchema = z.object({
  email: emailText("Email address"),
  password: z
    .string()
    .min(LOGIN_PASSWORD_MIN_LENGTH, `Password must be at least ${LOGIN_PASSWORD_MIN_LENGTH} characters`)
    .max(INPUT_LIMITS.password, `Password must be ${INPUT_LIMITS.password} characters or fewer`),
})

export const registerSchema = z
  .object({
    name: requiredText("Name", INPUT_LIMITS.personName, { min: 2, requiredMessage: "Name is required" }),
    email: emailText("Email address"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(INPUT_LIMITS.password, `Password must be ${INPUT_LIMITS.password} characters or fewer`),
    confirmPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Please retype your password")
      .max(INPUT_LIMITS.password, `Password must be ${INPUT_LIMITS.password} characters or fewer`),
    businessName: requiredText("Business name", INPUT_LIMITS.businessName, {
      min: 2,
      requiredMessage: "Business name is required",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: emailText("Email address"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(INPUT_LIMITS.password, `Password must be ${INPUT_LIMITS.password} characters or fewer`),
    confirmPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Please retype your password")
      .max(INPUT_LIMITS.password, `Password must be ${INPUT_LIMITS.password} characters or fewer`),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
