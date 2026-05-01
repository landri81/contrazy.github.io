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
  const [agreed, setAgreed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) return
    setIsPending(true)

    try {
      const res = await fetch(`/api/client/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true })
      })

      if (res.ok) {
        router.push(`/t/${token}/payment`)
        router.refresh()
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
              id="terms" 
              checked={agreed} 
              onCheckedChange={(c: boolean) => setAgreed(c)} 
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="terms" className="text-base font-medium">
                I agree to the terms and conditions
              </Label>
              <p className="text-sm text-muted-foreground">
                By checking this box, you are electronically signing this agreement.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending || !agreed}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign and Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
