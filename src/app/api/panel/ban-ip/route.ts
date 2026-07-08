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

// GET: список забаненных IP (админка)
export async function GET() {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const banned = await db.bannedIp.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ results: banned })
  } catch (error) {
    console.error('Ban IP GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// POST: забанить IP — теперь реально сохраняем в БД
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { ip, reason } = await req.json()

    if (!ip || typeof ip !== 'string' || ip.trim().length === 0) {
      return NextResponse.json({ error: 'IP не указан' }, { status: 400 })
    }

    const cleanIp = ip.trim()
    const adminId = (admin as { userId?: string; id?: string }).userId || (admin as { id?: string }).id || ''
    const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''

    // upsert — если IP уже забанен, обновляем причину и bannedBy
    const record = await db.bannedIp.upsert({
      where: { ip: cleanIp },
      update: { reason: cleanReason, bannedBy: adminId },
      create: { ip: cleanIp, reason: cleanReason, bannedBy: adminId },
    })

    return NextResponse.json({
      message: `IP ${cleanIp} заблокирован`,
      ip: cleanIp,
      id: record.id,
    })
  } catch (error) {
    console.error('Ban IP error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// DELETE: разбанить IP
export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const ip = searchParams.get('ip')

    if (!id && !ip) {
      return NextResponse.json({ error: 'Укажите id или ip' }, { status: 400 })
    }

    if (id) {
      await db.bannedIp.delete({ where: { id } }).catch(() => {})
    } else if (ip) {
      await db.bannedIp.delete({ where: { ip } }).catch(() => {})
    }

    return NextResponse.json({ message: 'IP разблокирован' })
  } catch (error) {
    console.error('Unban IP error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
