import { createHash, timingSafeEqual } from "node:crypto"

import { PrismaAdapter } from "@auth/prisma-adapter"
import { UserRole } from "@prisma/client"
import { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

import { verifyPassword } from "@/features/auth/server/password"
import { env } from "@/lib/env"
import { prisma } from "@/lib/db/prisma"
import { isSuperAdminEmail, USER_ROLES } from "@/lib/auth/roles"
import { allowAttempt, requestIp } from "@/lib/security/auth-rate-limit"

/** The session id of the super admin signed in with the env credentials (no user row). */
const SUPER_ADMIN_ENV_USER_ID = "super-admin-env-user"

/**
 * The super admin's own session, whose role is not read from a user row: flagged at sign-in, or (sessions opened before
 * 22 Nov 2026) the env sign-in's id, or a super admin role held with the super admin's address.
 */
function isSuperAdminSession(token: { sub?: string; email?: string | null; role?: UserRole; superAdminSignIn?: boolean }) {
  if (token.superAdminSignIn !== undefined) return token.superAdminSignIn
  return token.sub === SUPER_ADMIN_ENV_USER_ID || (token.role === USER_ROLES.SUPER_ADMIN && isSuperAdminEmail(token.email, env.SUPER_ADMIN_EMAIL))
}

/** How often a signed-in user's role is read again, so a demoted or deleted account loses its access quickly. */
const ROLE_RECHECK_MS = 5 * 60_000

/** Compares two secrets in constant time (hashed first, so their lengths do not leak). */
function sameSecret(given: string, expected: string | undefined) {
  if (!expected) return false
  return timingSafeEqual(createHash("sha256").update(given).digest(), createHash("sha256").update(expected).digest())
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "you@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password

        if (!email || !password) {
          return null
        }

        // Too many attempts for this e-mail or from this address: refused like a wrong password (security review).
        if (!allowAttempt("signIn", { email, ip: requestIp(req?.headers) })) {
          return null
        }

        if (isSuperAdminEmail(email, env.SUPER_ADMIN_EMAIL) && sameSecret(password, env.SUPER_ADMIN_PASSWORD)) {
          return {
            id: SUPER_ADMIN_ENV_USER_ID,
            name: "Super Admin",
            email: env.SUPER_ADMIN_EMAIL,
            role: USER_ROLES.SUPER_ADMIN,
          }
        }

        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { vendorProfile: true },
        })

        if (!dbUser?.passwordHash) {
          return null
        }

        const isValid = await verifyPassword(password, dbUser.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Super admin only through its own sign-in (the env credentials) or Google proving the address: an account
      // registered with that e-mail keeps its own role (security review, 22 Nov 2026).
      if (user && (user.id === SUPER_ADMIN_ENV_USER_ID || (account?.provider === "google" && isSuperAdminEmail(user.email, env.SUPER_ADMIN_EMAIL)))) {
        token.role = USER_ROLES.SUPER_ADMIN
        token.superAdminSignIn = true
        token.roleCheckedAt = Date.now()
      } else if (user) {
        token.role = (user as { role?: UserRole }).role ?? USER_ROLES.VENDOR
        token.superAdminSignIn = false
        token.roleCheckedAt = Date.now()
      } else if (!isSuperAdminSession(token) && token.sub && Date.now() - (token.roleCheckedAt ?? 0) > ROLE_RECHECK_MS) {
        // Read again from the user row: a demoted admin loses the role, a deleted account keeps no staff access.
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub }, select: { role: true } })
        token.role = dbUser?.role ?? USER_ROLES.VENDOR
        token.roleCheckedAt = Date.now()
      }

      if (!token.role && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { role: true },
        })
        token.role = dbUser?.role ?? USER_ROLES.VENDOR
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        session.user.role = (token.role as UserRole | undefined) ?? USER_ROLES.VENDOR
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || isSuperAdminEmail(user.email, env.SUPER_ADMIN_EMAIL)) {
        return
      }

      const existingProfile = await prisma.vendorProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      })

      if (!existingProfile && dbUser?.role === UserRole.VENDOR) {
        await prisma.vendorProfile.create({
          data: {
            userId: user.id,
            businessEmail: user.email.toLowerCase(),
          },
        })
      }
    },
  },
}
