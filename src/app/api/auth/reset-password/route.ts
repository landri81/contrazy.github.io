import { NextResponse } from "next/server"

import { hashPassword } from "@/features/auth/server/password"
import { resetPasswordSchema } from "@/features/auth/schemas/auth.schema"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsedBody = resetPasswordSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsedBody.error.issues[0]?.message ?? "Invalid reset request",
        },
        { status: 400 }
      )
    }

    const { token, password } = parsedBody.data

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "Reset token is invalid or expired",
        },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    })

    await prisma.passwordResetToken.delete({
      where: { token },
    })

    return NextResponse.json({ success: true, message: "Password updated" })
  } catch (error) {
    console.error("Reset password error", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to update password",
      },
      { status: 500 }
    )
  }
}
