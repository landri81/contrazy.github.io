import { CLIENT_DOCUMENT_UPLOAD_FOLDER, CLIENT_KYC_UPLOAD_FOLDER, CLIENT_REPORT_UPLOAD_FOLDER } from "@/features/client-flow/lib/client-document-uploads"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

export const DISPUTE_EVIDENCE_UPLOAD_FOLDER = "conntrazy/disputes"

const SEGMENT = "[A-Za-z0-9_-]{8,128}"
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
const CLIENT_FOLDER = new RegExp(`^(?:${escape(CLIENT_DOCUMENT_UPLOAD_FOLDER)}|${escape(CLIENT_KYC_UPLOAD_FOLDER)})/(${SEGMENT})$`)
const REPORT_FOLDER = new RegExp(`^${escape(CLIENT_REPORT_UPLOAD_FOLDER)}/(${SEGMENT})/[a-z0-9_-]{1,40}$`)
const DISPUTE_FOLDER = new RegExp(`^${escape(DISPUTE_EVIDENCE_UPLOAD_FOLDER)}/(${SEGMENT})$`)

export type UploadFolderTarget = { kind: "client"; token: string } | { kind: "dispute"; transactionId: string } | null

/** Which record an upload folder belongs to: a customer's secure link, or a dispute's transaction. Null otherwise. */
export function parseUploadFolder(folder: string): UploadFolderTarget {
  const client = CLIENT_FOLDER.exec(folder) ?? REPORT_FOLDER.exec(folder)
  if (client) return { kind: "client", token: client[1] }
  const dispute = DISPUTE_FOLDER.exec(folder)
  if (dispute) return { kind: "dispute", transactionId: dispute[1] }
  return null
}

/**
 * Whether the caller may upload into `folder`: the customer folders of a secure link still live, or a dispute's folder
 * for the vendor owning that transaction (admins too). Every other folder is refused.
 */
export async function resolveUploadFolderAccess(folder: string): Promise<{ allowed: true } | { allowed: false; status: 400 | 401 | 403 }> {
  const target = parseUploadFolder(folder)
  if (!target) return { allowed: false, status: 400 }

  if (target.kind === "client") {
    const link = await getClientLinkAccessContext(target.token)
    return link.state === "active" ? { allowed: true } : { allowed: false, status: 403 }
  }

  const session = await getAuthSession()
  if (!session?.user?.id) return { allowed: false, status: 401 }
  if (canAccessAdminScope(session.user.role)) return { allowed: true }
  const owned = await prisma.transaction.findFirst({
    where: { id: target.transactionId, vendor: { userId: session.user.id } },
    select: { id: true },
  })
  return owned ? { allowed: true } : { allowed: false, status: 403 }
}
