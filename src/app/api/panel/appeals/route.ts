import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { userId?: string; id?: string; role?: string } | undefined
  if (!user || user.role !== 'admin') {
    return null
  }
  return user
}

// GET: list appeals with pagination
export async function GET(req: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15')))
    const status = searchParams.get('status') || 'all'
    const skip = (page - 1) * limit

    const where: any = {}
    if (status !== 'all') {
      where.status = status
    }

    const [appeals, total] = await Promise.all([
      db.appeal.findMany({
        where,
        include: {
          scammer: { select: { id: true, name: true, status: true } },
          user: { select: { id: true, username: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.appeal.count({ where }),
    ])

    return NextResponse.json({
      results: appeals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Appeals GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// PUT: handle appeal action (accept / reject / ban submitter)
export async function PUT(req: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { appealId, action } = await req.json()

    if (!appealId || !action) {
      return NextResponse.json({ error: 'Укажите appealId и action' }, { status: 400 })
    }

    const appeal = await db.appeal.findUnique({
      where: { id: appealId },
      include: { scammer: true, user: true },
    })

    if (!appeal) {
      return NextResponse.json({ error: 'Апелляция не найдена' }, { status: 404 })
    }

    if (appeal.status !== 'pending') {
      return NextResponse.json({ error: 'Апелляция уже обработана' }, { status: 400 })
    }

    if (action === 'accept') {
      // Accept: delete scammer from DB entirely
      await db.appeal.update({
        where: { id: appealId },
        data: { status: 'accepted' },
      })

      // Delete scammer (cascade will handle related records)
      await db.scammer.delete({ where: { id: appeal.scammerId } })

      return NextResponse.json({ message: `Скамер "${appeal.scammer.name}" удалён из базы` })
    }

    if (action === 'reject') {
      // Reject: just mark appeal as rejected
      await db.appeal.update({
        where: { id: appealId },
        data: { status: 'rejected' },
      })

      return NextResponse.json({ message: 'Апелляция отклонена' })
    }

    if (action === 'ban') {
      // Ban the person who submitted the appeal
      if (!appeal.userId) {
        return NextResponse.json({ error: 'Анонимный пользователь — нельзя забанить' }, { status: 400 })
      }

      await db.appeal.update({
        where: { id: appealId },
        data: { status: 'banned' },
      })

      await db.user.update({
        where: { id: appeal.userId },
        data: { role: 'banned', banReason: 'Подача ложной апелляции' },
      })

      return NextResponse.json({ message: `Пользователь ${appeal.user?.username || 'неизвестен'} забанен, апелляция отклонена` })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (error) {
    console.error('Appeal action error:', error)
    return NextResponse.json({ error: 'Ошибка обработки' }, { status: 500 })
  }
}
