'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchIcon, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { toast } from 'sonner'

interface SearchViewProps {
  allTags: Array<{ key: string; text: string; color: string; count: number }>
  onTagsLoad?: () => void
}

interface ScammerResult {
  id: string
  name: string
  status?: string
  statusLabel?: string
  statusColor?: string
  statusTextColor?: string
  likeCount?: number
  dislikeCount?: number
}

// ==================== SEARCH VIEW ====================
export function SearchView({ allTags, onTagsLoad }: SearchViewProps) {
  const [searched, setSearched] = useState(false)
  const [query, setQuery] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ScammerResult[]>([])
  const [sixSevenMode, setSixSevenMode] = useState(false)

  // Tag search state
  const [selectedTags, setSelectedTags] = useState<Array<{ key: string; text: string; color: string }>>([])
  const [tagSearchResults, setTagSearchResults] = useState<ScammerResult[] | null>(null)
  const [tagSearchTotal, setTagSearchTotal] = useState(0)
  const [tagSearchTotalPages, setTagSearchTotalPages] = useState(0)
  const [tagSearchPage, setTagSearchPage] = useState(1)
  const tagScrollRef = useRef<HTMLDivElement>(null)

  // Запрос к API с массивом выбранных тегов
  const fetchTagResults = useCallback(async (tags: Array<{ key: string }>, page = 1) => {
    if (tags.length === 0) {
      setTagSearchResults(null)
      setTagSearchTotal(0)
      setTagSearchTotalPages(0)
      setTagSearchPage(1)
      return
    }
    setTagSearchPage(page)
    try {
      const tagsParam = tags.map(t => t.key).join(',')
      const res = await fetch(`/api/scammers/by-tag?tags=${encodeURIComponent(tagsParam)}&page=${page}&limit=20`)
      const data = await res.json()
      setTagSearchResults(data.results || [])
      setTagSearchTotal(data.total || 0)
      setTagSearchTotalPages(data.totalPages || 0)
    } catch {
      toast.error('Ошибка поиска по статусам')
    }
  }, [])

  // Toggle тега в наборе: клик по невыбранному — добавляет, клик по выбранному — убирает.
  // Если после убирания набор пуст — сбрасываем результаты.
  const handleTagToggle = useCallback((tag: { key: string; text: string; color: string }) => {
    setSelectedTags(prev => {
      const exists = prev.find(t => t.key === tag.key)
      let next: Array<{ key: string; text: string; color: string }>
      if (exists) {
        next = prev.filter(t => t.key !== tag.key)
      } else {
        next = [...prev, tag]
      }
      fetchTagResults(next, 1)
      return next
    })
  }, [fetchTagResults])

  const selectAllTags = useCallback(() => {
    const all = allTags.map(t => ({ key: t.key, text: t.text, color: t.color }))
    setSelectedTags(all)
    fetchTagResults(all, 1)
  }, [allTags, fetchTagResults])

  const clearTagSearch = useCallback(() => {
    setSelectedTags([])
    setTagSearchResults(null)
    setTagSearchTotal(0)
    setTagSearchTotalPages(0)
    setTagSearchPage(1)
  }, [])

  // Прокрутка карусели тегов стрелками (для десктопа)
  const scrollTags = useCallback((dir: 'left' | 'right') => {
    const el = tagScrollRef.current
    if (!el) return
    const amount = 200
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !telegramId.trim()) return

    // Easter egg: 67 in both fields
    if (String(query).trim() === '67' && String(telegramId).trim() === '67') {
      console.log('Easter egg activated!')
      setSearched(true)
      setResults([])
      setSixSevenMode(true)
      setTimeout(() => {
        setSixSevenMode(false)
      }, 3000)
      return
    }

    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (telegramId.trim()) params.set('telegramId', telegramId.trim())

      const res = await fetch(`/api/scammers/search?${params}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      toast.error('Ошибка поиска')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, telegramId])

  // Smart pagination render
  const renderSmartPagination = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5
    
    let startPage = Math.max(1, tagSearchPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(tagSearchTotalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    // Перша сторінка
    if (startPage > 1) {
      pages.push(1)
    }

    // Многоточие
    if (startPage > 2) {
      pages.push('...')
    }

    // Сторінки в межах
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // Многоточие
    if (endPage < tagSearchTotalPages - 1) {
      pages.push('...')
    }

    // Остання сторінка
    if (endPage < tagSearchTotalPages) {
      pages.push(tagSearchTotalPages)
    }

    return pages.map((p, idx) =>
      p === '...' ? (
        <span key={`dots-${idx}`} className="px-1 text-muted-foreground/50">
          ...
        </span>
      ) : (
        <motion.button
          key={p}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => fetchTagResults(selectedTags, p as number)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all"
          style={p === tagSearchPage ? {
            backgroundColor: 'var(--primary)',
            color: '#fff',
            boxShadow: `0 2px 10px var(--primary)55`,
          } : {
            color: 'var(--muted-foreground)',
          }}
        >
          {p}
        </motion.button>
      )
    )
  }

  return (
    <div className="w-full">
      {/* Search form */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary">
            <SearchIcon className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Имя или юзернейм..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              className="border-0 bg-transparent placeholder:text-muted-foreground text-sm"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary">
            <span className="text-xs text-muted-foreground">TG ID:</span>
            <Input
              placeholder="123456..."
              type="number"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              className="border-0 bg-transparent placeholder:text-muted-foreground text-sm w-24"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-xl"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Поиск'}
          </Button>
        </div>

        {/* Tag search section */}
        {allTags.length > 0 && (
          <div className="mt-5 px-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
                <p className="text-[13px] font-semibold text-foreground/80 tracking-wide">Поиск по статусам</p>
                {selectedTags.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    {selectedTags.length} выбрано
                  </span>
                )}
              </div>
              {allTags.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {selectedTags.length > 0 && (
                    <button
                      onClick={clearTagSearch}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Сбросить
                    </button>
                  )}
                  <button
                    onClick={selectAllTags}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {selectedTags.length === allTags.length ? 'Снять все' : 'Все'}
                  </button>
                </div>
              )}
            </div>
            {allTags.length > 0 ? (
              <div className="relative">
                {/* Левая стрелка — только десктоп */}
                <button
                  onClick={() => scrollTags('left')}
                  className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full glass items-center justify-center hover:bg-white/10 transition-colors shrink-0"
                  aria-label="Прокрутить влево"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div
                  ref={tagScrollRef}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-none sm:px-9 snap-x snap-mandatory scroll-smooth"
                  onWheel={(e) => {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                      e.currentTarget.scrollLeft += e.deltaY
                      e.preventDefault()
                    }
                  }}
                >
                  {allTags.map((tag, idx) => {
                    const isSelected = selectedTags.some(t => t.key === tag.key)
                    return (
                      <motion.button
                        key={tag.key}
                        onClick={() => handleTagToggle({ key: tag.key, text: tag.text, color: tag.color })}
                        initial={{ opacity: 0, y: 12, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative shrink-0 snap-start"
                      >
                        <div
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all duration-200 cursor-pointer"
                          style={{
                            backgroundColor: isSelected ? tag.color + '40' : tag.color + '15',
                            color: tag.textColor || 'white',
                            border: isSelected ? `1.5px solid ${tag.color}` : `1px solid ${tag.color}44`,
                            boxShadow: isSelected
                              ? `0 0 12px ${tag.color}55, inset 0 0 6px ${tag.color}22`
                              : `0 2px 6px ${tag.color}15`,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full transition-transform"
                            style={{
                              backgroundColor: tag.color,
                              boxShadow: isSelected ? `0 0 6px ${tag.textColor}` : `0 0 6px ${tag.color}`
                            }}
                          />
                          <span>{tag.text}</span>
                          <span
                            className="ml-0.5 text-[10px] font-bold px-1.5 py-0 rounded-lg"
                            style={{
                              backgroundColor: isSelected ? tag.textColor + '25' : tag.color + '20',
                              color: tag.textColor,
                            }}
                          >
                            {tag.count}
                          </span>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
                {/* Правая стрелка — только десктоп */}
                <button
                  onClick={() => scrollTags('right')}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full glass items-center justify-center hover:bg-white/10 transition-colors shrink-0"
                  aria-label="Прокрутить вправо"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Fade edges (не перекрываем стрелки на десктопе) */}
                <div className="sm:hidden absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="sm:hidden absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50">Нет статусов</p>
            )}
          </div>
        )}
      </div>

      {/* Tag search results */}
      {tagSearchResults && (
        <motion.div
          key={selectedTags.map(t => t.key).join(',')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-5 space-y-3"
        >
          {/* Header with selected tags pills + close */}
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedTags.map(tag => (
                <motion.div
                  key={tag.key}
                  layoutId={`resultPill-${tag.key}`}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: tag.color + '22',
                    color: tag.color,
                    border: `1px solid ${tag.color}44`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color, boxShadow: `0 0 6px ${tag.color}` }} />
                  {tag.text}
                </motion.div>
              ))}
            </div>
            <button
              onClick={clearTagSearch}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors group"
            >
              <X className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
              Сбросить
            </button>
          </div>

          {/* Results list */}
          <div className="space-y-2">
            {tagSearchResults.map((scammer, i) => (
              <motion.div
                key={scammer.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
              >
                <Link href={`/?q=${encodeURIComponent(scammer.name)}`}>
                  <div className="glass rounded-xl p-3 hover:border-blue-400/50 transition-colors cursor-pointer group border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-blue-400 transition-colors">{scammer.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {scammer.statusLabel && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{
                              backgroundColor: scammer.statusColor + '30',
                              color: scammer.statusTextColor,
                            }}
                          >
                            {scammer.statusLabel}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Tag pagination with smart render */}
          {tagSearchTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                disabled={tagSearchPage <= 1}
                onClick={() => fetchTagResults(selectedTags, tagSearchPage - 1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.button>
              <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[280px]">
                {renderSmartPagination()}
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                disabled={tagSearchPage >= tagSearchTotalPages}
                onClick={() => fetchTagResults(selectedTags, tagSearchPage + 1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </motion.div>
      )}

      {/* Regular search results */}
      <AnimatePresence>
        {searched && !sixSevenMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-2"
          >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : results.length > 0 ? (
              results.map((scammer, i) => (
                <motion.div
                  key={scammer.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/?q=${encodeURIComponent(scammer.name)}`}>
                    <div className="glass rounded-xl p-3 hover:border-blue-400/50 transition-colors cursor-pointer group border border-border">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm group-hover:text-blue-400 transition-colors">{scammer.name}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Ничего не найдено</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 67 mode easter egg */}
      {sixSevenMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="mt-10 text-center"
        >
          <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Найдено 67 результатов
          </p>
          <p className="text-sm text-muted-foreground mt-2">Easter egg!</p>
        </motion.div>
      )}
    </div>
  )
}
