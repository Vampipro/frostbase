import { NextResponse } from 'next/server'
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

// Top10 works for everyone (guests included)
export async function GET() {
  try {
    const statusMap = await getStatusMap()

    const topScammers = await db.scammer.findMany({
      where: {
        searchCount: { gt: 0 },
      },
      orderBy: {
        searchCount: 'desc',
      },
      take: 10,
    })

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

    const results = topScammers.map((s) => ({
      id: s.id,
      name: s.name,
      description: cleanDesc(s.description || ''),
      status: s.status,
      statusLabel: statusMap[s.status]?.label || s.status,
      statusColor: statusMap[s.status]?.color || '#6b7280',
      statusTextColor: statusMap[s.status]?.textColor || '#ffffff',
      totalSearches: s.searchCount,
      searchCount: s.searchCount,
      likeCount: s.likeCount ?? 0,
      dislikeCount: s.dislikeCount ?? 0,
      screenshots: safeParseJSON(s.screenshots, []),
      scammerType: s.scammerType,
      scamDate: s.scamDate,
      scamAmount: s.scamAmount || '',
      scamCurrency: s.scamCurrency || '',
      proofLink: s.proofLink,
      telegramUserId: s.telegramUserId || '',
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Top10 error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
