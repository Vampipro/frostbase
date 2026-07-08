import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientIp, isIpBanned } from '@/lib/ban-check'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const clientIp = getClientIp(req)

    // Проверка бана по IP — для гостей обязательно, для залогиненных тоже
    // (на случай если админ забанил IP спамера, который создал аккаунт).
    if (await isIpBanned(clientIp)) {
      return NextResponse.json({ error: 'Ваш IP заблокирован' }, { status: 403 })
    }

    const body = await req.json()
    const { scammerName, scammerData, telegramUserId, screenshots, scammerStatus, scamAmount, scamCurrency } = body

    if (!scammerName || typeof scammerName !== 'string' || scammerName.trim().length < 1 || scammerName.trim().length > 200) {
      return NextResponse.json({ error: 'Имя скамера обязательно (1-200 символов)' }, { status: 400 })
    }

    const description = typeof scammerData === 'string' ? scammerData.slice(0, 2000) : ''
    const tgUserId = typeof telegramUserId === 'string' ? telegramUserId.replace(/[^\d]/g, '').slice(0, 20) : ''
    const scammerStatusKey = typeof scammerStatus === 'string' ? scammerStatus.trim().slice(0, 50) : 'scam'
    const screenshotUrls = Array.isArray(screenshots)
      ? screenshots.filter((s: unknown) => typeof s === 'string').slice(0, 3)
      : []

    // Get user ID (null for guests)
    let userId: string | null = null
    if (session?.user) {
      const sessionUser = session.user as { userId?: string; id?: string; role?: string; banned?: boolean }
      userId = sessionUser.userId || sessionUser.id || null

      // Проверка бана делается до транзакции — не требует блокировки.
      if (userId) {
        const user = await db.user.findUnique({ where: { id: userId } })
        if (user?.role === 'banned') {
          return NextResponse.json({ error: 'Вы заблокированы' }, { status: 403 })
        }
      }
    }

    // ВАЖНО: проверка лимита 3 активных заявок + создание заявки выполняются
    // в одной интерактивной транзакции. Раньше было count → create отдельными
    // запросами, что позволяло спамеру с 10 одновременных вкладок обойти лимит:
    // все 10 запросов видели activeCount=0 и все создавали заявку.
    // Теперь транзакция сериализует параллельные запросы одного юзера/IP.
    const result = await db.$transaction(async (tx) => {
      if (userId) {
        // Для залогиненных — лимит по userId
        const activeCount = await tx.submission.count({
          where: { userId, status: { in: ['pending', 'revision'] } },
        })
        if (activeCount >= 3) {
          return { error: 'Превышен лимит активных заявок (макс. 3). Дождитесь рассмотрения текущих.' }
        }
      } else {
        // Для гостей — лимит по IP
        const activeGuestCount = await tx.submission.count({
          where: { guestIp: clientIp, userId: null, status: { in: ['pending', 'revision'] } },
        })
        if (activeGuestCount >= 3) {
          return { error: 'Превышен лимит активных заявок (макс. 3). Дождитесь рассмотрения текущих.' }
        }
      }

      // FIX: Use exact match instead of contains for scammer lookup
      const existingScammer = await tx.scammer.findFirst({
        where: {
          name: {
            equals: scammerName.trim(),
            mode: 'insensitive',
          },
        },
      })

      const submission = await tx.submission.create({
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
          guestIp: clientIp,
          scammerId: existingScammer?.id || null,
        },
      })

      // If user provided telegramUserId and scammer already exists, update it
      if (existingScammer && tgUserId && !existingScammer.telegramUserId) {
        await tx.scammer.update({
          where: { id: existingScammer.id },
          data: { telegramUserId: tgUserId },
        })
      }

      return { submissionId: submission.id }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      { message: 'Заявка отправлена', id: result.submissionId },
      { status: 201 }
    )
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
