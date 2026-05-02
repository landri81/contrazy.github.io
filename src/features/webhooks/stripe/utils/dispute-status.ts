type AppDisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "LOST"

/**
 * Maps Stripe's dispute `status` string to our internal DisputeStatus enum value.
 */
export function mapDisputeStatus(stripeStatus: string): AppDisputeStatus {
  switch (stripeStatus) {
    case "needs_response":
    case "warning_needs_response":
    case "under_review":
    case "warning_under_review":
      return "UNDER_REVIEW"
    case "won":
    case "warning_closed":
      return "RESOLVED"
    case "lost":
      return "LOST"
    default:
      return "OPEN"
  }
}
