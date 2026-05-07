"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GoogleIcon } from "@/components/ui/google-icon"
import { Link, useRouter } from "@/i18n/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerSchema } from "@/features/auth/schemas/auth.schema"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

export function RegisterForm() {
  const t = useTranslations("auth.register")
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)

  async function handleRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsedPayload = registerSchema.safeParse({ name, businessName, email, password, confirmPassword })

    if (!parsedPayload.success) {
      setError(parsedPayload.error.issues[0]?.message ?? t("errors.invalidFormData"))
      return
    }

    try {
      setIsPending(true)
      const registrationResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedPayload.data),
      })

      const registrationPayload = await registrationResponse.json()

      if (!registrationResponse.ok) {
        setError(registrationPayload.message ?? t("errors.generic"))
        return
      }

      const signInResult = await signIn("credentials", {
        email: parsedPayload.data.email,
        password: parsedPayload.data.password,
        redirect: false,
      })

      if (signInResult?.error) {
        router.push("/login")
        return
      }

      router.push("/vendor/profile")
      router.refresh()
    } catch (registrationError) {
      console.error(registrationError)
      setError(t("errors.generic"))
    } finally {
      setIsPending(false)
    }
  }

  function handleGoogleSignIn() {
    setIsGooglePending(true)
    signIn("google", { callbackUrl: `/${locale}/auth-complete` })
  }

  return (
    <Card className="border-border/70 bg-card/70 py-6 shadow-none">
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-3 border-border/70 bg-background/80 font-medium shadow-sm hover:bg-background"
          onClick={handleGoogleSignIn}
          disabled={isGooglePending || isPending}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
            {isGooglePending ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon className="size-4" />}
          </span>
          {t("google")}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={handleRegistration}>
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              maxLength={INPUT_LIMITS.personName}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">{t("businessNameLabel")}</Label>
            <Input
              id="businessName"
              type="text"
              placeholder={t("businessNamePlaceholder")}
              maxLength={INPUT_LIMITS.businessName}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              maxLength={INPUT_LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("passwordHelp")}
                className="pr-10"
                maxLength={INPUT_LIMITS.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("confirmPasswordPlaceholder")}
                className="pr-10"
                maxLength={INPUT_LIMITS.password}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <Button
            type="submit"
            className="h-11 w-full gap-2 bg-[var(--contrazy-navy)] font-medium text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={isPending || isGooglePending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                {t("submit")}
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
