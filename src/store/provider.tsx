"use client"

import { useState } from "react"
import { Provider } from "react-redux"

import { makeStore, type AppStore } from "@/store"

type ReduxProviderProps = {
  children: React.ReactNode
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  const [store] = useState<AppStore>(makeStore)
  return <Provider store={store}>{children}</Provider>
}
