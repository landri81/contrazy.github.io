declare module "qrcode" {
  interface QRCodeOptions {
    version?: number
    errorCorrectionLevel?: "L" | "M" | "Q" | "H"
    type?: string
    quality?: number
    margin?: number
    color?: { dark?: string; light?: string }
    width?: number
    scale?: number
    small?: boolean
  }

  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  function toDataURL(text: string, options: QRCodeOptions, cb: (err: Error | null, url: string) => void): void
  function toDataURL(text: string, cb: (err: Error | null, url: string) => void): void

  function toString(text: string, options?: QRCodeOptions): Promise<string>
  function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeOptions): Promise<void>
  function toFile(path: string, text: string, options?: QRCodeOptions): Promise<void>
  function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>
}
