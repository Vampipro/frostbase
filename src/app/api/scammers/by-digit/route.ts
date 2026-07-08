import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function getStatusMap(): Promise<Record<string, { label: string; color: string; textColor: string }>> {
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT key, label, color, "textColor" FROM "ScammerStatus" ORDER BY "sortOrder"`
    ) as any[]
    const map: Record<string, { label: string; color: string; textColor: string }> = {}
    for (const r of rows) {
      map[r.key] = { label: r.label, color: r.color, textColor: r.textColor }
    }
    return map
  } catch {
    return {}
  }
}

// GET /api/scammers/by-digit?digit=5&limit=10
// Returns random scammers whose telegramUserId starts with the given digit
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const digit = searchParams.get('digit')?.trim()
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))

    if (!digit || digit.length !== 1 || digit < '0' || digit > '9') {
      return NextResponse.json({ error: 'Укажите одну цифру 0-9' }, { status: 400 })
    }

    // Use raw SQL for LIKE with prefix.
    // Фильтруем по status = 'scam' — чтобы карусель показывала только реальных скамеров,
    // а не проверенных/подозрительных. Согласовано со статистикой в /api/stats.
    const scammers = await db.$queryRawUnsafe(
      `SELECT id, name, description, status, "searchCount", "likeCount", "dislikeCount",
              "scammerType", "scamDate", "scamAmount", "scamCurrency", "proofLink", "telegramUserId", "screenshots"
       FROM "Scammer"
       WHERE "telegramUserId" LIKE $1 || '%' AND status = 'scam'
       ORDER BY RANDOM()
       LIMIT $2`,
      digit,
      limit
    ) as any[]

    const statusMap = await getStatusMap()

    const results = scammers.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description?.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n') || '',
      status: s.status,
      statusLabel: statusMap[s.status]?.label || s.status,
      statusColor: statusMap[s.status]?.color || '#6b7280',
      statusTextColor: statusMap[s.status]?.textColor || '#ffffff',
      searchCount: s.searchCount,
      likeCount: s.likeCount ?? 0,
      dislikeCount: s.dislikeCount ?? 0,
      scammerType: s.scammerType,
      scamAmount: s.scamAmount || '',
      scamCurrency: s.scamCurrency || '',
      proofLink: s.proofLink,
      telegramUserId: s.telegramUserId || '',
    }))

    const total = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int as c FROM "Scammer" WHERE "telegramUserId" LIKE $1 || '%' AND status = 'scam'`,
      digit
    ) as any[]

    return NextResponse.json({
      digit,
      results,
      total: total[0]?.c || 0,
    })
  } catch (error) {
    console.error('Digit search error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
