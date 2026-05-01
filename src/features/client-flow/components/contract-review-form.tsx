"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function ContractReviewForm({ token, content }: { token: string, content: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewed) return
    setIsPending(true)

    try {
      const res = await fetch(`/api/client/${token}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: true })
      })

      if (res.ok) {
        const payload = await res.json()
        router.push(`/t/${token}/${payload.nextStep ?? "sign"}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-muted/30 border rounded-lg p-6 h-[400px] overflow-y-auto whitespace-pre-wrap font-mono text-sm">
            {content}
          </div>

          <div className="flex items-start space-x-3 p-4 border rounded-lg bg-primary/5">
            <Checkbox 
              id="reviewed" 
              checked={reviewed} 
              onCheckedChange={(c: boolean) => setReviewed(c)} 
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="reviewed" className="text-base font-medium">
                I have reviewed this agreement
              </Label>
              <p className="text-sm text-muted-foreground">
                Continue to the next step when you are ready to sign.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending || !reviewed}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Signature
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
