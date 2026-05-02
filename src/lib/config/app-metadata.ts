import packageJson from "../../../package.json"

export const APP_METADATA = {
  productName: "Conntrazy",
  serviceName: "conntrazy",
  version: packageJson.version,
} as const
