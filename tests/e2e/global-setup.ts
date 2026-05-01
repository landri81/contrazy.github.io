import { execFileSync } from "node:child_process"

export default async function globalSetup() {
  execFileSync("npm", ["run", "e2e:seed"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
}
