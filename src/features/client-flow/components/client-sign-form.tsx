"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PenSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function ClientSignForm({ token }: { token: string }) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!agreed) {
      return
    }

    setIsPending(true)

    try {
      const response = await fetch(`/api/client/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true }),
      })

      if (response.ok) {
        const payload = await response.json()
        router.push(`/t/${token}/${payload.nextStep ?? "payment"}`)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenSquare className="h-5 w-5" />
            Confirm Signature
          </CardTitle>
          <CardDescription>
            Use the built-in confirmation below to accept this agreement electronically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-3 rounded-lg border bg-primary/5 p-4">
            <Checkbox id="signature-confirmation" checked={agreed} onCheckedChange={(value: boolean) => setAgreed(value)} />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="signature-confirmation" className="text-base font-medium">
                I confirm that I accept this agreement
              </Label>
              <p className="text-sm text-muted-foreground">
                This confirmation will be recorded with the transaction as your electronic signature.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending || !agreed}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign and Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
