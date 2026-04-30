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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 30)
    const skip = parseInt(searchParams.get('skip') || '0')

    // Get total count
    const total = await db.scammer.count()

    if (total === 0) {
      return NextResponse.json({ results: [], total: 0 })
    }

    // Use random ordering via PostgreSQL random()
    const scammers = await db.$queryRawUnsafe(
      `SELECT id, name, description, status, "likeCount", "dislikeCount", "searchCount", "scammerType", "scamDate", "scamAmount", "scamCurrency", "telegramUserId", "proofLink", "screenshots", "createdAt"
       FROM "Scammer"
       ORDER BY RANDOM()
       LIMIT $1 OFFSET $2`,
      limit,
      skip
    ) as any[]

    const statusMap = await getStatusMap()

    function cleanDesc(desc: string): string {
      return desc.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
    }

    function safeParseJSON(str: string | null | undefined, fallback: unknown): unknown {
      if (!str) return fallback
      try {
        return JSON.parse(str)
      } catch {
        return fallback
      }
    }

    const results = scammers.map(s => ({
      id: s.id,
      name: s.name,
      description: cleanDesc(s.description || ''),
      status: s.status,
      statusLabel: statusMap[s.status]?.label || s.status,
      statusColor: statusMap[s.status]?.color || '#6b7280',
      statusTextColor: statusMap[s.status]?.textColor || '#ffffff',
      searchCount: s.searchCount || 0,
      likeCount: s.likeCount ?? 0,
      dislikeCount: s.dislikeCount ?? 0,
      screenshots: safeParseJSON(s.screenshots, []),
      scammerType: s.scammerType,
      scamDate: s.scamDate,
      scamAmount: (s as any).scamAmount || '',
      scamCurrency: (s as any).scamCurrency || '',
      proofLink: s.proofLink || '',
      telegramUserId: s.telegramUserId || '',
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ results, total })
  } catch (error) {
    console.error('Random scammers error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
