import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const topUsers = await db.user.findMany({
      orderBy: { exp: 'desc' },
      take: 5,
      where: { role: { not: 'banned' } },
      select: {
        id: true,
        username: true,
        image: true,
        exp: true,
        _count: {
          select: { submissions: true },
        },
      },
    })

    const results = await Promise.all(
      topUsers.map(async (u) => {
        const approvedCount = await db.submission.count({
          where: { userId: u.id, status: 'approved' },
        })
        // Get first visible tag
        const tag = await db.userTag.findFirst({
          where: { userId: u.id, hidden: false },
          orderBy: { createdAt: 'asc' },
          select: { text: true, color: true, textColor: true, sparkly: true },
        })
        return {
          id: u.id,
          username: u.username,
          image: u.image,
          exp: u.exp,
          approvedSubmissions: approvedCount,
          totalSubmissions: u._count.submissions,
          tag: tag || null,
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Top EXP error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
