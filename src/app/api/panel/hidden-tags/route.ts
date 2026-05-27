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

// GET: list all hidden tags with search and pagination
export async function GET(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const search = searchParams.get('search')?.trim() || ''

    const skip = (page - 1) * limit

    const where: any = { hidden: true }
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [tags, total] = await Promise.all([
      db.userTag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      }),
      db.userTag.count({ where }),
    ])

    return NextResponse.json({
      results: tags,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Panel hidden tags GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PATCH: unhide or hide a tag
export async function PATCH(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { tagId, hidden } = await req.json()

    if (!tagId) {
      return NextResponse.json({ error: 'Не указан ID тега' }, { status: 400 })
    }

    const tag = await db.userTag.findUnique({ where: { id: tagId } })
    if (!tag) {
      return NextResponse.json({ error: 'Тег не найден' }, { status: 404 })
    }

    const updated = await db.userTag.update({
      where: { id: tagId },
      data: { hidden: typeof hidden === 'boolean' ? hidden : !tag.hidden },
    })

    return NextResponse.json({ tag: updated })
  } catch (error) {
    console.error('Panel hidden tags PATCH error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
