import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, ".env.local")
const targetPath = path.join(rootDir, ".env.test.local")

function parseEnvFile(content) {
  const entries = []

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = rawLine.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = rawLine.slice(0, separatorIndex).trim()
    const value = rawLine.slice(separatorIndex + 1)

    entries.push([key, value])
  }

  return entries
}

function withE2eSchema(databaseUrl) {
  const parsedUrl = new URL(databaseUrl)
  parsedUrl.searchParams.set("schema", "contrazy_e2e")
  return parsedUrl.toString()
}

if (!fs.existsSync(sourcePath)) {
  console.error("Missing .env.local. Create it before generating .env.test.local.")
  process.exit(1)
}

const sourceContent = fs.readFileSync(sourcePath, "utf8")
const sourceEntries = parseEnvFile(sourceContent)
const targetEntries = fs.existsSync(targetPath) ? parseEnvFile(fs.readFileSync(targetPath, "utf8")) : []
const envMap = new Map(targetEntries.length > 0 ? targetEntries : sourceEntries)
const sourceMap = new Map(sourceEntries)

if (!envMap.get("DATABASE_URL")) {
  console.error("DATABASE_URL is required in .env.local before generating .env.test.local.")
  process.exit(1)
}

envMap.set("NEXTAUTH_URL", "http://127.0.0.1:3100")
envMap.set("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3100")
envMap.delete("NODE_ENV")

for (const key of [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXTAUTH_SECRET",
]) {
  const sourceValue = sourceMap.get(key)

  if (sourceValue) {
    envMap.set(key, sourceValue)
  }
}

if (targetEntries.length === 0) {
  envMap.set("DATABASE_URL", withE2eSchema(envMap.get("DATABASE_URL")))
}

const orderedKeys = [...new Set([...sourceEntries.map(([key]) => key), ...targetEntries.map(([key]) => key), ...envMap.keys()])]
const outputLines = [
  "# Generated from .env.local for Playwright and isolated Prisma migrations.",
  "# Safe to edit if you want a separate disposable PostgreSQL database.",
  "",
]

for (const key of orderedKeys) {
  const value = envMap.get(key)

  if (value === undefined) {
    continue
  }

  outputLines.push(`${key}=${value}`)
}

outputLines.push("")
fs.writeFileSync(targetPath, outputLines.join("\n"), "utf8")

console.log(targetEntries.length > 0 ? "Updated .env.test.local" : "Created .env.test.local")
