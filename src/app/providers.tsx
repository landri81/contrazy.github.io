"use client"

import { SessionProvider } from "next-auth/react"

import { ReduxProvider } from "@/store/provider"

type AppProvidersProps = {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <ReduxProvider>{children}</ReduxProvider>
    </SessionProvider>
  )
}
