"use client"

import { LayoutDashboard, LogOut, UserCircle2 } from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  const router = useRouter()
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "Account"
  const displayEmail = user.email?.trim() || "Signed in"
  const initials = getInitials(user.name, user.email)
  const shouldShowWorkspace = Boolean(workspaceHref && workspaceHref !== profileHref)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
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
          <DropdownMenuItem onClick={() => router.push(workspaceHref!)}>
            <LayoutDashboard className="size-4" />
            Workspace
          </DropdownMenuItem>
        ) : null}
        {profileHref ? (
          <DropdownMenuItem onClick={() => router.push(profileHref)}>
            <UserCircle2 className="size-4" />
            Profile
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
