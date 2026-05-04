import packageJson from "../../../package.json"

export const APP_METADATA = {
  productName: "Contrazy",
  serviceName: "contrazy",
  version: packageJson.version,
} as const
