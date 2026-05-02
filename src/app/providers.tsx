"use client"

import { ReduxProvider } from "@/store/provider"

type AppProvidersProps = {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return <ReduxProvider>{children}</ReduxProvider>
}
