'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Пагинация с эллипсисом как в Google:
 *   ‹ 1 … 4 5 [6] 7 8 … 120 ›
 *
 * Логика:
 *  - Всегда показываем первую и последнюю страницу
 *  - Вокруг текущей страницы показываем до `siblings` страниц с каждой стороны
 *  - Если между первой страницей и левым краем окна есть разрыв > 1 — показываем …
 *  - Аналогично для правого края
 *
 * Props:
 *  - current: текущая страница (1-индексация)
 *  - total: всего страниц
 *  - onPageChange: колбэк при клике на страницу
 *  - siblings: сколько страниц показывать с каждой стороны от текущей (по умолчанию 1)
 *  - showLabels: показывать ли текст «Назад»/«Вперёд» (для админки), по умолчанию false
 */

type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

function buildPageItems(current: number, total: number, siblings: number): PageItem[] {
  if (total <= 7) {
    // Если страниц мало — показываем все без эллипсиса
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftSibling = Math.max(2, current - siblings)
  const rightSibling = Math.min(total - 1, current + siblings)

  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < total - 1

  const items: PageItem[] = [1]

  if (showLeftEllipsis) {
    items.push('ellipsis-left')
  }

  for (let p = leftSibling; p <= rightSibling; p++) {
    items.push(p)
  }

  if (showRightEllipsis) {
    items.push('ellipsis-right')
  }

  items.push(total)
  return items
}

interface PaginationProps {
  current: number
  total: number
  onPageChange: (page: number) => void
  siblings?: number
  showLabels?: boolean
  variant?: 'default' | 'terminal'
}

export function Pagination({
  current,
  total,
  onPageChange,
  siblings = 1,
  showLabels = false,
  variant = 'default',
}: PaginationProps) {
  if (total <= 1) return null

  const items = buildPageItems(current, total, siblings)
  const isTerminal = variant === 'terminal'

  const btnBase = isTerminal
    ? 'w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs transition-all border'
    : 'w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all'
  const btnActive = isTerminal
    ? 'bg-green-500/20 text-green-300 border-green-500/40'
    : 'bg-foreground/10 text-foreground border border-border'
  const btnInactive = isTerminal
    ? 'text-green-500 hover:bg-green-500/10 border-transparent'
    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
  const navBtnBase = isTerminal
    ? 'flex items-center gap-1 px-3 py-2 rounded-lg font-mono text-sm border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
    : 'w-8 h-8 rounded-xl flex items-center justify-center border border-border text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {/* Назад */}
      <button
        onClick={() => onPageChange(current - 1)}
        disabled={current <= 1}
        className={navBtnBase}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft className="w-4 h-4" />
        {showLabels && <span className="ml-1">Назад</span>}
      </button>

      {/* Страницы */}
      {items.map((item, idx) => {
        if (item === 'ellipsis-left' || item === 'ellipsis-right') {
          return (
            <span
              key={`${item}-${idx}`}
              className={`w-8 h-8 flex items-center justify-center ${isTerminal ? 'text-green-600 font-mono text-xs' : 'text-muted-foreground text-xs'}`}
            >
              …
            </span>
          )
        }
        const page = item as number
        const isActive = page === current
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`${btnBase} ${isActive ? btnActive : btnInactive}`}
          >
            {page}
          </button>
        )
      })}

      {/* Вперёд */}
      <button
        onClick={() => onPageChange(current + 1)}
        disabled={current >= total}
        className={navBtnBase}
        aria-label="Следующая страница"
      >
        {showLabels && <span className="mr-1">Вперёд</span>}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
