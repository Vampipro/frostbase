import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

// GET: list pending + recent comments (admin only)
export async function GET() {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const comments = await db.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, username: true, role: true, image: true },
        },
        scammer: {
          select: { id: true, name: true },
        },
      },
    })

    const results = comments.map((c) => ({
      id: c.id,
      content: c.content,
      approved: c.approved,
      hidden: c.hidden,
      createdAt: c.createdAt,
      user: c.user,
      scammer: c.scammer,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Panel comments GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PUT: approve/hide/unhide comment or ban user (admin only)
export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, action } = await req.json()

    if (!id || !action) {
      return NextResponse.json({ error: 'Не указаны данные' }, { status: 400 })
    }

    if (action === 'approve') {
      await db.comment.update({
        where: { id },
        data: { approved: true },
      })
      return NextResponse.json({ message: 'Комментарий опубликован' })
    }

    if (action === 'hide') {
      await db.comment.update({
        where: { id },
        data: { hidden: true },
      })
      return NextResponse.json({ message: 'Комментарий скрыт' })
    }

    if (action === 'unhide') {
      await db.comment.update({
        where: { id },
        data: { hidden: false },
      })
      return NextResponse.json({ message: 'Комментарий возвращён' })
    }

    if (action === 'ban') {
      const comment = await db.comment.findUnique({
        where: { id },
        select: { userId: true },
      })
      if (!comment) {
        return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 })
      }
      await db.user.update({
        where: { id: comment.userId },
        data: { role: 'banned' },
      })
      await db.comment.updateMany({
        where: { userId: comment.userId, approved: false },
        data: { hidden: true },
      })
      return NextResponse.json({ message: 'Пользователь заблокирован' })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (error) {
    console.error('Panel comments PUT error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: delete a comment (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    const comment = await db.comment.findUnique({ where: { id } })
    if (!comment) {
      return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 })
    }

    await db.comment.delete({ where: { id } })
    return NextResponse.json({ message: 'Комментарий удалён' })
  } catch (error) {
    console.error('Panel comments DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
