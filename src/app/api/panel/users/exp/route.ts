import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

// POST: manually add or remove EXP from a user
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })

    const { userId, amount } = await req.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Укажите userId' }, { status: 400 })
    }

    // Жёсткая валидация amount: должно быть целым числом, не 0
    const numAmount = Number(amount)
    if (!Number.isInteger(numAmount) || numAmount === 0) {
      return NextResponse.json(
        { error: 'Укажите amount — целое число, не равное 0' },
        { status: 400 }
      )
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, exp: true, role: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    if (targetUser.role === 'banned') {
      return NextResponse.json(
        { error: 'Пользователь заблокирован — EXP недоступен' },
        { status: 400 }
      )
    }

    // Атомарный increment; если уйдёт в минус — поднимаем до 0 отдельным апдейтом.
    // Race-safe: increment в одном SQL-запросе, без read-then-write.
    const updated = await db.user.update({
      where: { id: userId },
      data: { exp: { increment: numAmount } },
      select: { exp: true },
    })

    let finalExp = updated.exp
    if (finalExp < 0) {
      const clamped = await db.user.update({
        where: { id: userId },
        data: { exp: 0 },
        select: { exp: true },
      })
      finalExp = clamped.exp
    }

    return NextResponse.json({
      message: numAmount > 0 ? `+${numAmount} EXP` : `${numAmount} EXP`,
      newExp: finalExp,
    })
  } catch (error) {
    console.error('User EXP POST error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
