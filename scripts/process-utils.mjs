import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export function isDirectRun(importMetaUrl) {
  return process.argv[1] ? importMetaUrl === pathToFileURL(process.argv[1]).href : false
}

export function ensureDatabaseEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the current environment.")
  }

  if (!process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL
  }
}

export async function runNpx(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx"
  const shellCommand = [command, ...args]
    .map((part) => (/[\s"]/u.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part))
    .join(" ")

  try {
    const result = spawnSync(shellCommand, {
      env: process.env,
      cwd: process.cwd(),
      shell: true,
      encoding: "utf8",
    })

    if (result.stdout) {
      process.stdout.write(result.stdout)
    }

    if (result.stderr) {
      process.stderr.write(result.stderr)
    }

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      const detail = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join("\n")
      const error = new Error(`${shellCommand} failed with exit code ${result.status}.`)
      error.output = detail
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error && typeof error === "object" && "output" in error) {
      const wrapped = new Error(message)
      wrapped.output = error.output
      throw wrapped
    }

    throw new Error(message)
  }
}
