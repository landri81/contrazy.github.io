"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="border border-white/12 bg-white/6 px-3 text-white hover:bg-white/10 hover:text-white"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="size-3.5" />
      <span>Sign Out</span>
    </Button>
  )
}
