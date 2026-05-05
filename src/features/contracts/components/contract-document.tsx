import { cn } from "@/lib/utils"
import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"

export function ContractDocument({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  return (
    <div
      className={cn("contract-document", className)}
      dangerouslySetInnerHTML={{
        __html: normalizeContractTemplateMarkup(html),
      }}
    />
  )
}
