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

          if (user.isPlaceholder) {
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
        token.lastRefresh = Math.floor(Date.now() / 1000)
      }
      // On explicit session update (e.g. after avatar change), re-read from DB
      if (trigger === 'update' && token.userId) {
        try {
          const freshUser = await db.user.findUnique({
            where: { id: token.userId as string },
            select: { role: true, image: true },
          })
          if (freshUser) {
            token.role = freshUser.role
            token.image = freshUser.image
            token.lastRefresh = Math.floor(Date.now() / 1000)
          } else {
            // Юзер удалён — инвалидируем токен
            token.role = 'banned'
          }
        } catch (error) {
          console.error('JWT update error:', error)
        }
      }
      // Периодическое перечитывание role из БД (каждые 60 сек).
      // Это закрывает баг: забаненный админ сохранял доступ до 30 дней,
      // потому что role бралась из JWT, а не из БД. Теперь при следующем
      // запросе после бана role обновится в токене, middleware увидит 'banned'.
      const nowSec = Math.floor(Date.now() / 1000)
      const last = (token.lastRefresh as number) || 0
      if (token.userId && nowSec - last > 60) {
        try {
          const freshUser = await db.user.findUnique({
            where: { id: token.userId as string },
            select: { role: true, image: true },
          })
          if (freshUser) {
            token.role = freshUser.role
            token.image = freshUser.image
          } else {
            // Юзер удалён — помечаем как забаненного, чтобы middleware отрезал доступ
            token.role = 'banned'
          }
          token.lastRefresh = nowSec
        } catch (error) {
          console.error('JWT periodic refresh error:', error)
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
    lastRefresh?: number
  }
}
