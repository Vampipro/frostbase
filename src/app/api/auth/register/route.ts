import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string()
    .min(8, 'Пароль должен быть минимум 8 символов')
    .max(100, 'Пароль слишком длинный')
    .regex(/[a-zA-Z]/, 'Пароль должен содержать хотя бы одну букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit registration by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`register:${ip}`)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток регистрации. Подождите минуту.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { username, password } = registerSchema.parse(body)

    const existing = await db.user.findUnique({
      where: { username },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Пользователь с таким именем уже существует' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'user',
      },
    })

    return NextResponse.json(
      { message: 'Регистрация успешна', userId: user.id },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(e => e.message)
      const firstMessage = messages[0] || 'Неверные данные'
      return NextResponse.json(
        { error: firstMessage, details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
