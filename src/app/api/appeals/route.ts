import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST: submit an appeal for a scammer
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUser = session?.user as { userId?: string; id?: string; role?: string; banned?: boolean } | undefined
    const userId = sessionUser?.userId || sessionUser?.id || null

    const { scammerId, proofLink, description } = await req.json()

    if (!scammerId || typeof scammerId !== 'string') {
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Описание должно быть минимум 10 символов' }, { status: 400 })
    }

    if (description.trim().length > 100) {
      return NextResponse.json({ error: 'Описание слишком длинное (макс. 100 символов)' }, { status: 400 })
    }

    // Check scammer exists
    const scammer = await db.scammer.findUnique({ where: { id: scammerId } })
    if (!scammer) {
      return NextResponse.json({ error: 'Скамер не найден' }, { status: 404 })
    }

    // Check if user is banned
    if (userId && sessionUser) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (user?.role === 'banned') {
        return NextResponse.json({ error: 'Вы заблокированы' }, { status: 403 })
      }

      // Rate limit: max 1 appeal per scammer per user
      const existingAppeal = await db.appeal.findFirst({
        where: { scammerId, userId, status: 'pending' },
      })
      if (existingAppeal) {
        return NextResponse.json({ error: 'У вас уже есть активная апелляция на этого человека' }, { status: 400 })
      }
    }

    const appeal = await db.appeal.create({
      data: {
        scammerId,
        userId,
        proofLink: (proofLink || '').trim(),
        description: description.trim(),
      },
      include: {
        scammer: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      id: appeal.id,
      message: 'Апелляция отправлена',
      scammer: appeal.scammer,
    }, { status: 201 })
  } catch (error) {
    console.error('Appeal POST error:', error)
    return NextResponse.json({ error: 'Ошибка отправки апелляции' }, { status: 500 })
  }
}
