"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import {
  getCountries,
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input"
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

const DIAL_CODE_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryLabels[code] ?? code,
    flag: getFlagEmoji(code),
    dial: `+${getCountryCallingCode(code)}`,
  }))
  .filter((c) => c.name)
  .sort((a, b) => a.name.localeCompare(b.name))

type PhoneInputProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
}

export function PhoneInput({ value, onChange, id, className }: PhoneInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Derive initial country from value, default to US
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    if (value && value.startsWith("+")) {
      const match = DIAL_CODE_COUNTRIES.find((c) => value.startsWith(c.dial))
      if (match) return match.code as Country
    }
    return "US"
  })

  const selectedCountryData = DIAL_CODE_COUNTRIES.find((c) => c.code === selectedCountry)

  const filtered =
    query.trim().length === 0
      ? DIAL_CODE_COUNTRIES
      : DIAL_CODE_COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.dial.includes(query) ||
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
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  function handleCountrySelect(country: (typeof DIAL_CODE_COUNTRIES)[number]) {
    setSelectedCountry(country.code as Country)
    // Replace the dial code prefix in the current value
    const localPart = value.startsWith("+")
      ? value.slice(selectedCountryData?.dial.length ?? 2).trimStart()
      : value
    onChange(`${country.dial}${localPart ? " " + localPart : ""}`)
    setOpen(false)
    setQuery("")
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const dialPrefix = selectedCountryData?.dial ?? ""
    if (raw === "") {
      onChange("")
      return
    }
    // If user typed/pasted a full international number, keep as-is
    if (raw.startsWith("+")) {
      onChange(raw)
      return
    }
    onChange(`${dialPrefix} ${raw}`.trim())
  }

  // What to show in the number input (strip the dial code prefix)
  const displayValue = (() => {
    const dialPrefix = selectedCountryData?.dial ?? ""
    if (value.startsWith("+")) {
      const afterDial = value.slice(dialPrefix.length).trimStart()
      return afterDial
    }
    return value
  })()

  return (
    <div ref={containerRef} className={cn("relative flex", className)}>
      {/* Country dial code trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-sm",
          "transition-colors hover:bg-muted/80 focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "border-ring ring-3 ring-ring/50"
        )}
      >
        <span className="text-base leading-none">{selectedCountryData?.flag}</span>
        <span className="font-medium text-foreground">{selectedCountryData?.dial}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Number input */}
      <input
        id={id}
        type="tel"
        autoComplete="tel"
        placeholder="Enter phone number"
        value={displayValue}
        onChange={handleNumberChange}
        className={cn(
          "flex h-8 min-w-0 flex-1 rounded-r-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs outline-none",
          "placeholder:text-muted-foreground",
          "transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      />

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or dial code..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
            ) : (
              filtered.map((country) => (
                <li
                  key={country.code}
                  role="option"
                  aria-selected={country.code === selectedCountry}
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                    country.code === selectedCountry
                      ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="text-base leading-none">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="shrink-0 font-medium text-muted-foreground">{country.dial}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
