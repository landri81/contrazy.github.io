"use client"

import { useState } from "react"
import { LayoutDashboard, Loader2, LogOut, UserCircle2 } from "lucide-react"
import { signOut } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "@/i18n/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

type AccountMenuProps = {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: UserRole | null
  }
  profileHref?: string | null
  workspaceHref?: string | null
  className?: string
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "Account"
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export function AccountMenu({ user, profileHref, workspaceHref, className }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"workspace" | "profile" | "signout" | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const t = useTranslations("site.header")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const displayName = user.name?.trim() || user.email?.split("@")[0] || t("account")
  const displayEmail = user.email?.trim() || t("signedIn")
  const initials = getInitials(user.name, user.email)
  const shouldShowWorkspace = Boolean(workspaceHref && workspaceHref !== profileHref)
  const isRoutePending = Boolean(pendingHref && pendingHref !== pathname)
  const activePendingAction =
    pendingAction === "signout" || isRoutePending ? pendingAction : null
  const isMenuBusy = Boolean(activePendingAction)

  function handleOpenChange(nextOpen: boolean) {
    if (isMenuBusy && !nextOpen) {
      return
    }

    if (nextOpen) {
      setPendingAction(null)
      setPendingHref(null)
    }

    setOpen(nextOpen)
  }

  function handleNavigate(action: "workspace" | "profile", href: string) {
    if (isMenuBusy) {
      return
    }

    setOpen(false)
    setPendingAction(action)
    setPendingHref(href)
    router.push(href)
  }

  function handleSignOut() {
    if (isMenuBusy) {
      return
    }

    setOpen(false)
    setPendingAction("signout")
    setPendingHref(null)
    void signOut({ callbackUrl: `/${locale}/login` })
  }

  return (
    <DropdownMenu open={isMenuBusy ? true : open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label={t("account")}
        className={cn(
          "group flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/6 p-1 transition-all hover:bg-white/10 focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:outline-none",
          className
        )}
      >
        <Avatar size="default" className="size-8 after:border-white/10">
          <AvatarImage src={user.image ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 rounded-2xl border border-border/70 bg-background/95 p-1.5 shadow-[0_24px_70px_-32px_rgba(12,30,47,0.45)] backdrop-blur"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2.5">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-xs font-normal text-muted-foreground">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {shouldShowWorkspace ? (
          <DropdownMenuItem
            onClick={() => handleNavigate("workspace", workspaceHref!)}
            disabled={isMenuBusy}
          >
            {activePendingAction === "workspace" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LayoutDashboard className="size-4" />
            )}
            {t("workspace")}
          </DropdownMenuItem>
        ) : null}
        {profileHref ? (
          <DropdownMenuItem
            onClick={() => handleNavigate("profile", profileHref)}
            disabled={isMenuBusy}
          >
            {activePendingAction === "profile" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCircle2 className="size-4" />
            )}
            {t("profile")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut} disabled={isMenuBusy}>
          {activePendingAction === "signout" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
