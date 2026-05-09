"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Link } from "@/i18n/navigation"
import { useRouter } from "@/i18n/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPasswordSchema } from "@/features/auth/schemas/auth.schema"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type ResetTokenState = "valid" | "missing" | "invalid"

export function ResetPasswordForm({
  token,
  tokenState,
}: {
  token: string | undefined
  tokenState: ResetTokenState
}) {
  const t = useTranslations("auth.resetPassword")
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("invalidRequest"))
      return
    }

    try {
      setIsPending(true)
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.message ?? t("unableToReset"))
        return
      }

      setMessage(t("successMessage"))
      setTimeout(() => {
        router.push("/login")
      }, 800)
    } catch (requestError) {
      console.error(requestError)
      setError(t("unableToResetNow"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border bg-card/80 py-6 shadow-sm">
      <CardContent>
        {tokenState !== "valid" ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {tokenState === "missing" ? t("missingToken") : t("invalidToken")}
            </p>
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              {t("requestNewLink")}
            </Link>
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  className="pr-10"
                  maxLength={INPUT_LIMITS.password}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmLabel")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("confirmPlaceholder")}
                  className="pr-10"
                  maxLength={INPUT_LIMITS.password}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error ? (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              ) : message ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>{message}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <Button type="submit" className="h-11 w-full gap-2 font-medium" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                <>
                  <KeyRound className="size-4" />
                  {t("submit")}
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
