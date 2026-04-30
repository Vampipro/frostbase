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

// GET: list all complaints (admin only)
export async function GET() {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const complaints = await db.complaint.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const results = complaints.map((c) => ({
      id: c.id,
      name: c.name,
      reason: c.reason,
      status: c.status,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Panel complaints GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PUT: update complaint status (admin only) — resolve or dismiss
export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Не указаны данные' }, { status: 400 })
    }

    const validStatuses = ['resolved', 'dismissed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })
    }

    await db.complaint.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ message: 'Статус обновлен' })
  } catch (error) {
    console.error('Panel complaints PUT error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: delete a complaint (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Укажите id жалобы' }, { status: 400 })
    }

    await db.complaint.delete({ where: { id } })
    return NextResponse.json({ message: 'Жалоба удалена' })
  } catch (error) {
    console.error('Panel complaints DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
