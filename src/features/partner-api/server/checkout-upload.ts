import { getClientDocumentUploadFolder } from "@/features/client-flow/lib/client-document-uploads"
import { cloudinary } from "@/lib/integrations/cloudinary"

/**
 * A document of the embedded checkout stored where Contrazy's page stores it: the booking's link folder, PDFs as raw
 * files, images through Cloudinary's automatic type (as client-uploads-form does from the browser).
 */
export function uploadCheckoutDocument(file: { bytes: Buffer; fileName: string; pdf: boolean }, linkToken: string): Promise<{ publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: getClientDocumentUploadFolder(linkToken), resource_type: file.pdf ? "raw" : "auto", filename_override: file.fileName, use_filename: false },
      (error, result) => {
        if (error || !result?.public_id || !result.secure_url) reject(error ?? new Error("Cloudinary did not store the file."))
        else resolve({ publicId: result.public_id, secureUrl: result.secure_url })
      }
    )
    stream.end(file.bytes)
  })
}
