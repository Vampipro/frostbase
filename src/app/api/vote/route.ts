import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Виправлено імпорт на відносний шлях, щоб уникнути помилки Module not found
import { getClientIp, isIpBanned } from '@/lib/ban-check'

const VALID_TYPES = ['like', 'neutral', 'dislike'] as const

function getVoterId(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`
  return `ip:${getClientIp(req)}`
}

async function getUserId(): Promise<string | undefined> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return undefined
    return (session.user as { userId?: string; id?: string }).userId || (session.user as { id?: string }).id || undefined
  } catch {
    return undefined
  }
}

function getCountField(voteType: string) {
  switch (voteType) {
    case 'like': return 'likeCount'
    case 'neutral': return 'neutralCount'
    case 'dislike': return 'dislikeCount'
    default: return null
  }
}

// POST: vote like/neutral/dislike
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    const { scammerId, voteType } = await req.json()

    if (!scammerId || typeof scammerId !== 'string') {
      return NextResponse.json({ error: 'Вкажіть scammerId' }, { status: 400 })
    }
    if (typeof voteType !== 'string' || !VALID_TYPES.includes(voteType)) {
      return NextResponse.json({ error: 'Невірний тип голосу' }, { status: 400 })
    }

    const voterId = getVoterId(req, userId)

    // Перевірка бана по IP
    if (await isIpBanned(getClientIp(req))) {
      return NextResponse.json({ error: 'Ваш IP заблоковано' }, { status: 403 })
    }

    // Перевірка бана акаунта
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
      if (!user || user.role === 'banned') {
        return NextResponse.json({ error: 'Ви заблоковані' }, { status: 403 })
      }
    }

    const result = await db.$transaction(async (tx) => {
      const scammer = await tx.scammer.findUnique({ where: { id: scammerId } })
      if (!scammer) {
        return { error: { status: 404, message: 'Скамера не знайдено' } }
      }

      const existingVote = await tx.vote.findUnique({
        where: { scammerId_voterId: { scammerId, voterId } },
      })

      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Toggle off (скасування голосу)
          const field = getCountField(voteType)
          await tx.vote.delete({ where: { id: existingVote.id } })
          if (field) {
            // decrement safely using Prisma's decrement operator, then ensure non-negative
            const decData: any = {}
            decData[field] = { decrement: 1 }
            await tx.scammer.updateMany({ where: { id: scammerId }, data: decData })
            const fixWhere: any = { id: scammerId }
            fixWhere[field] = { lt: 0 }
            const fixData: any = {}
            fixData[field] = 0
            await tx.scammer.updateMany({ where: fixWhere, data: fixData })
          }
          const updated = await tx.scammer.findUnique({ where: { id: scammerId } })
          return {
            data: {
              voted: false,
              voteType: null,
              likeCount: Math.max(0, updated?.likeCount || 0),
              neutralCount: Math.max(0, updated?.neutralCount || 0),
              dislikeCount: Math.max(0, updated?.dislikeCount || 0),
            },
          }
        } else {
          // Switch vote (зміна голосу)
          const oldField = getCountField(existingVote.voteType)
          const newField = getCountField(voteType)

          await tx.vote.update({ where: { id: existingVote.id }, data: { voteType } })
          if (oldField) {
            const decData: any = {}
            decData[oldField] = { decrement: 1 }
            await tx.scammer.updateMany({ where: { id: scammerId }, data: decData })
            const fixWhere: any = { id: scammerId }
            fixWhere[oldField] = { lt: 0 }
            const fixData: any = {}
            fixData[oldField] = 0
            await tx.scammer.updateMany({ where: fixWhere, data: fixData })
          }
          if (newField) {
            const incData: any = {}
            incData[newField] = { increment: 1 }
            await tx.scammer.update({ where: { id: scammerId }, data: incData })
          }
          const updated = await tx.scammer.findUnique({ where: { id: scammerId } })
          return {
            data: {
              voted: true,
              voteType,
              likeCount: updated?.likeCount || 0,
              neutralCount: updated?.neutralCount || 0,
              dislikeCount: updated?.dislikeCount || 0,
            },
          }
        }
      }

      // New vote (новий голос)
      const field = getCountField(voteType)
      await tx.vote.create({ data: { scammerId, voteType, voterId } })
      if (field) {
        const incData: any = {}
        incData[field] = { increment: 1 }
        await tx.scammer.update({ where: { id: scammerId }, data: incData })
      }
      const updated = await tx.scammer.findUnique({ where: { id: scammerId } })
      return {
        data: {
          voted: true,
          voteType,
          likeCount: updated?.likeCount || 0,
          neutralCount: updated?.neutralCount || 0,
          dislikeCount: updated?.dislikeCount || 0,
        },
      }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Помилка голосування' }, { status: 500 })
  }
}

// GET: check current vote status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scammerId = searchParams.get('scammerId')
    if (!scammerId) {
      return NextResponse.json({ error: 'Вкажіть scammerId' }, { status: 400 })
    }

    const userId = await getUserId()
    const voterId = getVoterId(req, userId)

    const vote = await db.vote.findUnique({
      where: { scammerId_voterId: { scammerId, voterId } },
    })

    const scammer = await db.scammer.findUnique({
      where: { id: scammerId },
      select: { likeCount: true, neutralCount: true, dislikeCount: true },
    })

    return NextResponse.json({
      voteType: vote?.voteType || null,
      likeCount: scammer?.likeCount ?? 0,
      neutralCount: scammer?.neutralCount ?? 0,
      dislikeCount: scammer?.dislikeCount ?? 0,
    })
  } catch (error) {
    console.error('Vote check error:', error)
    return NextResponse.json({ error: 'Помилка' }, { status: 500 })
  }
}
