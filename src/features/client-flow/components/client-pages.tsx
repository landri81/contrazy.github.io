"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ClientProfileForm({ token, initialData }: { token: string, initialData?: { fullName?: string, email?: string, phone?: string | null, companyName?: string | null } | null }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  
  const [fullName, setFullName] = useState(initialData?.fullName || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [phone, setPhone] = useState(initialData?.phone || "")
  const [companyName, setCompanyName] = useState(initialData?.companyName || "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)

    try {
      const res = await fetch(`/api/client/${token}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, companyName })
      })

      if (res.ok) {
        router.push(`/t/${token}/documents`)
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
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
            <Input id="fullName" required value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company (Optional)</Label>
            <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending || !fullName || !email}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
