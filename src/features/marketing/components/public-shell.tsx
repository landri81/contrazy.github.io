import type { UserRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { PublicShellClient } from "@/features/marketing/components/public-shell-client"

type PublicShellProps = {
  children: React.ReactNode
}

export type PublicHeaderSession =
  | {
      user: {
        name: string | null
        email: string | null
        image: string | null
        role: UserRole | null
      }
    }
  | null

export async function PublicShell({ children }: PublicShellProps) {
  const session = await getAuthSession()

  const headerSession: PublicHeaderSession = session?.user
    ? {
        user: {
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
          role: session.user.role ?? null,
        },
      }
    : null

  return <PublicShellClient session={headerSession}>{children}</PublicShellClient>
}
