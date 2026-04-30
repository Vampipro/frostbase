import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const adminPass = process.env.ADMIN_PASSWORD
    if (!adminPass) {
      console.error('ADMIN_PASSWORD is not set in environment')
      return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 })
    }

    // Rate limit admin password attempts by session user ID
    const sessionUser = session.user as { userId?: string; id?: string }
    const userId = sessionUser.userId || sessionUser.id
    const { allowed } = rateLimit(`admin-pass:${userId || 'unknown'}`)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток. Подождите минуту.' },
        { status: 429 }
      )
    }

    const { password } = await req.json()

    const inputPass = String(password || '').trim()

    if (!inputPass || inputPass !== adminPass.trim()) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 403 })
    }

    // Get user ID from session - try both userId and id
    const finalUserId = userId

    if (!finalUserId) {
      return NextResponse.json({ error: 'Ошибка сессии' }, { status: 400 })
    }

    // Update role in DB
    const updatedUser = await db.user.update({
      where: { id: finalUserId },
      data: { role: 'admin' },
      select: { id: true, username: true, role: true },
    })

    return NextResponse.json({
      message: 'Доступ получен',
      role: updatedUser.role,
    })
  } catch (error) {
    console.error('Panel register error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
