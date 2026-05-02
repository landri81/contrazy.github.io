"use client"

import { Send } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactFormCard() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
      {submitted ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Message received</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Thanks for reaching out. A member of the Conntrazy team will review your message and follow up.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">First Name</Label>
              <Input id="first-name" placeholder="Enter your first name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last Name</Label>
              <Input id="last-name" placeholder="Enter your last name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              className="min-h-32"
              placeholder="Describe your workflow, industry, or launch timeline."
            />
          </div>
          <Button type="submit" className="h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]">
            <Send className="size-4" />
            Send message
          </Button>
        </form>
      )}
    </div>
  )
}
