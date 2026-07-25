'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { X, Loader2, ChevronLeft, ChevronRight, RotateCcw, Clock, Trash2, Edit3, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editOldName, setEditOldName] = useState('')
  const [editNewName, setEditNewName] = useState('')

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

  const handleDelete = async (historyId: string) => {
    if (!confirm('Удалить эту запись истории?')) return
    setDeleteId(historyId)
    try {
      const res = await fetch('/api/panel/scammer-name-history?id=' + historyId, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error)
        return
      }
      toast.success('Запись удалена')
      if (scammer) loadHistory(scammer.id, page)
    } catch {
      toast.error('Ошибка')
    } finally {
      setDeleteId(null)
    }
  }

  const handleEditStart = (entry: NameHistoryEntry) => {
    setEditingId(entry.id)
    setEditOldName(entry.oldName)
    setEditNewName(entry.newName)
  }

  const handleEditSave = async (historyId: string) => {
    if (!editOldName.trim() || !editNewName.trim()) {
      toast.error('Оба поля обязательны')
      return
    }
    try {
      const res = await fetch('/api/panel/scammer-name-history?id=' + historyId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: editOldName.trim(), newName: editNewName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error)
        return
      }
      toast.success('Запись обновлена')
      setEditingId(null)
      if (scammer) loadHistory(scammer.id, page)
    } catch {
      toast.error('Ошибка')
    }
  }

  const goPage = (newPage: number) => {
    setPage(newPage)
    if (scammer) loadHistory(scammer.id, newPage)
  }

  const renderPaginationButtons = () => {
    const buttons = []
    const maxButtons = 5
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2))
    let endPage = Math.min(totalPages, startPage + maxButtons - 1)
    
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1)
    }

    // Первая страница
    if (startPage > 1) {
      buttons.push(
        <button key={1} onClick={() => goPage(1)} className="px-2 py-1 rounded text-sm text-green-400 hover:bg-green-500/10">
          1
        </button>
      )
    }

    // Многоточие
    if (startPage > 2) {
      buttons.push(<span key="dots1" className="px-1 text-green-600">...</span>)
    }

    // Кнопки страниц
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => goPage(i)}
          className={`px-2 py-1 rounded text-sm font-mono ${
            i === page
              ? 'bg-green-500/30 text-green-300 border border-green-500/50'
              : 'text-green-400 hover:bg-green-500/10'
          }`}
        >
          {i}
        </button>
      )
    }

    // Многоточие
    if (endPage < totalPages - 1) {
      buttons.push(<span key="dots2" className="px-1 text-green-600">...</span>)
    }

    // Последняя страница
    if (endPage < totalPages) {
      buttons.push(
        <button key={totalPages} onClick={() => goPage(totalPages)} className="px-2 py-1 rounded text-sm text-green-400 hover:bg-green-500/10">
          {totalPages}
        </button>
      )
    }

    return buttons
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
                    const isLoading = rollbackId === entry.id || deleteId === entry.id
                    const isEditing = editingId === entry.id
                    
                    if (isEditing) {
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="glass rounded-xl p-3 border border-yellow-500/20 bg-yellow-500/5"
                        >
                          <div className="space-y-2 mb-2">
                            <div>
                              <label className="text-[10px] text-yellow-600 font-mono">Старое имя</label>
                              <Input
                                value={editOldName}
                                onChange={(e) => setEditOldName(e.target.value)}
                                className="h-8 text-xs rounded bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-yellow-600 font-mono">Новое имя</label>
                              <Input
                                value={editNewName}
                                onChange={(e) => setEditNewName(e.target.value)}
                                className="h-8 text-xs rounded bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditSave(entry.id)}
                              className="flex-1 h-7 text-xs bg-yellow-600 hover:bg-yellow-700 rounded"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              className="flex-1 h-7 text-xs border-yellow-500/20 text-yellow-400 rounded"
                            >
                              Отмена
                            </Button>
                          </div>
                        </motion.div>
                      )
                    }

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
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={function doEdit() {
                                handleEditStart(entry)
                              }}
                              disabled={isLoading}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg font-mono text-xs bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30 disabled:opacity-30 transition-all"
                              title="Редактировать"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={function doRollback() {
                                handleRollback(entry.id, entry.oldName)
                              }}
                              disabled={isLoading}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg font-mono text-xs bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30 disabled:opacity-30 transition-all"
                              title={'Откатить на \u00AB' + entry.oldName + '\u00BB'}
                            >
                              {rollbackId === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={function doDelete() {
                                handleDelete(entry.id)
                              }}
                              disabled={isLoading}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg font-mono text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-30 transition-all"
                              title="Удалить запись"
                            >
                              {deleteId === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
                    <button
                      onClick={function prevPage() { goPage(Math.max(1, page - 1)) }}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {renderPaginationButtons()}
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
