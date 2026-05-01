import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { hashPassword } from "@/features/auth/server/password"
import { registerSchema } from "@/features/auth/schemas/auth.schema"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsedBody = registerSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
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
        { success: false, message: "Email already exists" },
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
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: "Account created",
        user,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to create account",
      },
      { status: 500 }
    )
  }
}
