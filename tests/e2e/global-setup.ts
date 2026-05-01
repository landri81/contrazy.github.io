import { execFileSync } from "node:child_process"

export default async function globalSetup() {
  execFileSync("npm", ["run", "e2e:prepare"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
}
