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

// GET: list users with search and pagination (admin only)
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
    const roleFilter = searchParams.get('role')?.trim() || ''

    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.username = { contains: search, mode: 'insensitive' }
    }
    if (roleFilter && roleFilter !== 'all') {
      where.role = roleFilter
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          role: true,
          banReason: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              submissions: true,
              comments: true,
              searchLogs: true,
            },
          },
        },
      }),
      db.user.count({ where }),
    ])

    const results = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      banReason: u.banReason,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      submissionsCount: u._count.submissions,
      commentsCount: u._count.comments,
      searchesCount: u._count.searchLogs,
    }))

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Panel users GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PUT: ban/unban user (admin only)
export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, action, reason } = await req.json()

    if (!id || !action) {
      return NextResponse.json({ error: 'Не указаны данные' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Prevent banning admins
    if (targetUser.role === 'admin' && action === 'ban') {
      return NextResponse.json({ error: 'Нельзя забанить админа' }, { status: 400 })
    }

    const adminUserId = (user as { userId?: string; id?: string }).userId || (user as { id?: string }).id || ''

    if (action === 'ban') {
      await db.user.update({
        where: { id },
        data: {
          role: 'banned',
          banReason: typeof reason === 'string' ? reason.trim().slice(0, 200) : '',
        },
      })
      return NextResponse.json({ message: 'Пользователь заблокирован' })
    }

    if (action === 'unban') {
      await db.user.update({
        where: { id },
        data: {
          role: 'user',
          banReason: '',
        },
      })
      return NextResponse.json({ message: 'Пользователь разблокирован' })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (error) {
    console.error('Panel users PUT error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: delete user and all related data (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const targetId = searchParams.get('id')

    if (!targetId) {
      return NextResponse.json({ error: 'Не указан ID пользователя' }, { status: 400 })
    }

    const adminUserId = (user as { userId?: string; id?: string }).userId || (user as { id?: string }).id || ''

    // Prevent admin from deleting themselves
    if (targetId === adminUserId) {
      return NextResponse.json({ error: 'Нельзя удалить свой аккаунт через админку. Используйте профиль.' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({ where: { id: targetId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Prevent deleting admins
    if (targetUser.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Нельзя удалить единственного админа' }, { status: 400 })
      }
    }

    // Delete user and all related data in a transaction
    await db.$transaction([
      db.comment.deleteMany({ where: { userId: targetId } }),
      db.submission.deleteMany({ where: { userId: targetId } }),
      db.searchLog.deleteMany({ where: { userId: targetId } }),
      db.vote.deleteMany({ where: { voterId: { startsWith: 'user:' + targetId } } }),
      db.user.delete({ where: { id: targetId } }),
    ])

    return NextResponse.json({ message: 'Пользователь удалён' })
  } catch (error) {
    console.error('Panel users DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
