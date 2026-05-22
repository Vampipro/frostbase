import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/scammers/[id]/view — increment searchCount when user clicks on a card
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID' }, { status: 400 })
    }

    // Check scammer exists
    const scammer = await db.scammer.findUnique({ where: { id }, select: { id: true } })
    if (!scammer) {
      return NextResponse.json({ error: 'Не найден' }, { status: 404 })
    }

    // Increment searchCount
    await db.scammer.update({
      where: { id },
      data: { searchCount: { increment: 1 } },
    })

    // Create SearchLog entry
    const session = await getServerSession(authOptions)
    await db.searchLog.create({
      data: {
        scammerId: id,
        query: 'card_click',
        ...(session?.user
          ? {
              userId:
                (session.user as { userId?: string; id?: string }).userId ||
                (session.user as { userId?: string; id?: string }).id ||
                null,
            }
          : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('View increment error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
