import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { scammerName, scammerData, telegramUserId, screenshots, scammerStatus, scamAmount, scamCurrency } = body

    // Manual validation (reliable across Zod versions)
    if (!scammerName || typeof scammerName !== 'string' || scammerName.trim().length < 1 || scammerName.trim().length > 200) {
      return NextResponse.json({ error: 'Имя скамера обязательно (1-200 символов)' }, { status: 400 })
    }

    const description = typeof scammerData === 'string' ? scammerData.slice(0, 2000) : ''
    const tgUserId = typeof telegramUserId === 'string' ? telegramUserId.replace(/[^\d]/g, '').slice(0, 20) : ''
    const scammerStatusKey = typeof scammerStatus === 'string' ? scammerStatus.trim().slice(0, 50) : 'scam'
    const screenshotUrls = Array.isArray(screenshots)
      ? screenshots.filter((s: unknown) => typeof s === 'string').slice(0, 3)
      : []

    // Get user ID
    const sessionUser = session.user as { userId?: string; id?: string }
    const userId = sessionUser.userId || sessionUser.id

    if (!userId) {
      return NextResponse.json({ error: 'Ошибка сессии' }, { status: 401 })
    }

    // FIX: Use exact match instead of contains for scammer lookup
    const existingScammer = await db.scammer.findFirst({
      where: {
        name: {
          equals: scammerName.trim(),
          mode: 'insensitive',
        },
      },
    })

    const submission = await db.submission.create({
      data: {
        scammerName: scammerName.trim(),
        scammerData: description,
        telegramUserId: tgUserId,
        scammerStatus: scammerStatusKey,
        screenshots: JSON.stringify(screenshotUrls),
        scamAmount: typeof scamAmount === 'string' ? scamAmount.slice(0, 50) : '',
        scamCurrency: typeof scamCurrency === 'string' ? scamCurrency.slice(0, 50) : '',
        status: 'pending',
        userId,
        scammerId: existingScammer?.id || null,
      },
    })

    // If user provided telegramUserId and scammer already exists, update it
    if (existingScammer && tgUserId && !existingScammer.telegramUserId) {
      await db.scammer.update({
        where: { id: existingScammer.id },
        data: { telegramUserId: tgUserId },
      })
    }

    return NextResponse.json(
      { message: 'Заявка отправлена', id: submission.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
