import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await request.json()
    const { image } = body

    if (image !== undefined) {
      const trimmed = typeof image === 'string' ? image.trim() : ''
      if (trimmed && !trimmed.match(/^https?:\/\/.+/)) {
        return NextResponse.json({ error: 'Неверная ссылка на изображение' }, { status: 400 })
      }

      await db.user.update({
        where: { id: session.user.userId },
        data: { image: trimmed },
      })
    }

    return NextResponse.json({ message: 'Профиль обновлён' })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const userId = session.user.userId

    // Don't allow admins to delete themselves if they're the only one
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    if (user.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Нельзя удалить единственного админа' }, { status: 400 })
      }
    }

    // Delete user and all related data (Complaint has no userId field)
    await db.$transaction([
      db.comment.deleteMany({ where: { userId } }),
      db.submission.deleteMany({ where: { userId } }),
      db.searchLog.deleteMany({ where: { userId } }),
      db.vote.deleteMany({ where: { voterId: { startsWith: `user:${userId}` } } }),
      db.user.delete({ where: { id: userId } }),
    ])

    return NextResponse.json({ message: 'Аккаунт удалён' })
  } catch (error) {
    console.error('Account delete error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
