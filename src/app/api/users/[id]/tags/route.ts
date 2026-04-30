import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET: get all tags for a user (public, no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ tags: [] })
    }

    const tags = await db.userTag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        color: true,
        textColor: true,
        sparkly: true,
      },
    })

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Public user tags GET error:', error)
    return NextResponse.json({ tags: [] })
  }
}
