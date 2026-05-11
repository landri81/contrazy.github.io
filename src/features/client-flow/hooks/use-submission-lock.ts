"use client"

import { useCallback, useRef, useState } from "react"

export function useSubmissionLock() {
  const [isLocked, setIsLocked] = useState(false)
  const persistRef = useRef(false)

  const start = useCallback(() => {
    persistRef.current = false
    setIsLocked(true)
  }, [])

  const keepLocked = useCallback(() => {
    persistRef.current = true
    setIsLocked(true)
  }, [])

  const release = useCallback(() => {
    persistRef.current = false
    setIsLocked(false)
  }, [])

  const finish = useCallback(() => {
    if (!persistRef.current) {
      setIsLocked(false)
    }
  }, [])

  return {
    isLocked,
    start,
    keepLocked,
    release,
    finish,
  }
}
