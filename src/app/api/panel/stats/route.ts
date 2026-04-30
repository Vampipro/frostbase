import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalScammers,
      totalSubmissions,
      pendingSubmissions,
      totalUsers,
      totalSearches,
      scamCount,
      verifiedCount,
      searchesToday,
      likesToday,
      scammersAddedToday,
      scammersUpdatedToday,
    ] = await Promise.all([
      db.scammer.count(),
      db.submission.count(),
      db.submission.count({ where: { status: 'pending' } }),
      db.user.count(),
      db.searchLog.count(),
      db.scammer.count({ where: { status: 'scam' } }),
      db.scammer.count({ where: { status: 'verified' } }),
      db.searchLog.count({ where: { createdAt: { gte: todayStart } } }),
      // Likes today: count votes created today with type 'like'
      db.vote.count({ where: { createdAt: { gte: todayStart }, voteType: 'like' } }),
      // Scammers created today
      db.scammer.count({ where: { createdAt: { gte: todayStart } } }),
      // Scammers updated today (updatedAt > createdAt means it was modified)
      db.scammer.count({
        where: {
          createdAt: { lt: todayStart },
          updatedAt: { gte: todayStart },
        },
      }),
      // Deleted scammers — tracked via creation date being today but count is tricky
      // We'll use a simple heuristic: count submissions approved today as proxy for activity
      db.submission.count({ where: { status: 'approved', updatedAt: { gte: todayStart } } }),
    ])

    return NextResponse.json({
      totalScammers,
      totalSubmissions,
      pendingSubmissions,
      totalUsers,
      totalSearches,
      scamCount,
      verifiedCount,
      searchesToday,
      likesToday,
      scammersAddedToday,
      scammersUpdatedToday,
      dbChangesToday: scammersAddedToday + scammersUpdatedToday,
    })
  } catch (error) {
    console.error('Panel stats error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
