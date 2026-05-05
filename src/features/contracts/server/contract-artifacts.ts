import { createHash } from "crypto"

import type { Prisma, PrismaClient } from "@prisma/client"
import { PDFDocument, StandardFonts } from "pdf-lib"

import { renderContractContent, renderContractContentText } from "@/features/contracts/server/contract-rendering"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { cloudinary } from "@/lib/integrations/cloudinary"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

type ContractTemplateSnapshot = {
  id: string
  name: string
  description: string | null
  content: string
}

const contractArtifactInclude = {
  vendor: true,
  clientProfile: true,
  contractTemplate: true,
  contractArtifact: true,
  signatureRecord: true,
} satisfies Prisma.TransactionInclude

type TransactionWithContractContext = Prisma.TransactionGetPayload<{
  include: typeof contractArtifactInclude
}>

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function splitLongWord(word: string, maxLength: number) {
  if (word.length <= maxLength) {
    return [word]
  }

  const chunks: string[] = []

  for (let index = 0; index < word.length; index += maxLength) {
    chunks.push(word.slice(index, index + maxLength))
  }

  return chunks
}

function wrapLine(line: string, maxCharacters = 94) {
  if (!line.trim()) {
    return [""]
  }

  const words = line.split(/\s+/)
  const wrapped: string[] = []
  let current = ""

  for (const rawWord of words) {
    const wordParts = splitLongWord(rawWord, maxCharacters)

    for (const word of wordParts) {
      const next = current ? `${current} ${word}` : word

      if (next.length > maxCharacters) {
        if (current) {
          wrapped.push(current)
        }
        current = word
      } else {
        current = next
      }
    }
  }

  if (current) {
    wrapped.push(current)
  }

  return wrapped
}

async function uploadRawPdf(buffer: Buffer, transactionReference: string) {
  const publicId = `contracts/${slugifySegment(transactionReference)}-signed`

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "conntrazy",
        public_id: publicId,
        resource_type: "raw",
        format: "pdf",
        overwrite: true,
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error("Cloudinary PDF upload failed"))
          return
        }

        resolve({ secure_url: uploadResult.secure_url, public_id: uploadResult.public_id })
      }
    )

    stream.end(buffer)
  })

  return result
}

async function uploadSignatureImage(signatureDataUrl: string, transactionReference: string) {
  const publicId = `contracts/${slugifySegment(transactionReference)}-signature`

  const result = await cloudinary.uploader.upload(signatureDataUrl, {
    folder: "conntrazy",
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
  })

  return { secureUrl: result.secure_url, publicId: result.public_id }
}

async function buildSignedContractPdf({
  transactionReference,
  vendorName,
  clientName,
  renderedContent,
  signedAt,
  signedTimezone,
  signatureBytes,
}: {
  transactionReference: string
  vendorName: string
  clientName: string
  renderedContent: string
  signedAt: Date
  signedTimezone: string
  signatureBytes: Uint8Array
}) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const signature = await pdf.embedPng(signatureBytes)

  const width = 595.28
  const height = 841.89
  const margin = 48
  const lineHeight = 16
  const maxY = height - margin
  const minY = margin

  let page = pdf.addPage([width, height])
  let cursorY = maxY

  const addPage = () => {
    page = pdf.addPage([width, height])
    cursorY = maxY
  }

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < minY) {
      addPage()
    }
  }

  const drawLine = (text: string, options?: { font?: typeof regular; size?: number }) => {
    const font = options?.font ?? regular
    const size = options?.size ?? 11
    ensureSpace(lineHeight)
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size,
      font,
    })
    cursorY -= lineHeight
  }

  drawLine("Signed agreement", { font: bold, size: 18 })
  drawLine(`Reference: ${transactionReference}`)
  drawLine(`Vendor: ${vendorName}`)
  drawLine(`Client: ${clientName}`)
  drawLine(`Signed at: ${signedAt.toISOString()} (${signedTimezone})`)
  cursorY -= 8

  for (const rawLine of renderedContent.split(/\r?\n/)) {
    const wrappedLines = wrapLine(rawLine)

    for (const line of wrappedLines) {
      drawLine(line)
    }
  }

  cursorY -= 8
  ensureSpace(signature.height * 0.2 + 72)
  drawLine("Client signature", { font: bold, size: 12 })
  const signatureScale = 0.2
  const signatureHeight = signature.height * signatureScale
  const signatureWidth = signature.width * signatureScale
  page.drawImage(signature, {
    x: margin,
    y: cursorY - signatureHeight,
    width: signatureWidth,
    height: signatureHeight,
  })
  cursorY -= signatureHeight + 12
  drawLine(clientName || "Client")

  return pdf.save()
}

function getTemplateContentSnapshot(transaction: TransactionWithContractContext) {
  return (
    transaction.contractArtifact?.templateContentSnapshot ??
    transaction.contractTemplate?.content ??
    ""
  )
}

export async function createTransactionContractArtifact(
  db: DatabaseClient,
  input: {
    transactionId: string
    contractTemplate: ContractTemplateSnapshot | null
  }
) {
  if (!input.contractTemplate) {
    return null
  }

  const artifact = await db.transactionContractArtifact.upsert({
    where: { transactionId: input.transactionId },
    update: {
      sourceTemplateId: input.contractTemplate.id,
      sourceTemplateName: input.contractTemplate.name,
      sourceTemplateDescription: input.contractTemplate.description,
      templateContentSnapshot: input.contractTemplate.content,
    },
    create: {
      transactionId: input.transactionId,
      sourceTemplateId: input.contractTemplate.id,
      sourceTemplateName: input.contractTemplate.name,
      sourceTemplateDescription: input.contractTemplate.description,
      templateContentSnapshot: input.contractTemplate.content,
    },
  })

  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "CONTRACT_SNAPSHOT_CREATED",
    title: "Contract snapshot created",
    detail: `A transaction-level contract snapshot was created from "${input.contractTemplate.name}".`,
    dedupeKey: `event:contract-snapshot:${input.transactionId}`,
  })

  return artifact
}

export async function ensureTransactionContractArtifact(
  db: DatabaseClient,
  transactionId: string
) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      contractTemplate: true,
      contractArtifact: true,
    },
  })

  if (!transaction?.contractTemplate) {
    return null
  }

  if (transaction.contractArtifact) {
    return transaction.contractArtifact
  }

  return createTransactionContractArtifact(db, {
    transactionId,
    contractTemplate: {
      id: transaction.contractTemplate.id,
      name: transaction.contractTemplate.name,
      description: transaction.contractTemplate.description,
      content: transaction.contractTemplate.content,
    },
  })
}

export async function persistReviewedContractSnapshot(
  db: DatabaseClient,
  transactionId: string
) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: contractArtifactInclude,
  })

  if (!transaction) {
    return null
  }

  const templateContentSnapshot = getTemplateContentSnapshot(transaction)

  if (!templateContentSnapshot) {
    return null
  }

  await ensureTransactionContractArtifact(db, transactionId)

  const renderedContentBeforeSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
  })

  return db.transactionContractArtifact.update({
    where: { transactionId },
    data: {
      renderedContentBeforeSignature,
      reviewCompletedAt: new Date(),
    },
  })
}

export async function generateSignedContractArtifact(
  db: DatabaseClient,
  input: {
    transactionId: string
    signatureDataUrl: string
    signedTimezone?: string | null
  }
) {
  const transaction = await db.transaction.findUnique({
    where: { id: input.transactionId },
    include: contractArtifactInclude,
  })

  if (!transaction?.clientProfile) {
    return null
  }

  const templateContentSnapshot = getTemplateContentSnapshot(transaction)

  if (!templateContentSnapshot) {
    return null
  }

  await ensureTransactionContractArtifact(db, input.transactionId)

  const signedAt = new Date()
  const signedTimezone = input.signedTimezone?.trim() || "UTC"
  const signerName =
    transaction.signatureRecord?.signerName ||
    transaction.clientProfile.fullName ||
    "Client"

  const renderedContentBeforeSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
  })

  const renderedContentAfterSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
    signerName,
    signedAt,
    signedTimezone,
  })

  const signatureUpload = await uploadSignatureImage(input.signatureDataUrl, transaction.reference)
  const signatureBytes = Buffer.from(input.signatureDataUrl.split(",")[1] ?? "", "base64")
  const pdfBytes = await buildSignedContractPdf({
    transactionReference: transaction.reference,
    vendorName: transaction.vendor?.businessName ?? "Vendor",
    clientName: signerName,
    renderedContent: renderContractContentText({
      templateContent: templateContentSnapshot,
      clientProfile: transaction.clientProfile,
      vendorName: transaction.vendor?.businessName,
      transactionReference: transaction.reference,
      amount: transaction.amount,
      depositAmount: transaction.depositAmount,
      signerName,
      signedAt,
      signedTimezone,
    }),
    signedAt,
    signedTimezone,
    signatureBytes,
  })
  const pdfBuffer = Buffer.from(pdfBytes)
  const signedPdfHash = createHash("sha256").update(pdfBuffer).digest("hex")
  const pdfUpload = await uploadRawPdf(pdfBuffer, transaction.reference)

  const artifact = await db.transactionContractArtifact.update({
    where: { transactionId: input.transactionId },
    data: {
      renderedContentBeforeSignature,
      renderedContentAfterSignature,
      signatureImageUrl: signatureUpload.secureUrl,
      signatureImagePublicId: signatureUpload.publicId,
      signedPdfUrl: pdfUpload.secure_url,
      signedPdfPublicId: pdfUpload.public_id,
      signedPdfHash,
      signedAt,
      signedTimezone,
    },
  })

  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "SIGNED_PDF_GENERATED",
    title: "Signed agreement generated",
    detail: "The final signed PDF artifact was generated and stored.",
    metadata: {
      signedPdfUrl: artifact.signedPdfUrl,
      signedPdfHash: artifact.signedPdfHash,
    },
    dedupeKey: `event:signed-pdf:${input.transactionId}`,
  })

  return artifact
}
