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

// GET: list all EXP rules
export async function GET() {
  try {
    const admin = await checkAdmin()
    if (!admin) return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })

    const rules = await db.expRule.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('ExpRules GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// POST: create new EXP rule
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })

    const { actionType, status, threshold, expReward } = await req.json()

    if (!actionType || !status) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
    }

    // Жёсткая валидация: должны быть целыми числами >= 1
    const numThreshold = Number(threshold)
    const numExpReward = Number(expReward)
    if (!Number.isInteger(numThreshold) || !Number.isInteger(numExpReward)) {
      return NextResponse.json({ error: 'Значения должны быть целыми числами' }, { status: 400 })
    }
    if (numThreshold < 1 || numExpReward < 1) {
      return NextResponse.json({ error: 'Значения должны быть больше 0' }, { status: 400 })
    }

    const validActions = ['submission', 'comment', 'search']
    const validStatuses = ['approved', 'rejected', 'all']
    if (!validActions.includes(actionType)) {
      return NextResponse.json({ error: 'Неверный тип действия' }, { status: 400 })
    }
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })
    }

    // Для search имеет смысл только status='all' — предупредим админа
    if (actionType === 'search' && status !== 'all') {
      return NextResponse.json(
        { error: 'Для поиска доступен только статус «Любой»' },
        { status: 400 }
      )
    }

    const rule = await db.expRule.create({
      data: { actionType, status, threshold: numThreshold, expReward: numExpReward },
    })

    return NextResponse.json({ rule, message: 'Правило создано' })
  } catch (error) {
    console.error('ExpRules POST error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: remove an EXP rule
export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })

    await db.expRule.delete({ where: { id } })
    return NextResponse.json({ message: 'Правило удалено' })
  } catch (error) {
    console.error('ExpRules DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
