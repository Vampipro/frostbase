/**
 * Расчёт уровня по EXP.
 *
 * Прогрессия (геометрическая после 2-го уровня):
 *   Level 1: 0–99       (нужно до 100)
 *   Level 2: 100–199    (нужно до 200)
 *   Level 3: 200–399    (нужно до 400)
 *   Level 4: 400–799    (нужно до 800)
 *   Level 5: 800–1599   (нужно до 1600)
 *   ...
 *   Порог уровня N (N ≥ 2) = 100 * 2^(N-2)
 *
 * Т.е. каждый следующий уровень требует в 2 раза больше EXP, чем предыдущий
 * (кроме перехода 1→2, где ширина та же — 100).
 */
export interface LevelInfo {
  level: number
  /** EXP, накопленный внутри текущего уровня */
  current: number
  /** Сколько EXP нужно пройти в текущем уровне до следующего */
  needed: number
  /** Доля прогресса 0..1 (current / needed) */
  progress: number
  /** Суммарный EXP, необходимый для начала текущего уровня */
  currentLevelThreshold: number
  /** Суммарный EXP, необходимый для перехода на следующий уровень */
  nextLevelThreshold: number
}

const FIRST_LEVEL_CAP = 100 // ширина 1-го уровня

export function calcLevel(exp: number): LevelInfo {
  const safeExp = Math.max(0, Math.floor(exp || 0))

  // Level 1 — особый случай
  if (safeExp < FIRST_LEVEL_CAP) {
    return {
      level: 1,
      current: safeExp,
      needed: FIRST_LEVEL_CAP,
      progress: safeExp / FIRST_LEVEL_CAP,
      currentLevelThreshold: 0,
      nextLevelThreshold: FIRST_LEVEL_CAP,
    }
  }

  // Для exp >= 100: уровень N (N≥2) начинается с 100 * 2^(N-2).
  // Решаем 100 * 2^(N-2) <= exp → N <= 2 + log2(exp/100)
  // floor(...) даёт текущий уровень.
  const level = Math.floor(2 + Math.log2(safeExp / FIRST_LEVEL_CAP))
  const currentLevelThreshold = FIRST_LEVEL_CAP * Math.pow(2, level - 2)
  const nextLevelThreshold = FIRST_LEVEL_CAP * Math.pow(2, level - 1)
  const current = safeExp - currentLevelThreshold
  const needed = nextLevelThreshold - currentLevelThreshold

  return {
    level,
    current,
    needed,
    progress: Math.min(1, current / needed),
    currentLevelThreshold,
    nextLevelThreshold,
  }
}

/** Человекочитаемая подпись уровня для UI: "Уровень 3" */
export function levelLabel(level: number): string {
  return `Уровень ${level}`
}
