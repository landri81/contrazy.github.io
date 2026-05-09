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
    const passwordHash = await hashPassword(password)
    const now = new Date()

    const resetResult = await prisma.$transaction(async (tx) => {
      const resetRecord = await tx.passwordResetToken.findFirst({
        where: {
          token,
          expiresAt: { gte: now },
        },
        select: {
          id: true,
          userId: true,
        },
      })

      if (!resetRecord) {
        return { ok: false as const }
      }

      const consumedToken = await tx.passwordResetToken.deleteMany({
        where: { id: resetRecord.id },
      })

      if (consumedToken.count !== 1) {
        return { ok: false as const }
      }

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      })

      await tx.passwordResetToken.deleteMany({
        where: { userId: resetRecord.userId },
      })

      return { ok: true as const }
    })

    if (!resetResult.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Reset token is invalid or expired",
        },
        { status: 400 }
      )
    }

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
