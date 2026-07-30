'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

function buildPageItems(current: number, total: number, siblings: number): PageItem[] {
  // Якщо сторінок мало — показуємо всі підряд
  if (total <= 5 + siblings * 2) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftSibling = Math.max(current - siblings, 1)
  const rightSibling = Math.min(current + siblings, total)

  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < total - 1

  const items: PageItem[] = []

  if (!showLeftEllipsis && showRightEllipsis) {
    // Лівий край без трикрапки
    const leftRange = 3 + siblings * 2
    for (let p = 1; p <= leftRange; p++) items.push(p)
    items.push('ellipsis-right')
    items.push(total)
  } else if (showLeftEllipsis && !showRightEllipsis) {
    // Правий край без трикрапки
    items.push(1)
    items.push('ellipsis-left')
    const rightRange = total - (2 + siblings * 2)
    for (let p = rightRange; p <= total; p++) items.push(p)
  } else {
    // Трикрапка з двох боків
    items.push(1)
    items.push('ellipsis-left')
    for (let p = leftSibling; p <= rightSibling; p++) items.push(p)
    items.push('ellipsis-right')
    items.push(total)
  }

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
    ? 'w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs transition-all border shrink-0'
    : 'w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all shrink-0'
  const btnActive = isTerminal
    ? 'bg-green-500/20 text-green-300 border-green-500/40'
    : 'bg-foreground/10 text-foreground border border-border'
  const btnInactive = isTerminal
    ? 'text-green-500 hover:bg-green-500/10 border-transparent'
    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
  const navBtnBase = isTerminal
    ? 'flex items-center gap-1 px-3 py-2 rounded-lg font-mono text-sm border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0'
    : 'w-8 h-8 rounded-xl flex items-center justify-center border border-border text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0'

  return (
    <div className="flex items-center justify-center gap-1.5 flex-nowrap overflow-x-auto py-1">
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
              className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                isTerminal ? 'text-green-600 font-mono text-xs' : 'text-muted-foreground text-xs'
              }`}
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
