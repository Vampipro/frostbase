import { db } from './db'

/**
 * Применяет все подходящие ExpRule-правила к действию юзера и начисляет EXP.
 *
 * Логика (после фикса race + транзакции):
 *  - Найти все правила с подходящим actionType и status (точное совпадение или 'all').
 *  - В одной интерактивной транзакции с SELECT ... FOR UPDATE на User (сериализация
 *    параллельных вызовов для одного юзера):
 *      • Для каждого правила проверить дубль по (ruleId, sourceId) — если есть, пропустить.
 *      • Посчитать actionCount (количество действий юзера этого типа с подходящим статусом).
 *      • Посчитать grantsCount (уже выданные гранты для этого правила + юзера).
 *      • expectedGrants = floor(actionCount / threshold).
 *      • Если actionCount >= threshold И grantsCount < expectedGrants —
 *        создать ExpGrant с текущим sourceId и атомарно increment User.exp.
 *
 * Это закрывает два бага:
 *  1. Race: два параллельных действия (10-е и 11-е) при threshold=10 оба видели count=10
 *     и оба начисляли с разными sourceId. Теперь FOR UPDATE сериализует, а проверка
 *     grantsCount < expectedGrants гарантирует не больше грантов, чем floor(count/threshold).
 *  2. Нетранзакционность: expGrant.create + user.update были раздельными операциями.
 *     При падении update грант оставался, EXP терялся. Теперь обе в одной транзакции.
 *
 * @returns суммарное количество начисленного EXP (0 если ничего не начислено)
 */
export async function grantExpForAction(
  userId: string | null | undefined,
  actionType: 'submission' | 'comment' | 'search' | 'vote',
  status: 'approved' | 'rejected' | 'all' | 'like' | 'dislike',
  sourceId: string
): Promise<number> {
  if (!userId) return 0

  try {
    // Подходящие правила: точное совпадение по status ИЛИ rule.status === 'all'.
    // Для search-действий имеет смысл только status='all'.
    // Для vote-действий status может быть 'like'/'dislike'/'all'.
    const statusFilter =
      actionType === 'search'
        ? { status: 'all' }
        : { OR: [{ status }, { status: 'all' }] }

    const rules = await db.expRule.findMany({
      where: { actionType, ...statusFilter },
    })

    if (rules.length === 0) return 0

    let totalGranted = 0

    await db.$transaction(async (tx) => {
      // Блокируем строку юзера — сериализуем параллельные вызовы grantExpForAction
      // для одного юзера. Без этого два одновременных действия могли оба пройти
      // проверку и создать дублирующие гранты.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`

      for (const rule of rules) {
        // Проверка дубля по (ruleId, sourceId) — уникальный индекс гарантирует
        // отсутствие двойного начисления за одно и то же действие.
        const existing = await tx.expGrant.findUnique({
          where: { ruleId_sourceId: { ruleId: rule.id, sourceId } },
        }).catch(() => null)
        if (existing) continue

        // Считаем количество действий юзера этого типа с подходящим статусом.
        let actionCount = 0

        if (actionType === 'submission') {
          const where: { userId: string; status?: string } = { userId }
          if (rule.status === 'approved') where.status = 'approved'
          else if (rule.status === 'rejected') where.status = 'rejected'
          actionCount = await tx.submission.count({ where })
        } else if (actionType === 'comment') {
          const where: { userId: string; approved?: boolean; hidden?: boolean } = { userId }
          if (rule.status === 'approved') {
            where.approved = true
            where.hidden = false
          } else if (rule.status === 'rejected') {
            where.approved = false
          }
          actionCount = await tx.comment.count({ where })
        } else if (actionType === 'search') {
          actionCount = await tx.searchLog.count({ where: { userId } })
        } else if (actionType === 'vote') {
          // Голоса хранятся в Vote.voterId в формате "user:{userId}" или "ip:{ip}".
          // Для EXP считаем только голоса залогиненного юзера.
          // status='like' → только лайки, 'dislike' → только дизлайки, 'all' → любые.
          const voterId = `user:${userId}`
          const where: { voterId: string; voteType?: string } = { voterId }
          if (rule.status === 'like') where.voteType = 'like'
          else if (rule.status === 'dislike') where.voteType = 'dislike'
          actionCount = await tx.vote.count({ where })
        }

        if (actionCount < rule.threshold) continue

        // Считаем уже выданные гранты для этого правила и юзера.
        // Это закрывает race: даже если actionCount кратен threshold,
        // мы не начислим больше грантов, чем floor(actionCount / threshold).
        const grantsCount = await tx.expGrant.count({
          where: { ruleId: rule.id, userId },
        })

        const expectedGrants = Math.floor(actionCount / rule.threshold)
        if (grantsCount >= expectedGrants) continue

        // Создаём грант и increment EXP атомарно в одной транзакции.
        // Если expGrant.create упадёт по unique (конкурент успел) — catch пропустит.
        try {
          await tx.expGrant.create({
            data: {
              userId,
              ruleId: rule.id,
              sourceId,
              actionType,
              expReward: rule.expReward,
            },
          })
        } catch {
          // Уже начислено другим параллельным запросом — пропускаем
          continue
        }

        await tx.user.update({
          where: { id: userId },
          data: { exp: { increment: rule.expReward } },
        })
        totalGranted += rule.expReward
      }
    })

    return totalGranted
  } catch (error) {
    console.error('grantExpForAction error:', error)
    return 0
  }
}
