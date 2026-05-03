export type DashboardTone = "success" | "warning" | "danger" | "neutral" | "info"

export function getStatusTone(status: string): DashboardTone {
  const normalized = status.toLowerCase()

  if (normalized.includes("not_connected") || normalized.includes("not connected")) {
    return "warning"
  }

  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("open") ||
    normalized.includes("suspend") ||
    normalized.includes("cancel")
  ) {
    return "danger"
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("wait") ||
    normalized.includes("process") ||
    normalized.includes("review")
  ) {
    return "warning"
  }

  if (
    normalized.includes("connect") ||
    normalized.includes("verify") ||
    normalized.includes("success") ||
    normalized.includes("approve") ||
    normalized.includes("signed") ||
    normalized.includes("complete") ||
    normalized.includes("active") ||
    normalized.includes("processed") ||
    normalized.includes("captured") ||
    normalized.includes("released")
  ) {
    return "success"
  }

  return "neutral"
}
