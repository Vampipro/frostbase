import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/status-types — public, returns all statuses sorted by sortOrder
export async function GET() {
  try {
    const statuses = await db.$queryRawUnsafe(
      `SELECT id, key, label, color, "textColor", "sortOrder", "isDefault"
       FROM "ScammerStatus"
       ORDER BY "sortOrder" ASC`
    ) as any[]

    return NextResponse.json({ statuses })
  } catch (error) {
    console.error('Status types GET error:', error)
    // Fallback to hardcoded defaults if table doesn't exist yet
    const fallback = [
      { key: 'scam', label: 'СКАМ', color: '#ef4444', textColor: '#ffffff', sortOrder: 0, isDefault: true },
      { key: 'verified', label: 'Проверен', color: '#22c55e', textColor: '#ffffff', sortOrder: 1, isDefault: false },
      { key: 'suspicious', label: 'Подозрительный', color: '#f59e0b', textColor: '#ffffff', sortOrder: 2, isDefault: false },
      { key: 'not_in_db', label: 'Нет в базе', color: '#6b7280', textColor: '#ffffff', sortOrder: 3, isDefault: false },
      { key: 'unverified', label: 'Не проверен', color: '#3b82f6', textColor: '#ffffff', sortOrder: 4, isDefault: false },
    ]
    return NextResponse.json({ statuses: fallback })
  }
}

// POST /api/status-types — admin only, create new status type
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { key, label, color, textColor } = await req.json()

    if (!key || typeof key !== 'string' || key.trim().length < 1 || key.trim().length > 50) {
      return NextResponse.json({ error: 'Ключ обязателен (1-50 символов, латиница)' }, { status: 400 })
    }
    if (!label || typeof label !== 'string' || label.trim().length < 1 || label.trim().length > 100) {
      return NextResponse.json({ error: 'Название обязательно (1-100 символов)' }, { status: 400 })
    }

    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const cleanColor = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#6b7280'
    const cleanTextColor = typeof textColor === 'string' && /^#[0-9a-f]{6}$/i.test(textColor) ? textColor : '#ffffff'

    // Check if key already exists
    const existing = await db.$queryRawUnsafe(
      `SELECT id FROM "ScammerStatus" WHERE key = $1`,
      cleanKey
    ) as any[]

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Тип с таким ключом уже существует' }, { status: 409 })
    }

    // Get max sortOrder
    const maxOrder = await db.$queryRawUnsafe(
      `SELECT COALESCE(MAX("sortOrder"), 0) as max_order FROM "ScammerStatus"`
    ) as any[]

    await db.$executeRawUnsafe(
      `INSERT INTO "ScammerStatus" (id, key, label, color, "textColor", "sortOrder", "isDefault", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())`,
      cleanKey, label.trim(), cleanColor, cleanTextColor, (maxOrder[0]?.max_order || 0) + 1
    )

    return NextResponse.json({ message: 'Тип создан', key: cleanKey }, { status: 201 })
  } catch (error) {
    console.error('Status types POST error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// PUT /api/status-types — admin only, update status type
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, key, label, color, textColor, sortOrder } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (label !== undefined && typeof label === 'string') {
      updates.push(`label = $${paramIndex++}`)
      params.push(label.trim().slice(0, 100))
    }
    if (color !== undefined && typeof color === 'string') {
      const c = /^#[0-9a-f]{6}$/i.test(color) ? color : '#6b7280'
      updates.push(`color = $${paramIndex++}`)
      params.push(c)
    }
    if (textColor !== undefined && typeof textColor === 'string') {
      const tc = /^#[0-9a-f]{6}$/i.test(textColor) ? textColor : '#ffffff'
      updates.push(`"textColor" = $${paramIndex++}`)
      params.push(tc)
    }
    if (sortOrder !== undefined && typeof sortOrder === 'number') {
      updates.push(`"sortOrder" = $${paramIndex++}`)
      params.push(Math.max(0, sortOrder))
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
    }

    params.push(id)
    await db.$executeRawUnsafe(
      `UPDATE "ScammerStatus" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      ...params
    )

    return NextResponse.json({ message: 'Тип обновлен' })
  } catch (error) {
    console.error('Status types PUT error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE /api/status-types — admin only
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    // Don't delete default statuses
    const status = await db.$queryRawUnsafe(
      `SELECT key, "isDefault" FROM "ScammerStatus" WHERE id = $1`,
      id
    ) as any[]

    if (status.length === 0) {
      return NextResponse.json({ error: 'Тип не найден' }, { status: 404 })
    }

    if (status[0].isDefault) {
      return NextResponse.json({ error: 'Нельзя удалить тип по умолчанию' }, { status: 400 })
    }

    // Reassign scammers with this status to default (scam)
    await db.$executeRawUnsafe(
      `UPDATE "Scammer" SET status = 'scam' WHERE status = $1`,
      status[0].key
    )

    await db.$executeRawUnsafe(
      `DELETE FROM "ScammerStatus" WHERE id = $1`,
      id
    )

    return NextResponse.json({ message: 'Тип удален' })
  } catch (error) {
    console.error('Status types DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
