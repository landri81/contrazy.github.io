export const CLIENT_DOCUMENT_UPLOAD_FOLDER = "conntrazy/client-documents"

export function getClientDocumentUploadFolder(token: string) {
  return `${CLIENT_DOCUMENT_UPLOAD_FOLDER}/${token}`
}

export function isManagedClientDocumentPublicId(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(`${CLIENT_DOCUMENT_UPLOAD_FOLDER}/`)
}
