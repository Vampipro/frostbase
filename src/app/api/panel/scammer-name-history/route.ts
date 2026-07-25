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

// GET: list name history for a scammer (paginated)
export async function GET(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const scammerId = searchParams.get('scammerId')
    if (!scammerId) {
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15')))
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      db.scammerNameHistory.findMany({
        where: { scammerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.scammerNameHistory.count({ where: { scammerId } }),
    ])

    return NextResponse.json({
      results: history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Name history GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: delete history entry
export async function DELETE(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const historyId = searchParams.get('id')

    if (!historyId) {
      return NextResponse.json({ error: 'Укажите id' }, { status: 400 })
    }

    const entry = await db.scammerNameHistory.findUnique({
      where: { id: historyId },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    await db.scammerNameHistory.delete({
      where: { id: historyId },
    })

    return NextResponse.json({ message: 'Запись удалена' })
  } catch (error) {
    console.error('Name history DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PATCH: edit history entry
export async function PATCH(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const historyId = searchParams.get('id')
    const { oldName, newName } = await req.json()

    if (!historyId) {
      return NextResponse.json({ error: 'Укажите id' }, { status: 400 })
    }

    if (!oldName || !newName) {
      return NextResponse.json({ error: 'Оба поля обязательны' }, { status: 400 })
    }

    const entry = await db.scammerNameHistory.findUnique({
      where: { id: historyId },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    await db.scammerNameHistory.update({
      where: { id: historyId },
      data: {
        oldName: oldName.trim(),
        newName: newName.trim(),
      },
    })

    return NextResponse.json({ message: 'Запись обновлена' })
  } catch (error) {
    console.error('Name history PATCH error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// POST: rollback to a previous name
export async function POST(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { historyId } = await req.json()
    if (!historyId) {
      return NextResponse.json({ error: 'Укажите historyId' }, { status: 400 })
    }

    const entry = await db.scammerNameHistory.findUnique({
      where: { id: historyId },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    const currentScammer = await db.scammer.findUnique({
      where: { id: entry.scammerId },
      select: { name: true },
    })

    if (!currentScammer) {
      return NextResponse.json({ error: 'Скамер не найден' }, { status: 404 })
    }

    // Only rollback if the current name differs from the target old name
    if (currentScammer.name === entry.oldName) {
      return NextResponse.json({ message: 'Текущее имя уже совпадает' })
    }

    // Save current name → old name as a new history entry
    await db.scammerNameHistory.create({
      data: {
        scammerId: entry.scammerId,
        oldName: currentScammer.name,
        newName: entry.oldName,
      },
    })

    // Update the scammer name to the old name
    await db.scammer.update({
      where: { id: entry.scammerId },
      data: { name: entry.oldName },
    })

    return NextResponse.json({ message: `Имя откачено на «${entry.oldName}»` })
  } catch (error) {
    console.error('Name history POST error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
