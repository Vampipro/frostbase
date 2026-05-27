import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tags — returns all visible ScammerStatus types with scammer counts
export async function GET() {
  try {
    // Get all non-hidden status types
    const statuses = await db.$queryRawUnsafe(
      `SELECT key, label, color, "textColor", "sortOrder" FROM "ScammerStatus" WHERE hidden = false ORDER BY "sortOrder"`
    ) as any[]

    // Count scammers per status
    const statusCounts = await db.scammer.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const countMap: Record<string, number> = {}
    for (const sc of statusCounts) {
      countMap[sc.status] = sc._count.id
    }

    const result = statuses.map((s) => ({
      key: s.key,
      text: s.label,
      count: countMap[s.key] || 0,
      color: s.color || '#6b7280',
      textColor: s.textColor || '#ffffff',
    }))

    return NextResponse.json({ tags: result })
  } catch (error) {
    console.error('Tags fetch error:', error)
    return NextResponse.json({ tags: [] })
  }
}
