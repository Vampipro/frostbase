import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET: public name history for any user (read-only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15')))
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      db.scammerNameHistory.findMany({
        where: { scammerId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.scammerNameHistory.count({ where: { scammerId: id } }),
    ])

    return NextResponse.json({
      results: history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Public name history GET error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
