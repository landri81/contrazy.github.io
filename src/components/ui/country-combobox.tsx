"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { getCountries } from "react-phone-number-input"
import en from "react-phone-number-input/locale/en.json"

import { cn } from "@/lib/utils"

type CountryLabels = Record<string, string>
const countryLabels = en as CountryLabels

function getFlagEmoji(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
    .join("")
}

const ALL_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryLabels[code] ?? code,
    flag: getFlagEmoji(code),
  }))
  .filter((c) => c.name)
  .sort((a, b) => a.name.localeCompare(b.name))

type CountryComboboxProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
}

export function CountryCombobox({
  value,
  onChange,
  id,
  placeholder = "Select country",
  className,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = ALL_COUNTRIES.find(
    (c) => c.code === value || c.name.toLowerCase() === value.toLowerCase()
  )

  const filtered =
    query.trim().length === 0
      ? ALL_COUNTRIES
      : ALL_COUNTRIES.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase())
        )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  function handleSelect(country: (typeof ALL_COUNTRIES)[number]) {
    onChange(country.code)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors",
          "hover:border-ring/50 focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          !selected && "text-muted-foreground"
        )}
      >
        {selected ? (
          <>
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="flex-1 truncate text-left">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-left">{placeholder}</span>
        )}
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country..."
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
            ) : (
              filtered.map((country) => (
                <li
                  key={country.code}
                  role="option"
                  aria-selected={country.code === selected?.code}
                  onClick={() => handleSelect(country)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                    country.code === selected?.code
                      ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="text-base leading-none">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  {country.code === selected?.code && <Check className="size-3.5 shrink-0" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
