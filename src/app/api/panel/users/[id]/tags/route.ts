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

// GET: get all tags for a user (admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Не указан ID пользователя' }, { status: 400 })
    }

    const tags = await db.userTag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Panel user tags GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// POST: create a tag for a user (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id: userId } = await params
    const body = await req.json()
    const { text, color, textColor, sparkly } = body

    if (!userId) {
      return NextResponse.json({ error: 'Не указан ID пользователя' }, { status: 400 })
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Текст тега обязателен' }, { status: 400 })
    }

    if (text.trim().length > 30) {
      return NextResponse.json({ error: 'Тег слишком длинный (макс. 30 символов)' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Check max tags per user
    const existingCount = await db.userTag.count({ where: { userId } })
    if (existingCount >= 10) {
      return NextResponse.json({ error: 'Максимум 10 тегов на пользователя' }, { status: 400 })
    }

    const tag = await db.userTag.create({
      data: {
        userId,
        text: text.trim().slice(0, 30),
        color: typeof color === 'string' ? color.slice(0, 7) : '#3b82f6',
        textColor: typeof textColor === 'string' ? textColor.slice(0, 7) : '#ffffff',
        sparkly: typeof sparkly === 'boolean' ? sparkly : false,
      },
    })

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Panel user tags POST error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: delete a tag (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id: userId } = await params
    const { searchParams } = new URL(req.url)
    const tagId = searchParams.get('tagId')

    if (!userId) {
      return NextResponse.json({ error: 'Не указан ID пользователя' }, { status: 400 })
    }

    if (!tagId) {
      return NextResponse.json({ error: 'Не указан ID тега' }, { status: 400 })
    }

    const tag = await db.userTag.findFirst({
      where: { id: tagId, userId },
    })

    if (!tag) {
      return NextResponse.json({ error: 'Тег не найден' }, { status: 404 })
    }

    await db.userTag.delete({ where: { id: tagId } })

    return NextResponse.json({ message: 'Тег удалён' })
  } catch (error) {
    console.error('Panel user tags DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
