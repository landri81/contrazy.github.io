import { NextResponse } from "next/server"
import { z } from "zod"
import { headers } from "next/headers"

import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { sendContactAutoReply, sendAdminContactNotification } from "@/lib/integrations/resend"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { emailText, requiredText } from "@/lib/validation/text-schemas"

export const runtime = "nodejs"

const contactSchema = z.object({
  firstName: requiredText("First name", INPUT_LIMITS.personName),
  lastName: requiredText("Last name", INPUT_LIMITS.personName),
  email: emailText("Email address"),
  message: requiredText("Message", INPUT_LIMITS.contactMessage, { min: 10 }),
  locale: z.enum(["en", "fr"]).default("en"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { firstName, lastName, email, message, locale } = parsed.data

    const headersList = await headers()
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      null

    const contact = await prisma.contactMessage.create({
      data: {
        firstName,
        lastName,
        email,
        message,
        locale,
        ipAddress,
      },
    })

    await Promise.allSettled([
      sendContactAutoReply(email, firstName, locale),
      sendAdminContactNotification(
        env.SUPER_ADMIN_EMAIL,
        firstName,
        lastName,
        email,
        message,
        contact.id,
        locale
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Contact form submission error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to send message. Please try again." },
      { status: 500 }
    )
  }
}
