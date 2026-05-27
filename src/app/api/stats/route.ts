import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const threeDaysAgo = new Date(todayStart)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2)

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
      // Absolute searches (button presses): SearchLog where scammerId IS NULL
      absoluteSearchesToday,
      absoluteSearches3Days,
      absoluteSearchesAll,
      // Views (card clicks): SearchLog where scammerId IS NOT NULL
      viewsToday,
      views3Days,
      viewsAll,
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
      // Absolute searches (button presses = SearchLog with scammerId null)
      db.searchLog.count({ where: { createdAt: { gte: todayStart }, scammerId: null } }),
      db.searchLog.count({ where: { createdAt: { gte: threeDaysAgo }, scammerId: null } }),
      db.searchLog.count({ where: { scammerId: null } }),
      // Views (card clicks = SearchLog with scammerId not null)
      db.searchLog.count({ where: { createdAt: { gte: todayStart }, scammerId: { not: null } } }),
      db.searchLog.count({ where: { createdAt: { gte: threeDaysAgo }, scammerId: { not: null } } }),
      db.searchLog.count({ where: { scammerId: { not: null } } }),
    ])

    // Digit-start stats: count scammers whose telegramUserId starts with each digit 0-9
    const allScammers = await db.scammer.findMany({
      where: { telegramUserId: { not: '' } },
      select: { telegramUserId: true },
    })

    const digitCounts: Record<string, number> = {}
    for (let d = 0; d <= 9; d++) {
      digitCounts[String(d)] = 0
    }
    for (const s of allScammers) {
      if (s.telegramUserId) {
        const firstChar = s.telegramUserId.charAt(0)
        if (firstChar >= '0' && firstChar <= '9') {
          digitCounts[firstChar]++
        }
      }
    }

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
      // Absolute searches (button presses)
      absoluteSearchesToday,
      absoluteSearches3Days,
      absoluteSearchesAll,
      // Views (card clicks)
      viewsToday,
      views3Days,
      viewsAll,
      // Digit-start stats
      digitStartCounts: digitCounts,
    })
  } catch (error) {
    console.error('Public stats error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
