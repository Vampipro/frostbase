'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { X, Loader2, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

interface NameHistoryEntry {
  id: string
  oldName: string
  newName: string
  createdAt: string
}

interface Props {
  scammer: { id: string; name: string } | null
  onClose: () => void
}

export default function UserNameHistoryModal({ scammer, onClose }: Props) {
  const [history, setHistory] = useState<NameHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadHistory = useCallback(async (scammerId: string, p: number) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/scammers/${scammerId}/name-history?page=${p}&limit=15`
      )
      const data = await res.json()
      if (data.results) setHistory(data.results)
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch {
      toast.error('Ошибка загрузки истории')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!scammer) return
    setPage(1)
    setHistory([])
    loadHistory(scammer.id, 1)
  }, [scammer, loadHistory])

  const goPage = (newPage: number) => {
    setPage(newPage)
    if (scammer) loadHistory(scammer.id, newPage)
  }

  return (
    <AnimatePresence>
      {scammer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.25 }}
            style={{ backgroundColor: 'var(--overlay)' }}
          />
          <motion.div
            initial={{ y: 120, opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{
              y: 80,
              opacity: 0,
              scale: 0.92,
              filter: 'blur(6px)',
              transition: { duration: 0.3, ease: [0.36, 0, 0.66, -0.56] }
            }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md mx-0 sm:mx-4 mb-20 sm:mb-0"
          >
            <div className="glass-strong rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">История имён</h3>
                    <p className="text-xs text-muted-foreground">{scammer.name}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">Имя никогда не менялось</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Всего изменений: {total}
                  </p>
                  <div className="space-y-2">
                    {history.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-xl p-3 border border-border bg-secondary/30"
                      >
                        <p className="text-sm">
                          <span className="text-red-400 line-through">{entry.oldName}</span>
                          <span className="mx-2 text-muted-foreground">&rarr;</span>
                          <span className="text-green-400">{entry.newName}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(entry.createdAt).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => goPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-muted-foreground px-2">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => goPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
