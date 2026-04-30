import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalScammers,
      totalSubmissions,
      totalUsers,
      totalSearches,
      scamCount,
      verifiedCount,
      searchesToday,
      likesToday,
      scammersAddedToday,
    ] = await Promise.all([
      db.scammer.count(),
      db.submission.count(),
      db.user.count(),
      db.searchLog.count(),
      db.scammer.count({ where: { status: 'scam' } }),
      db.scammer.count({ where: { status: 'verified' } }),
      db.searchLog.count({ where: { createdAt: { gte: todayStart } } }),
      db.vote.count({ where: { createdAt: { gte: todayStart }, voteType: 'like' } }),
      db.scammer.count({ where: { createdAt: { gte: todayStart } } }),
    ])

    return NextResponse.json({
      totalScammers,
      totalSubmissions,
      totalUsers,
      totalSearches,
      scamCount,
      verifiedCount,
      searchesToday,
      likesToday,
      scammersAddedToday,
    })
  } catch (error) {
    console.error('Public stats error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
