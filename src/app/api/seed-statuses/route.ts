import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// One-time seed: insert default status types
export async function POST(req: NextRequest) {
  try {
    // Auth check — only admins can seed statuses
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }
    // Check if already seeded
    const existing = await db.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "ScammerStatus"`) as any[]
    if (existing[0]?.cnt > 0) {
      return NextResponse.json({ message: 'Already seeded', count: existing[0].cnt })
    }

    await db.$executeRawUnsafe(`
      INSERT INTO "ScammerStatus" ("id", "key", "label", "color", "textColor", "sortOrder", "isDefault", "createdAt") VALUES
      (gen_random_uuid(), 'scam', 'СКАМ', '#ef4444', '#ffffff', 0, true, NOW()),
      (gen_random_uuid(), 'verified', 'Проверен', '#22c55e', '#ffffff', 1, true, NOW()),
      (gen_random_uuid(), 'suspicious', 'Подозрительный', '#f59e0b', '#ffffff', 2, true, NOW()),
      (gen_random_uuid(), 'not_in_db', 'Нет в базе', '#6b7280', '#ffffff', 3, true, NOW()),
      (gen_random_uuid(), 'unverified', 'Не проверен', '#3b82f6', '#ffffff', 4, true, NOW());
    `)

    return NextResponse.json({ message: 'Seeded 5 default statuses' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
