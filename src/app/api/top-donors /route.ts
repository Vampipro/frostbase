import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Топ донатеров — сортируем по donated desc, показываем только тех у кого >0 или isSponsor
    // Исключаем забаненных и админов для честности, но спонсоры-админы тоже могут быть? Оставим только banned исключать
    const topDonors = await db.user.findMany({
      where: {
        role: { not: 'banned' },
        OR: [
          { donated: { gt: 0 } },
          { isSponsor: true },
        ],
      },
      orderBy: { donated: 'desc' },
      take: 15,
      select: {
        id: true,
        username: true,
        image: true,
        exp: true,
        isSponsor: true,
        donated: true,
        isPlaceholder: true,
        _count: { select: { submissions: true } },
      },
    })

    const results = await Promise.all(
      topDonors.map(async (u) => {
        if (u.isPlaceholder) {
          return {
            id: u.id,
            username: u.username,
            image: u.image,
            exp: 0,
            isSponsor: u.isSponsor,
            donated: u.donated,
            isPlaceholder: true,
            approvedSubmissions: 0,
            totalSubmissions: 0,
            tag: null,
          }
        }
        const approvedCount = await db.submission.count({
          where: { userId: u.id, status: 'approved' },
        })
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
          isSponsor: u.isSponsor,
          donated: u.donated,
          isPlaceholder: false,
          approvedSubmissions: approvedCount,
          totalSubmissions: u._count.submissions,
          tag: tag || null,
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Top donors error:', error)
    return NextResponse.json({ results: [] })
  }
}
