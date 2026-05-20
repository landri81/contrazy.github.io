import type { LocaleCode } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"

function toBaseSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
}

export async function generateSlug(locale: LocaleCode, title: string): Promise<string> {
  const base = toBaseSlug(title)
  const existing = await prisma.blogPostLocale.findUnique({
    where: { locale_slug: { locale, slug: base } },
    select: { id: true },
  })
  if (!existing) return base

  let n = 2
  while (true) {
    const candidate = `${base}-${n}`
    const conflict = await prisma.blogPostLocale.findUnique({
      where: { locale_slug: { locale, slug: candidate } },
      select: { id: true },
    })
    if (!conflict) return candidate
    n++
  }
}
