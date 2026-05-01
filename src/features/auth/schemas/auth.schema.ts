import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  businessName: z.string().min(2, "Business name is required").max(120),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
