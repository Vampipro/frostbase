import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const RATE_LIMIT_MS = 2 * 60 * 1000 // 2 minutes

// GET: everyone can read APPROVED comments only (guests included)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scammerId = searchParams.get('scammerId')

    if (!scammerId) {
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const skip = (page - 1) * limit

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where: { scammerId, approved: true, hidden: false },
        include: {
          user: {
            select: { id: true, username: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.comment.count({ where: { scammerId, approved: true, hidden: false } }),
    ])

    const results = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      user: c.user,
    }))

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Comments GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки комментариев' }, { status: 500 })
  }
}

// POST: auth required, rate limited, comment goes to moderation (approved: false)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const sessionUser = session.user as { userId?: string; id?: string; role?: string; banned?: boolean }
    const userId = sessionUser.userId || sessionUser.id

    if (!userId) {
      return NextResponse.json({ error: 'Ошибка сессии' }, { status: 401 })
    }

    // Check if user is banned
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    if (user.role === 'banned') {
      return NextResponse.json({ error: 'Вы заблокированы и не можете писать комментарии' }, { status: 403 })
    }

    // Rate limit: check last comment by this user
    const lastComment = await db.comment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    if (lastComment) {
      const elapsed = Date.now() - lastComment.createdAt.getTime()
      if (elapsed < RATE_LIMIT_MS) {
        const remainingSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000)
        return NextResponse.json(
          { error: `Слишком часто. Подождите ${remainingSec} сек.` },
          { status: 429 }
        )
      }
    }

    const { scammerId, content } = await req.json()

    if (!scammerId || typeof scammerId !== 'string') {
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim().length < 1) {
      return NextResponse.json({ error: 'Комментарий не может быть пустым' }, { status: 400 })
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: 'Комментарий слишком длинный (макс. 500 символов)' }, { status: 400 })
    }

    const scammer = await db.scammer.findUnique({ where: { id: scammerId } })
    if (!scammer) {
      return NextResponse.json({ error: 'Скамер не найден' }, { status: 404 })
    }

    // Create comment as pending (approved: false)
    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        scammerId,
        userId,
        approved: false,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    // Return success but tell user it's sent (will show after moderation)
    return NextResponse.json(
      { id: comment.id, content: comment.content, createdAt: comment.createdAt, user: comment.user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Comments POST error:', error)
    return NextResponse.json({ error: 'Ошибка добавления комментария' }, { status: 500 })
  }
}

// DELETE: auth required (owner or admin)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const sessionUser = session.user as { userId?: string; id?: string; role?: string }
    const userId = sessionUser.userId || sessionUser.id

    const { searchParams } = new URL(req.url)
    const commentId = searchParams.get('id')

    if (!commentId) {
      return NextResponse.json({ error: 'Укажите id комментария' }, { status: 400 })
    }

    const comment = await db.comment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 })
    }

    if (comment.userId !== userId && sessionUser.role !== 'admin') {
      return NextResponse.json({ error: 'Нет прав для удаления' }, { status: 403 })
    }

    await db.comment.delete({ where: { id: commentId } })
    return NextResponse.json({ message: 'Комментарий удалён' })
  } catch (error) {
    console.error('Comments DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления комментария' }, { status: 500 })
  }
}
