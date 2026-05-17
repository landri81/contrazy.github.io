import JSZip from "jszip"
import { NextResponse } from "next/server"

import {
  createDisputeEvidenceFetchUrl,
  parseDisputeEvidenceAssets,
} from "@/features/dashboard/server/dispute-evidence"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

function slugifySegment(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80)
}

function splitFileName(fileName: string | null | undefined) {
  const trimmed = (fileName ?? "").trim()
  const dotIndex = trimmed.lastIndexOf(".")

  if (dotIndex > 0 && dotIndex < trimmed.length - 1) {
    return {
      stem: trimmed.slice(0, dotIndex),
      ext: trimmed.slice(dotIndex + 1).toLowerCase(),
    }
  }

  return {
    stem: trimmed || "evidence-file",
    ext: "bin",
  }
}

function buildArchiveName(reference: string) {
  const slug = slugifySegment(reference) || "transaction"
  return `${slug}_dispute_evidence.zip`
}

function buildEntryName(reference: string, index: number, fileName: string | null | undefined) {
  const base = slugifySegment(reference) || "transaction"
  const parts = splitFileName(fileName)
  const safeStem = slugifySegment(parts.stem) || `evidence-${index + 1}`
  const safeExt = slugifySegment(parts.ext) || "bin"

  return `${base}_evidence_${String(index + 1).padStart(2, "0")}_${safeStem}.${safeExt}`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        vendorId: vendorProfile.id,
      },
      select: {
        reference: true,
        dispute: {
          select: {
            evidenceImages: true,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    const evidenceAssets = parseDisputeEvidenceAssets(transaction.dispute?.evidenceImages)

    if (evidenceAssets.length === 0) {
      return NextResponse.json({ success: false, message: "No dispute evidence files found." }, { status: 404 })
    }

    const zip = new JSZip()
    const failures: string[] = []
    let addedCount = 0

    await Promise.all(
      evidenceAssets.map(async (asset, index) => {
        try {
          const sourceUrl = createDisputeEvidenceFetchUrl(asset)
          const response = await fetch(sourceUrl)

          if (!response.ok) {
            throw new Error(`Upstream returned ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()

          if (!arrayBuffer.byteLength) {
            throw new Error("Empty file")
          }

          zip.file(buildEntryName(transaction.reference, index, asset.fileName), Buffer.from(arrayBuffer))
          addedCount += 1
        } catch (error) {
          console.warn("Dispute evidence ZIP entry failed", {
            transactionId,
            fileName: asset.fileName,
            error,
          })
          failures.push(asset.fileName || `evidence-${index + 1}`)
        }
      })
    )

    if (addedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Unable to prepare the dispute evidence archive." },
        { status: 502 }
      )
    }

    if (failures.length > 0) {
      zip.file("_failed_downloads.txt", failures.join("\n"))
    }

    const content = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
    const zipBody = new Uint8Array(content.byteLength)
    zipBody.set(content)

    return new NextResponse(new Blob([zipBody.buffer], { type: "application/zip" }), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${buildArchiveName(transaction.reference)}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Vendor dispute evidence ZIP failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to download dispute evidence right now." },
      { status: 500 }
    )
  }
}
