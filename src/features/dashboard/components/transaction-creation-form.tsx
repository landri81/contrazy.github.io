"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ContractTemplate, ChecklistTemplate } from "@prisma/client"
import { Loader2, Link as LinkIcon, AlertCircle, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function TransactionCreationForm({ 
  contracts, 
  checklists,
  hasStripe,
  canLaunch,
  blockedMessage,
}: { 
  contracts: ContractTemplate[]
  checklists: ChecklistTemplate[]
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successLink, setSuccessLink] = useState<string | null>(null)

  // Form State
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [contractId, setContractId] = useState<string>("none")
  const [checklistId, setChecklistId] = useState<string>("none")
  const [amount, setAmount] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [requiresKyc, setRequiresKyc] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    if (!canLaunch) {
      setError(blockedMessage)
      setIsPending(false)
      return
    }

    if (!hasStripe && (amount || depositAmount || requiresKyc)) {
      setError("You must connect Stripe before requiring payments, deposits, or identity verification.")
      setIsPending(false)
      return
    }

    try {
      const res = await fetch("/api/vendor/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          contractTemplateId: contractId === "none" ? null : contractId,
          checklistTemplateId: checklistId === "none" ? null : checklistId,
          amount: amount ? Math.round(parseFloat(amount) * 100) : null,
          depositAmount: depositAmount ? Math.round(parseFloat(depositAmount) * 100) : null,
          requiresKyc
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Failed to create transaction")
        return
      }

      setSuccessLink(`${window.location.origin}/t/${data.link.token}`)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsPending(false)
    }
  }

  if (successLink) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="text-green-800 dark:text-green-400">Transaction Created!</CardTitle>
          <CardDescription className="text-green-700 dark:text-green-500">
            Send this secure link or QR code to your client to begin the flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input readOnly value={successLink} className="bg-white dark:bg-background" />
            <Button onClick={() => navigator.clipboard.writeText(successLink)}>
              Copy Link
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-background rounded-lg border">
            <QRCodeSVG value={successLink} size={150} level="M" includeMargin />
            <p className="text-sm text-muted-foreground mt-4 flex items-center">
              <QrCode className="mr-2 h-4 w-4" /> Scan with mobile device
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => {
            setSuccessLink(null)
            setTitle("")
            router.refresh()
          }}>
            Create Another
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>
            Configure what the client needs to complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!hasStripe && (
            <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle>Stripe Not Connected</AlertTitle>
              <AlertDescription>
                Financial and identity features are disabled. <a href="/vendor/stripe" className="underline font-medium">Connect Stripe</a> to enable them.
              </AlertDescription>
            </Alert>
          )}

          {!canLaunch && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              <AlertTitle>Account review in progress</AlertTitle>
              <AlertDescription>{blockedMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Transaction Title <span className="text-destructive">*</span></Label>
              <Input 
                id="title" 
                placeholder="e.g. Booking #1042 - BMW X5" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contract">Contract Template</Label>
                <Select value={contractId} onValueChange={(v) => v && setContractId(v)}>
                  <SelectTrigger id="contract">
                    <SelectValue placeholder="Select contract..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contract needed</SelectItem>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checklist">Required Uploads</Label>
                <Select value={checklistId} onValueChange={(v) => v && setChecklistId(v)}>
                  <SelectTrigger id="checklist">
                    <SelectValue placeholder="Select checklist..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No uploads needed</SelectItem>
                    {checklists.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Service Payment (EUR)</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  disabled={!hasStripe || !canLaunch}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="depositAmount">Deposit Hold (EUR)</Label>
                <Input 
                  id="depositAmount" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={depositAmount} 
                  onChange={e => setDepositAmount(e.target.value)}
                  disabled={!hasStripe || !canLaunch}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Require Identity Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Use Stripe Identity to verify government ID.
                </p>
              </div>
              <Switch 
                checked={requiresKyc} 
                onCheckedChange={setRequiresKyc} 
                disabled={!hasStripe || !canLaunch}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Private notes only visible to you..." 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending || !title || !canLaunch}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Generate Secure Link
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
