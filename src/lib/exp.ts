import { db } from './db'

/**
 * Применяет все подходящие ExpRule-правила к действию юзера и начисляет EXP.
 *
 * Логика:
 *  - Найти все правила с подходящим actionType и status (точное совпадение или 'all').
 *  - Для каждого правила проверить, не выдавался ли уже EXP для этого (ruleId, sourceId).
 *    Уникальный индекс [ruleId, sourceId] в ExpGrant гарантирует отсутствие дублей.
 *  - Посчитать количество действий юзера этого типа с подходящим статусом.
 *  - Если count >= threshold и count % threshold === 0 — начислить expReward атомарно (increment).
 *
 * @returns суммарное количество начисленного EXP (0 если ничего не начислено)
 */
export async function grantExpForAction(
  userId: string | null | undefined,
  actionType: 'submission' | 'comment' | 'search',
  status: 'approved' | 'rejected' | 'all',
  sourceId: string
): Promise<number> {
  if (!userId) return 0

  try {
    // Подходящие правила: точное совпадение по status ИЛИ rule.status === 'all'.
    // Для search-действий имеет смысл только status='all', но фильтруем безопасно.
    const statusFilter =
      actionType === 'search'
        ? { status: 'all' }
        : { OR: [{ status }, { status: 'all' }] }

    const rules = await db.expRule.findMany({
      where: { actionType, ...statusFilter },
    })

    if (rules.length === 0) return 0

    let totalGranted = 0

    for (const rule of rules) {
      // Проверка: не выдавался ли уже EXP для этого правила + действия
      const existing = await db.expGrant.findUnique({
        where: { ruleId_sourceId: { ruleId: rule.id, sourceId } },
      }).catch(() => null)
      if (existing) continue

      // Считаем количество действий юзера этого типа с подходящим статусом.
      // Для rule.status === 'all' считаем все действия; иначе — только с конкретным статусом.
      let actionCount = 0

      if (actionType === 'submission') {
        const where: { userId: string; status?: string } = { userId }
        if (rule.status === 'approved') where.status = 'approved'
        else if (rule.status === 'rejected') where.status = 'rejected'
        actionCount = await db.submission.count({ where })
      } else if (actionType === 'comment') {
        // Для комментария "approved" = approved:true, "rejected" = approved:false,
        // "all" = любые (включая pending)
        const where: { userId: string; approved?: boolean; hidden?: boolean } = { userId }
        if (rule.status === 'approved') {
          where.approved = true
          where.hidden = false
        } else if (rule.status === 'rejected') {
          where.approved = false
        }
        actionCount = await db.comment.count({ where })
      } else if (actionType === 'search') {
        actionCount = await db.searchLog.count({ where: { userId } })
      }

      // Начисляем, когда количество действий кратно threshold и >= threshold.
      // Это даёт EXP на N-м, 2N-м, 3N-м действии и т.д.
      if (actionCount >= rule.threshold && actionCount % rule.threshold === 0) {
        // ExpGrant.create с уникальным индексом — если конкурент успел раньше,
        // упадёт по уникальности; ловим и пропускаем.
        try {
          await db.expGrant.create({
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

        // Атомарное увеличение EXP
        await db.user.update({
          where: { id: userId },
          data: { exp: { increment: rule.expReward } },
        })
        totalGranted += rule.expReward
      }
    }

    return totalGranted
  } catch (error) {
    console.error('grantExpForAction error:', error)
    return 0
  }
}
