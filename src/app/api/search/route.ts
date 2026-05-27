import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
    // Search works for everyone (guests included)
    const session = await getServerSession(authOptions).catch(() => null)

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()
    const telegramId = searchParams.get('id')?.trim()

    if (!query && !telegramId) {
      return NextResponse.json({ error: 'Заполните имя или ID' }, { status: 400 })
    }

    // Track search press (scammerId=null means it's a button press, not a card click)
    const searchQuery = `${query || ''}${telegramId ? (query ? ' | ' : '') + telegramId : ''}`
    db.searchLog.create({
      data: {
        query: searchQuery,
        scammerId: null,
        ...(session?.user
          ? {
              userId:
                (session.user as { userId?: string; id?: string }).userId ||
                (session.user as { userId?: string; id?: string }).id ||
                null,
            }
          : {}),
      },
    }).catch(() => {}) // Fire and forget, don't block the search

    // Build where clause: search by name AND/OR telegramUserId
    // Strip @ from query for fuzzy matching
    const cleanQuery = (query || '').replace(/^@/i, '')
    const conditions: any[] = []
    if (cleanQuery) {
      conditions.push({ name: { contains: cleanQuery, mode: 'insensitive' } })
    }
    if (telegramId) {
      conditions.push({ telegramUserId: { contains: telegramId } })
    }

    const scammers = await db.scammer.findMany({
      where: {
        OR: conditions,
      },
      take: 20,
    })

    // DON'T increment searchCount here — it's done when user clicks on a card
    // Count submissions per scammer
    const scammerIds = scammers.map((s) => s.id)
    let submissionCounts: Map<string, number> = new Map()
    if (scammerIds.length > 0) {
      const counts = await db.submission.groupBy({
        by: ['scammerId'],
        where: { scammerId: { in: scammerIds, not: null } },
        _count: { id: true },
      })
      submissionCounts = new Map(counts.map((sc) => [sc.scammerId!, sc._count.id]))
    }

    const statusMap = await getStatusMap()

    function cleanDesc(desc: string): string {
      return desc.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
    }

    const results = scammers.map((s) => ({
      id: s.id,
      name: s.name,
      description: cleanDesc(s.description || ''),
      status: s.status,
      statusLabel: statusMap[s.status]?.label || s.status,
      statusColor: statusMap[s.status]?.color || '#6b7280',
      statusTextColor: statusMap[s.status]?.textColor || '#ffffff',
      searchCount: s.searchCount,
      likeCount: s.likeCount ?? 0,
      dislikeCount: s.dislikeCount ?? 0,
      submissionCount: submissionCounts.get(s.id) || 0,
      screenshots: safeParseJSON(s.screenshots, []),
      scammerType: s.scammerType,
      scamDate: s.scamDate,
      scamAmount: s.scamAmount || '',
      scamCurrency: s.scamCurrency || '',
      proofLink: s.proofLink,
      telegramUserId: s.telegramUserId || '',
      createdAt: s.createdAt,
    }))

    return NextResponse.json({
      query,
      results,
      totalResults: results.length,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 })
  }
}

function safeParseJSON(str: string | null | undefined, fallback: unknown): unknown {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}
