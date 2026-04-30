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
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

export async function GET() {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const submissions = await db.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    const statusMap = await getStatusMap()

    const results = submissions.map((s: any) => ({
      id: s.id,
      scammerName: s.scammerName,
      scammerData: s.scammerData,
      telegramUserId: s.telegramUserId || '',
      scamAmount: s.scamAmount || '',
      scamCurrency: s.scamCurrency || '',
      scammerStatus: s.scammerStatus || 'scam',
      scammerStatusLabel: statusMap[s.scammerStatus]?.label || s.scammerStatus,
      scammerStatusColor: statusMap[s.scammerStatus]?.color || '#6b7280',
      scammerStatusTextColor: statusMap[s.scammerStatus]?.textColor || '#ffffff',
      screenshots: safeParseJSON(s.screenshots, []),
      status: s.status,
      statusLabel: statusMap[s.status]?.label || s.status,
      statusColor: statusMap[s.status]?.color || '#6b7280',
      statusTextColor: statusMap[s.status]?.textColor || '#ffffff',
      revisionReason: s.revisionReason,
      user: s.user,
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Panel submissions GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id, status, revisionReason, scammerName, scammerData } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Не указаны данные' }, { status: 400 })
    }

    // Handle delete action
    if (status === 'delete') {
      const submission = await db.submission.findUnique({ where: { id } })
      if (!submission) {
        return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
      }
      await db.submission.delete({ where: { id } })
      return NextResponse.json({ message: 'Заявка удалена' })
    }

    const validStatuses = ['approved', 'rejected', 'revision']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })
    }

    const submission = await db.submission.findUnique({ where: { id } })
    if (!submission) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }

    const adminUserId = (user as { userId?: string; id?: string }).userId || (user as { id?: string }).id || ''

    if (status === 'approved') {
      // FIX: Use exact match instead of contains to avoid linking wrong scammer
      const existingScammer = await db.scammer.findFirst({
        where: {
          name: {
            equals: submission.scammerName,
            mode: 'insensitive',
          },
        },
      })

      if (!existingScammer) {
        // FIX: Use actual admin userId instead of hardcoded 'admin' string
        const newScammer = await db.scammer.create({
          data: {
            name: scammerName || submission.scammerName,
            description: scammerData || submission.scammerData,
            status: (submission as any).scammerStatus || 'scam',
            screenshots: submission.screenshots,
            telegramUserId: (submission as any).telegramUserId || '',
            scamAmount: (submission as any).scamAmount || '',
            scamCurrency: (submission as any).scamCurrency || '',
            createdBy: adminUserId,
          },
        })

        await db.submission.update({
          where: { id },
          data: { status, scammerId: newScammer.id },
        })
      } else {
        // Update existing scammer's telegramUserId and amount if empty
        const scammerUpdateData: any = {}
        if (existingScammer.telegramUserId === '' && (submission as any).telegramUserId) {
          scammerUpdateData.telegramUserId = (submission as any).telegramUserId
        }
        if (existingScammer.scamAmount === '' && (submission as any).scamAmount) {
          scammerUpdateData.scamAmount = (submission as any).scamAmount
        }
        if (existingScammer.scamCurrency === '' && (submission as any).scamCurrency) {
          scammerUpdateData.scamCurrency = (submission as any).scamCurrency
        }
        if (Object.keys(scammerUpdateData).length > 0) {
          await db.scammer.update({
            where: { id: existingScammer.id },
            data: scammerUpdateData,
          })
        }
        await db.submission.update({
          where: { id },
          data: { status, scammerId: existingScammer.id },
        })
      }
    } else {
      await db.submission.update({
        where: { id },
        data: {
          status,
          revisionReason: typeof revisionReason === 'string' ? revisionReason : '',
        },
      })
    }

    return NextResponse.json({ message: 'Статус обновлен' })
  } catch (error) {
    console.error('Panel submissions PUT error:', error)
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
