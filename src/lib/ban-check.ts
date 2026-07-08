import { db } from './db'

/**
 * Нормализует IP из заголовков запроса.
 * Берёт первый IP из x-forwarded-for, иначе x-real-ip, иначе 'unknown'.
 */
export function getClientIp(req: Request | { headers: Headers }): string {
  const headers = req instanceof Request ? req.headers : req.headers
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

/**
 * Проверяет, забанен ли IP в таблице BannedIp.
 * Используется в /api/submit, /api/comments, /api/vote, /api/appeals,
 * чтобы не пускать заблокированных по IP гостей.
 *
 * Кэшируем результат в Map на 30 секунд, чтобы не дёргать БД на каждый запрос
 * от одного IP (особенно при спаме). Serverless cold start сбрасывает кэш — OK.
 */
const banCache = new Map<string, { banned: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 30_000

export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false

  const now = Date.now()
  const cached = banCache.get(ip)
  if (cached && cached.expiresAt > now) {
    return cached.banned
  }

  try {
    const record = await db.bannedIp.findUnique({
      where: { ip },
      select: { id: true },
    })
    const banned = !!record
    banCache.set(ip, { banned, expiresAt: now + CACHE_TTL_MS })
    // Лёгкая чистка кэша — не чаще раза на 1000 записей
    if (banCache.size > 1000) {
      for (const [k, v] of banCache) {
        if (v.expiresAt <= now) banCache.delete(k)
      }
    }
    return banned
  } catch (error) {
    console.error('isIpBanned error:', error)
    return false // fail-open — лучше пропустить, чем сломать сайт
  }
}
