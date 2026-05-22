import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/status-types/admin — admin only, returns ALL statuses including hidden
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const statuses = await db.$queryRawUnsafe(
      `SELECT id, key, label, color, "textColor", "sortOrder", "isDefault", hidden
       FROM "ScammerStatus"
       ORDER BY "sortOrder" ASC`
    ) as any[]

    return NextResponse.json({ statuses })
  } catch (error) {
    console.error('Status types admin GET error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
