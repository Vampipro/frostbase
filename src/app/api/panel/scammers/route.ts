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

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  // Use the augmented Session type - role is typed as string
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const search = (searchParams.get('search') || '').trim()
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [scammers, total] = await Promise.all([
      db.scammer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.scammer.count({ where }),
    ])

    const scammerIds = scammers.map(s => s.id)
    const submissionCounts = scammerIds.length > 0
      ? await db.submission.groupBy({
          by: ['scammerId'],
          where: { scammerId: { in: scammerIds } },
          _count: { id: true },
        })
      : []
    const countMap = new Map(submissionCounts.map(sc => [sc.scammerId, sc._count.id]))

    const statusMap = await getStatusMap()

    function cleanDesc(desc: string): string {
      return desc.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
    }

    const results = scammers.map((s: any) => ({
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
      createdBy: s.createdBy,
      createdAt: s.createdAt,
      scammerType: s.scammerType,
      scamDate: s.scamDate,
      scamAmount: s.scamAmount || '',
      scamCurrency: s.scamCurrency || '',
      proofLink: s.proofLink,
      telegramUserId: s.telegramUserId || '',
      submissionCount: countMap.get(s.id) || 0,
    }))

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Panel scammers GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, status, screenshots, scammerType, scamDate, scamAmount, scamCurrency, proofLink, telegramUserId } = body

    // Manual validation (more reliable than Zod v4 compatibility issues)
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 200) {
      return NextResponse.json({ error: 'Имя обязательно (1-200 символов)' }, { status: 400 })
    }

    // Get valid statuses from DB (supports custom statuses created by admin)
    const statusRows = await db.$queryRawUnsafe(`SELECT key FROM "ScammerStatus"`) as any[]
    const validStatuses = statusRows.map((r: any) => r.key)
    const scammerStatus = validStatuses.includes(status) ? status : 'scam'
    const scammerDesc = typeof description === 'string' ? description.slice(0, 2000) : ''
    const scammerScreenshots = Array.isArray(screenshots) ? screenshots.filter((s: unknown) => typeof s === 'string') : []

    const userId = (user as { userId?: string; id?: string }).userId || (user as { id?: string }).id || ''

    const scammer = await db.scammer.create({
      data: {
        name: name.trim(),
        description: scammerDesc,
        status: scammerStatus,
        screenshots: JSON.stringify(scammerScreenshots),
        createdBy: userId,
        scammerType: typeof scammerType === 'string' ? scammerType.slice(0, 100) : '',
        scamDate: typeof scamDate === 'string' ? scamDate.slice(0, 50) : '',
        scamAmount: typeof scamAmount === 'string' ? scamAmount.slice(0, 50) : '',
        scamCurrency: typeof scamCurrency === 'string' ? scamCurrency.slice(0, 50) : '',
        proofLink: typeof proofLink === 'string' ? proofLink.slice(0, 500) : '',
        telegramUserId: typeof telegramUserId === 'string' ? telegramUserId.slice(0, 50) : '',
      },
    })

    return NextResponse.json(
      { message: 'Скамер добавлен', id: scammer.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Panel scammers POST error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, name, description, status, screenshots, searchCount, scammerType, scamDate, scamAmount, scamCurrency, proofLink, telegramUserId } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    // Save name history if name changed
    if (name !== undefined && typeof name === 'string') {
      const newName = name.trim().slice(0, 200)
      const existing = await db.scammer.findUnique({ where: { id }, select: { name: true } })
      if (existing && existing.name !== newName) {
        await db.scammerNameHistory.create({
          data: { scammerId: id, oldName: existing.name, newName },
        })
      }
      updateData.name = newName
    }
    if (description !== undefined && typeof description === 'string') updateData.description = description.slice(0, 2000)
    if (status !== undefined) {
      // Get valid statuses from DB (supports custom statuses created by admin)
      const statusRows = await db.$queryRawUnsafe(`SELECT key FROM "ScammerStatus"`) as any[]
      const validStatuses = statusRows.map((r: any) => r.key)
      if (validStatuses.includes(status)) updateData.status = status
    }
    if (screenshots !== undefined && Array.isArray(screenshots)) {
      updateData.screenshots = JSON.stringify(screenshots.filter((s: unknown) => typeof s === 'string'))
    }
    if (searchCount !== undefined && typeof searchCount === 'number') {
      updateData.searchCount = Math.max(0, searchCount)
    }
    if (scammerType !== undefined && typeof scammerType === 'string') updateData.scammerType = scammerType.slice(0, 100)
    if (scamDate !== undefined && typeof scamDate === 'string') updateData.scamDate = scamDate.slice(0, 50)
    if (scamAmount !== undefined && typeof scamAmount === 'string') updateData.scamAmount = scamAmount.slice(0, 50)
    if (scamCurrency !== undefined && typeof scamCurrency === 'string') updateData.scamCurrency = scamCurrency.slice(0, 50)
    if (proofLink !== undefined && typeof proofLink === 'string') updateData.proofLink = proofLink.slice(0, 500)
    if (telegramUserId !== undefined && typeof telegramUserId === 'string') updateData.telegramUserId = telegramUserId.slice(0, 50)

    const scammer = await db.scammer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ message: 'Обновлено', scammer })
  } catch (error) {
    console.error('Panel scammers PUT error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    await db.comment.deleteMany({ where: { scammerId: id } })
    await db.vote.deleteMany({ where: { scammerId: id } })
    await db.searchLog.deleteMany({ where: { scammerId: id } })
    await db.appeal.deleteMany({ where: { scammerId: id } })
    await db.submission.updateMany({ where: { scammerId: id }, data: { scammerId: null } })
    await db.scammer.delete({ where: { id } })
    return NextResponse.json({ message: 'Удалено' })
  } catch (error) {
    console.error('Panel scammers DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// Safe JSON parse helper
function safeParseJSON(str: string | null | undefined, fallback: unknown): unknown {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}
