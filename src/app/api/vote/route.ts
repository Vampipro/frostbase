import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VALID_TYPES = ['like', 'neutral', 'dislike'] as const

function getVoterId(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
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
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
    }
    if (!VALID_TYPES.includes(voteType)) {
      return NextResponse.json({ error: 'Неверный тип голоса' }, { status: 400 })
    }

    const voterId = getVoterId(req, userId)

    const scammer = await db.scammer.findUnique({ where: { id: scammerId } })
    if (!scammer) {
      return NextResponse.json({ error: 'Скамер не найден' }, { status: 404 })
    }

    const existingVote = await db.vote.findUnique({
      where: { scammerId_voterId: { scammerId, voterId } },
    })

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Toggle off
        const field = getCountField(voteType)
        await db.vote.delete({ where: { id: existingVote.id } })
        await db.scammer.update({
          where: { id: scammerId },
          data: field ? { [field]: { decrement: 1 } } : {},
        })
        const updated = await db.scammer.findUnique({ where: { id: scammerId } })
        return NextResponse.json({
          voted: false,
          voteType: null,
          likeCount: Math.max(0, updated?.likeCount || 0),
          neutralCount: Math.max(0, updated?.neutralCount || 0),
          dislikeCount: Math.max(0, updated?.dislikeCount || 0),
        })
      } else {
        // Switch vote
        const oldField = getCountField(existingVote.voteType)
        const newField = getCountField(voteType)
        const updateData: Record<string, any> = {}
        if (oldField) updateData[oldField] = { decrement: 1 }
        if (newField) updateData[newField] = { increment: 1 }

        await db.vote.update({ where: { id: existingVote.id }, data: { voteType } })
        await db.scammer.update({
          where: { id: scammerId },
          data: updateData,
        })
        const updated = await db.scammer.findUnique({ where: { id: scammerId } })
        return NextResponse.json({
          voted: true,
          voteType,
          likeCount: updated?.likeCount || 0,
          neutralCount: updated?.neutralCount || 0,
          dislikeCount: updated?.dislikeCount || 0,
        })
      }
    }

    // New vote
    const field = getCountField(voteType)
    await db.vote.create({ data: { scammerId, voteType, voterId } })
    await db.scammer.update({
      where: { id: scammerId },
      data: field ? { [field]: { increment: 1 } } : {},
    })
    const updated = await db.scammer.findUnique({ where: { id: scammerId } })
    return NextResponse.json({
      voted: true,
      voteType,
      likeCount: updated?.likeCount || 0,
      neutralCount: updated?.neutralCount || 0,
      dislikeCount: updated?.dislikeCount || 0,
    })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Ошибка голосования' }, { status: 500 })
  }
}

// GET: check current vote status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scammerId = searchParams.get('scammerId')
    if (!scammerId) {
      return NextResponse.json({ error: 'Укажите scammerId' }, { status: 400 })
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
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
