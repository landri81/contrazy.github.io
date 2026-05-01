import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { forgotPasswordSchema } from "@/features/auth/schemas/auth.schema"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { resend } from "@/lib/integrations/resend"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsedBody = forgotPasswordSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsedBody.error.issues[0]?.message ?? "Invalid email",
        },
        { status: 400 }
      )
    }

    const email = parsedBody.data.email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ success: true, message: "Reset request processed" })
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    const baseUrl = env.NEXTAUTH_URL ?? "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: user.email,
      subject: "Conntrazy password reset",
      html: `
        <h2>Conntrazy password reset</h2>
        <p>Use the link below to set a new password.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
      `,
    })

    return NextResponse.json({ success: true, message: "Reset request processed" })
  } catch (error) {
    console.error("Forgot password error", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to process reset request",
      },
      { status: 500 }
    )
  }
}
