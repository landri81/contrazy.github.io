import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  CarFront,
  Coins,
  Fuel,
  Gauge,
  Hash,
  ListChecks,
  MapPin,
  Puzzle,
  ShieldCheck,
  Tag,
  Wallet,
} from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { formatRentalMoney } from "@/features/contracts/rental-placeholders"
import { parseRentalDetails, type RentalDetails } from "@/features/partner-api/schemas/booking.schema"
import { parseStepSwitches, STEP_SWITCH_KEYS, type StepSwitchKey } from "@/features/transactions/step-switches"
import { cn } from "@/lib/utils"

type PartnerBookingDetailsProps = {
  source: "DASHBOARD" | "PARTNER_API"
  externalRef: string | null
  startAt: Date | null
  endAt: Date | null
  timezone: string
  rentalDetails: unknown
  stepSwitches: unknown
  currency: string
  /** BCP 47 locale used for dates and amounts (the booking locale). */
  intlLocale: string
}

type DateParts = { date: string; time: string }

function formatInZone(value: Date, timezone: string, intlLocale: string): DateParts {
  const format = (zone: string) => ({
    date: new Intl.DateTimeFormat(intlLocale, {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(value),
    time: new Intl.DateTimeFormat(intlLocale, {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(value),
  })

  try {
    return format(timezone)
  } catch {
    return format("UTC")
  }
}

function splitDuration(startAt: Date, endAt: Date) {
  const totalHours = Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 3_600_000))
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 }
}

const stepIcons: Record<StepSwitchKey, React.ComponentType<{ className?: string }>> = {
  identity: ShieldCheck,
  selfie: ShieldCheck,
  documents: ListChecks,
  contract: Tag,
  checkIn: CalendarClock,
  checkOut: CalendarClock,
  payment: Coins,
  cardSecurity: Wallet,
  hold: Wallet,
}

function DetailItem({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 gap-3", className)}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{children}</dd>
      </div>
    </div>
  )
}

function EmptyCardState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * Rental booking block of the vendor transaction detail: start/end date-time
 * (booking timezone), rental details and the read-only step switches. Shown for
 * partner bookings, and for any transaction that carries a rental period.
 */
export async function PartnerBookingDetails({
  source,
  externalRef,
  startAt,
  endAt,
  timezone,
  rentalDetails,
  stepSwitches,
  currency,
  intlLocale,
}: PartnerBookingDetailsProps) {
  const isPartnerBooking = source === "PARTNER_API"

  if (!isPartnerBooking && !startAt && !endAt) {
    return null
  }

  const t = await getTranslations("dashboard.vendor.partnerBooking")
  const rental = parseRentalDetails(rentalDetails)
  const switches = isPartnerBooking ? parseStepSwitches(stepSwitches) : null
  const start = startAt ? formatInZone(startAt, timezone, intlLocale) : null
  const end = endAt ? formatInZone(endAt, timezone, intlLocale) : null
  const duration = startAt && endAt ? splitDuration(startAt, endAt) : null
  const money = (amount: number | null | undefined) => formatRentalMoney(amount, currency, intlLocale.slice(0, 2))

  const durationLabel = duration
    ? [
        duration.days > 0 ? t("durationDays", { count: duration.days }) : null,
        duration.hours > 0 || duration.days === 0 ? t("durationHours", { count: duration.hours }) : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null

  return (
    <section className="space-y-3" aria-labelledby="rental-booking-heading">
      <div className="flex flex-wrap items-center gap-2">
        <CarFront className="size-4 text-muted-foreground" />
        <h2 id="rental-booking-heading" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h2>
        {isPartnerBooking ? (
          <Badge variant="outline" className="border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
            {t("partnerBadge")}
          </Badge>
        ) : null}
        {externalRef ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Hash className="size-3" />
            <span className="sr-only">{t("externalRef")}</span>
            <span className="truncate font-mono">{externalRef}</span>
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Schedule */}
        <Card className="shadow-sm lg:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="size-4 text-muted-foreground" />
              {t("scheduleTitle")}
            </CardTitle>
            <CardDescription>{t("scheduleDescription", { timezone })}</CardDescription>
          </CardHeader>
          <CardContent>
            {start || end ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-3 transition-colors motion-reduce:transition-none hover:border-[var(--contrazy-teal)]/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("start")}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{start?.date ?? t("notProvided")}</p>
                    {start ? <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{start.time}</p> : null}
                  </div>
                  <div className="flex items-center text-muted-foreground" aria-hidden="true">
                    <ArrowRight className="size-4" />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 transition-colors motion-reduce:transition-none hover:border-[var(--contrazy-teal)]/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("end")}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{end?.date ?? t("notProvided")}</p>
                    {end ? <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{end.time}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-mono">{timezone}</Badge>
                  {durationLabel ? <span>{t("duration", { duration: durationLabel })}</span> : null}
                </div>
              </div>
            ) : (
              <EmptyCardState icon={CalendarClock} title={t("noScheduleTitle")} description={t("noScheduleDescription")} />
            )}
          </CardContent>
        </Card>

        {/* Rental details */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CarFront className="size-4 text-muted-foreground" />
              {t("rentalTitle")}
            </CardTitle>
            <CardDescription>{t("rentalDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {rental ? (
              <RentalDetailsBody rental={rental} money={money} intlLocale={intlLocale} />
            ) : (
              <EmptyCardState icon={CarFront} title={t("noRentalTitle")} description={t("noRentalDescription")} />
            )}
          </CardContent>
        </Card>
      </div>

      {isPartnerBooking ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4 text-muted-foreground" />
              {t("stepsTitle")}
            </CardTitle>
            <CardDescription>{t("stepsDescription")}</CardDescription>
            <CardAction>
              <Badge variant="outline">{t("readOnly")}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {switches ? (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {STEP_SWITCH_KEYS.map((key) => {
                  const Icon = stepIcons[key]
                  const enabled = switches[key]
                  const label = t(`steps.${key}`)

                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors motion-reduce:transition-none",
                        enabled ? "border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/5" : "border-border bg-muted/30"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", enabled ? "text-[var(--contrazy-teal)]" : "text-muted-foreground")} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", enabled ? "text-foreground" : "text-muted-foreground")}>{label}</p>
                        <p className="text-xs text-muted-foreground">{enabled ? t("required") : t("notRequired")}</p>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled
                        readOnly
                        size="sm"
                        aria-label={`${label}: ${enabled ? t("required") : t("notRequired")}`}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyCardState icon={ListChecks} title={t("noStepsTitle")} description={t("noStepsDescription")} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

async function RentalDetailsBody({
  rental,
  money,
  intlLocale,
}: {
  rental: RentalDetails
  money: (amount: number | null | undefined) => string
  intlLocale: string
}) {
  const t = await getTranslations("dashboard.vendor.partnerBooking")
  const place = (value: RentalDetails["pickup"]) => (
    <>
      {value.place}
      {value.address ? <span className="block text-xs font-normal text-muted-foreground">{value.address}</span> : null}
    </>
  )
  const quantity = (value: number) => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(value)
  const mileage = rental.mileage.unlimited
    ? t("unlimitedMileage")
    : t("includedKm", { km: new Intl.NumberFormat(intlLocale).format(rental.mileage.includedKm ?? 0) })
  const priceTotal = rental.priceLines.reduce((sum, line) => sum + line.total, 0)

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailItem icon={CarFront} label={t("vehicle")}>
          {rental.vehicle.model}
          {rental.vehicle.category ? (
            <span className="block text-xs font-normal text-muted-foreground">{rental.vehicle.category}</span>
          ) : null}
        </DetailItem>
        <DetailItem icon={Hash} label={t("plate")}>
          {rental.vehicle.plate ? <span className="font-mono">{rental.vehicle.plate}</span> : <span className="text-muted-foreground">{t("notProvided")}</span>}
        </DetailItem>
        <DetailItem icon={MapPin} label={t("pickupPlace")}>
          {place(rental.pickup)}
        </DetailItem>
        <DetailItem icon={MapPin} label={t("returnPlace")}>
          {place(rental.return)}
        </DetailItem>
        <DetailItem icon={Gauge} label={t("mileage")}>
          {mileage}
          {!rental.mileage.unlimited && typeof rental.mileage.extraKmPrice === "number" ? (
            <span className="block text-xs font-normal text-muted-foreground">
              {t("extraKm", { price: money(rental.mileage.extraKmPrice) })}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem icon={ShieldCheck} label={t("protection")}>
          {rental.protection ?? <span className="text-muted-foreground">{t("notProvided")}</span>}
          {typeof rental.deductible === "number" ? (
            <span className="block text-xs font-normal text-muted-foreground">
              {t("deductible", { amount: money(rental.deductible) })}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem icon={Wallet} label={t("deposit")}>
          {typeof rental.deposit === "number" ? money(rental.deposit) : <span className="text-muted-foreground">{t("notProvided")}</span>}
        </DetailItem>
        <DetailItem icon={Fuel} label={t("fuelPolicy")}>
          {rental.fuelPolicy ?? <span className="text-muted-foreground">{t("notProvided")}</span>}
        </DetailItem>
        <DetailItem icon={Puzzle} label={t("options")} className="sm:col-span-2">
          {rental.options.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {rental.options.map((option) => (
                <Badge key={option} variant="secondary">
                  {option}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("noOptions")}</span>
          )}
        </DetailItem>
      </dl>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("priceTable")}</p>
        {rental.priceLines.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">{t("priceLabel")}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">{t("priceQuantity")}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">{t("priceUnit")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">{t("priceTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {rental.priceLines.map((line, index) => (
                  <tr key={`${line.label}-${index}`} className="border-t border-border/70 transition-colors motion-reduce:transition-none hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{line.label}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">
                        {quantity(line.quantity)}
                        {line.unit ? ` ${line.unit}` : ""} × {money(line.unitAmount)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {quantity(line.quantity)}
                      {line.unit ? ` ${line.unit}` : ""}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{money(line.unitAmount)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{money(line.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-foreground sm:hidden">{t("priceGrandTotal")}</th>
                  <th scope="row" colSpan={3} className="hidden px-3 py-2 text-left font-semibold text-foreground sm:table-cell">{t("priceGrandTotal")}</th>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">{money(priceTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">{t("noPriceLines")}</p>
        )}
      </div>
    </div>
  )
}
