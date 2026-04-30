import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// POST: anyone can submit a complaint (no auth needed)
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`complaint:${ip}`)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Слишком много жалоб. Подождите минуту.' },
        { status: 429 }
      )
    }

    const { name, reason } = await req.json()

    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 200) {
      return NextResponse.json({ error: 'Укажите имя (1-200 символов)' }, { status: 400 })
    }

    const complaintReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''

    const complaint = await db.complaint.create({
      data: {
        name: name.trim(),
        reason: complaintReason,
      },
    })

    return NextResponse.json({ message: 'Жалоба отправлена', id: complaint.id }, { status: 201 })
  } catch (error) {
    console.error('Complaint POST error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
