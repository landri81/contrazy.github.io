"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ClientProcessingCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const router = useRouter()

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [router])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => router.refresh()}>
          Refresh status
        </Button>
      </CardContent>
    </Card>
  )
}
