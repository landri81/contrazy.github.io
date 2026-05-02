import { NextResponse } from "next/server"
import { z } from "zod"

import { APP_METADATA } from "@/lib/config/app-metadata"
import { env } from "@/lib/env"
import { resend } from "@/lib/integrations/resend"

const payloadSchema = z.object({
  to: z.string().email(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsedBody = payloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsedBody.error.issues[0]?.message ?? "Invalid email",
        },
        { status: 400 }
      )
    }

    const { to } = parsedBody.data

    const emailResult = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: `${APP_METADATA.productName} integration test email`,
      html: `
        <h2>${APP_METADATA.productName} Integration Check</h2>
        <p>Your Resend integration is configured and working.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    })

    return NextResponse.json({
      ok: true,
      service: "resend",
      emailId: emailResult.data?.id ?? null,
    })
  } catch (error) {
    console.error("Resend test email failed", error)
    return NextResponse.json(
      {
        ok: false,
        service: "resend",
        message: "Failed to send test email",
      },
      { status: 500 }
    )
  }
}
