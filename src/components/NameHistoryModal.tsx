'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { X, Loader2, ChevronLeft, ChevronRight, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NameHistoryEntry {
  id: string
  oldName: string
  newName: string
  createdAt: string
}

interface Props {
  scammer: { id: string; name: string } | null
  onClose: () => void
  onRollback: () => void
}

export default function NameHistoryModal({ scammer, onClose, onRollback }: Props) {
  const [history, setHistory] = useState<NameHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [rollbackId, setRollbackId] = useState<string | null>(null)

  const loadHistory = useCallback(async (scammerId: string, p: number) => {
    setLoading(true)
    try {
      const res = await fetch(
        '/api/panel/scammer-name-history?scammerId=' + scammerId + '&page=' + p + '&limit=15'
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

  const handleRollback = async (historyId: string, oldName: string) => {
    if (!confirm('Откатить имя на \u00AB' + oldName + '\u00BB?')) return
    setRollbackId(historyId)
    try {
      const res = await fetch('/api/panel/scammer-name-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: historyId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error)
        return
      }
      toast.success(data.message)
      if (scammer) loadHistory(scammer.id, page)
      onRollback()
    } catch {
      toast.error('Ошибка')
    } finally {
      setRollbackId(null)
    }
  }

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg glass rounded-2xl p-6 border border-blue-500/20 max-h-[85dvh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-blue-300">История имён</h3>
                  <p className="text-xs font-mono text-green-600">{scammer.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
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
                <p className="font-mono text-green-600 text-sm">Имя никогда не менялось</p>
                <p className="font-mono text-green-700 text-xs mt-1">
                  Изменения имени будут отображаться здесь
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-mono text-green-600 mb-3">
                  Всего изменений: {String(total)}
                </p>
                <div className="space-y-2">
                  {history.map(function renderEntry(entry: NameHistoryEntry, i: number) {
                    const isLoading = rollbackId === entry.id
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="glass rounded-xl p-3 border border-green-500/10 group hover:border-blue-500/20 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-mono text-red-400 font-bold truncate max-w-[60px]">
                                {entry.oldName.length > 6
                                  ? entry.oldName.slice(0, 6) + '..'
                                  : entry.oldName}
                              </span>
                            </div>
                            <span className="text-green-600 shrink-0">{'\u2192'}</span>
                            <div className="w-7 h-7 rounded-md bg-green-500/15 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-mono text-green-400 font-bold truncate max-w-[60px]">
                                {entry.newName.length > 6
                                  ? entry.newName.slice(0, 6) + '..'
                                  : entry.newName}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 ml-1">
                              <p className="text-xs font-mono text-green-200 truncate">
                                <span className="text-red-400">{entry.oldName}</span>
                                <span className="text-green-600 mx-1.5">{'\u2192'}</span>
                                <span className="text-green-300">{entry.newName}</span>
                              </p>
                              <p className="text-[10px] font-mono text-green-700 mt-0.5">
                                {new Date(entry.createdAt).toLocaleString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={function doRollback() {
                              handleRollback(entry.id, entry.oldName)
                            }}
                            disabled={isLoading}
                            className="opacity-0 group-hover:opacity-100 shrink-0 px-3 py-1.5 rounded-lg font-mono text-xs bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/20 transition-all disabled:opacity-40 flex items-center gap-1.5"
                            title={'Откатить на \u00AB' + entry.oldName + '\u00BB'}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">Откат</span>
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={function prevPage() { goPage(Math.max(1, page - 1)) }}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-xs text-green-500 px-2">
                      {String(page)} / {String(totalPages)}
                    </span>
                    <button
                      onClick={function nextPage() { goPage(Math.min(totalPages, page + 1)) }}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
