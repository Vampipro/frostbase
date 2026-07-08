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

// GET /api/scammers/by-tag?tag=scam            — один тег (обратная совместимость)
// GET /api/scammers/by-tag?tags=scam,verified  — несколько тегов (мультиселект)
// Возвращает скамеров с любым из указанных статусов.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const singleTag = searchParams.get('tag')?.trim()
    const multiTags = searchParams.get('tags')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Собираем список тегов: приоритет у multiTags, иначе singleTag
    let tags: string[] = []
    if (multiTags) {
      tags = multiTags.split(',').map(t => t.trim()).filter(Boolean)
    } else if (singleTag) {
      tags = [singleTag]
    }

    if (tags.length === 0) {
      return NextResponse.json({ error: 'Укажите статус' }, { status: 400 })
    }

    // Если один тег — простой where; если несколько — OR / in
    const where = tags.length === 1
      ? { status: tags[0] }
      : { status: { in: tags } }

    const [total, scammers] = await Promise.all([
      db.scammer.count({ where }),
      db.scammer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

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
      results,
      total,
      totalPages: Math.ceil(total / limit),
      page,
      tags,
    })
  } catch (error) {
    console.error('Tag search error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
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
