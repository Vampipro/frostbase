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

    if (!userId || amount === undefined || amount === 0) {
      return NextResponse.json({ error: 'Укажите userId и amount (положительное или отрицательное)' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const newExp = Math.max(0, targetUser.exp + amount)
    await db.user.update({
      where: { id: userId },
      data: { exp: newExp },
    })

    return NextResponse.json({
      message: amount > 0 ? `+${amount} EXP` : `${amount} EXP`,
      newExp,
    })
  } catch (error) {
    console.error('User EXP POST error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
