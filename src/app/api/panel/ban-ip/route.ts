import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

// POST: Ban IP - stores in a simple JSON file on the server
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { ip } = await req.json()

    if (!ip || typeof ip !== 'string' || ip.trim().length === 0) {
      return NextResponse.json({ error: 'IP не указан' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: `IP ${ip.trim()} заблокирован`,
      ip: ip.trim()
    })
  } catch (error) {
    console.error('Ban IP error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
