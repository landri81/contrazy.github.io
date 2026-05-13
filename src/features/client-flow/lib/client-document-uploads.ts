export const CLIENT_DOCUMENT_UPLOAD_FOLDER = "conntrazy/client-documents"
export const CLIENT_REPORT_UPLOAD_FOLDER = "conntrazy/report-assets"

export function getClientDocumentUploadFolder(token: string) {
  return `${CLIENT_DOCUMENT_UPLOAD_FOLDER}/${token}`
}

export function getClientReportUploadFolder(token: string, reportType: string) {
  return `${CLIENT_REPORT_UPLOAD_FOLDER}/${token}/${reportType.toLowerCase()}`
}

export function isManagedClientDocumentPublicId(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(`${CLIENT_DOCUMENT_UPLOAD_FOLDER}/`)
}

export function isManagedReportAssetPublicId(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(`${CLIENT_REPORT_UPLOAD_FOLDER}/`)
}
