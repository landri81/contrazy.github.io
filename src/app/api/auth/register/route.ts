import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { hashPassword } from "@/features/auth/server/password"
import { registerSchema } from "@/features/auth/schemas/auth.schema"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { resolveRequestLocale } from "@/lib/i18n/locale-utils"
import { sendAdminNewVendorSignupEmail, sendVendorWelcomeEmail } from "@/lib/integrations/resend"

export async function POST(request: Request) {
  try {
    const locale = resolveRequestLocale(request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, code: "INVALID_JSON", message: "Invalid request body" },
        { status: 400 }
      )
    }

    const parsedBody = registerSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_INPUT",
          message: parsedBody.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 }
      )
    }

    const { name, email, password, businessName } = parsedBody.data
    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, code: "EMAIL_EXISTS", message: "Email already exists" },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: UserRole.VENDOR,
        vendorProfile: {
          create: {
            businessName,
            businessEmail: normalizedEmail,
            preferredLocale: locale === "fr" ? "fr" : "en",
          },
        },
      },
      select: { id: true, email: true, name: true },
    })

    // Send welcome email to new vendor (in their locale)
    sendVendorWelcomeEmail(normalizedEmail, name || businessName, locale).catch((e) =>
      console.error("Welcome email skipped", e)
    )

    // Notify superadmin — always in French
    sendAdminNewVendorSignupEmail(
      env.SUPER_ADMIN_EMAIL,
      businessName || name,
      normalizedEmail,
      user.id
    ).catch((e) => console.error("Admin signup notification skipped", e))

    return NextResponse.json(
      { success: true, code: "ACCOUNT_CREATED", message: "Account created", user },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error", error)
    return NextResponse.json(
      { success: false, code: "ACCOUNT_CREATE_FAILED", message: "Unable to create account" },
      { status: 500 }
    )
  }
}
