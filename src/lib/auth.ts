import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { rateLimit } from './rate-limit'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // Rate limit by IP (passed via credential field or fallback to username)
        const { allowed } = rateLimit(`login:${credentials.username}`)
        if (!allowed) {
          throw new Error('Слишком много попыток. Подождите минуту.')
        }

        try {
          const user = await db.user.findUnique({
            where: { username: credentials.username },
          })

          if (!user) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            name: user.username,
            email: `${user.username}@scambase.local`,
            role: user.role,
            image: user.image || undefined,
          }
        } catch (error) {
          console.error('Auth authorize error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On fresh login, populate token from DB user
      if (user) {
        token.role = user.role
        token.userId = user.id
        token.image = user.image
      }
      // On session update (e.g. after admin role change), re-read role from DB
      if (trigger === 'update' && token.userId) {
        try {
          const freshUser = await db.user.findUnique({
            where: { id: token.userId as string },
            select: { role: true, image: true },
          })
          if (freshUser) {
            token.role = freshUser.role
            token.image = freshUser.image
          }
        } catch (error) {
          console.error('JWT update error:', error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.role = token.role as string
        session.user.userId = token.userId as string
        session.user.image = token.image as string
        // Ensure id is set from JWT sub
        session.user.id = token.sub as string
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      userId: string
      image?: string
    }
  }
  interface User {
    role: string
    image?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    userId: string
    image?: string
  }
}
