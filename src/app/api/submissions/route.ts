import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const sessionUser = session.user as { userId?: string; id?: string }
    const userId = sessionUser.userId || sessionUser.id

    if (!userId) {
      return NextResponse.json({ error: 'Ошибка сессии' }, { status: 401 })
    }

    const submissions = await db.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const statusLabels: Record<string, string> = {
      pending: 'На рассмотрении',
      approved: 'Подтверждена',
      rejected: 'Отклонена',
      revision: 'Требуется доработка',
    }

    const results = submissions.map((s) => ({
      id: s.id,
      scammerName: s.scammerName,
      scammerData: s.scammerData,
      screenshots: safeParseJSON(s.screenshots, []),
      status: s.status,
      statusLabel: statusLabels[s.status] || s.status,
      revisionReason: s.revisionReason,
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Submissions error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const sessionUser = session.user as { userId?: string; id?: string }
    const userId = sessionUser.userId || sessionUser.id

    if (!userId) {
      return NextResponse.json({ error: 'Ошибка сессии' }, { status: 401 })
    }

    const { id, scammerName, scammerData, screenshots, action } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID заявки' }, { status: 400 })
    }

    const submission = await db.submission.findFirst({
      where: { id, userId },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }

    if (action === 'delete') {
      await db.submission.delete({ where: { id } })
      return NextResponse.json({ message: 'Заявка удалена' })
    }

    if (submission.status === 'revision') {
      const updatedName = typeof scammerName === 'string' && scammerName.trim() ? scammerName.trim().slice(0, 200) : submission.scammerName
      const updatedData = typeof scammerData === 'string' ? scammerData.slice(0, 2000) : submission.scammerData
      const updatedScreenshots = Array.isArray(screenshots)
        ? JSON.stringify(screenshots.filter((s: unknown) => typeof s === 'string').slice(0, 3))
        : submission.screenshots

      await db.submission.update({
        where: { id },
        data: {
          scammerName: updatedName,
          scammerData: updatedData,
          screenshots: updatedScreenshots,
          status: 'pending',
          revisionReason: '',
        },
      })

      return NextResponse.json({ message: 'Заявка обновлена и отправлена на проверку' })
    }

    return NextResponse.json({ error: 'Невозможно изменить заявку' }, { status: 400 })
  } catch (error) {
    console.error('Update submission error:', error)
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
