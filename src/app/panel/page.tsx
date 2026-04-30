'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Shield, Search, Users, FileText, TrendingUp, AlertTriangle,
  Plus, Trash2, Edit3, CheckCircle, XCircle, RotateCcw,
  Loader2, Eye, EyeOff, X, ChevronDown, ArrowLeft, ChevronLeft, ChevronRight,
  Terminal, Database, Activity, Settings, LogOut, RefreshCw, Tag, MessageSquare,
  Gamepad2, Play, Pause,
  Download, Clock, Scale, Menu, Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { signOut } from 'next-auth/react'
import NameHistoryModal from '@/components/NameHistoryModal'

interface Scammer {
  id: string
  name: string
  description: string
  status: string
  statusLabel: string
  statusColor: string
  statusTextColor: string
  searchCount: number
  screenshots: string[]
  createdBy: string | null
  createdAt: string
  scammerType: string
  scamDate: string
  proofLink: string
  telegramUserId: string
  submissionCount: number
}

interface Submission {
  id: string
  scammerName: string
  scammerData: string
  telegramUserId: string
  screenshots: string[]
  status: string
  statusLabel: string
  scammerStatus: string
  scammerStatusLabel: string
  scammerStatusColor: string
  scammerStatusTextColor: string
  revisionReason: string
  user: { id: string; username: string }
  createdAt: string
}

interface Stats {
  totalScammers: number
  totalSubmissions: number
  pendingSubmissions: number
  totalUsers: number
  totalSearches: number
  scamCount: number
  verifiedCount: number
  searchesToday: number
  likesToday: number
  scammersAddedToday: number
  scammersUpdatedToday: number
  dbChangesToday: number
}

type PanelTab = 'dashboard' | 'scammers' | 'users' | 'submissions' | 'comments' | 'complaints' | 'appeals' | 'stats' | 'add' | 'statuses' | 'export'

// ==================== PING PONG GAME ====================
function PingPongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState({ player: 0, bot: 0 })
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const gameStateRef = useRef<'idle' | 'playing' | 'paused'>('idle')
  const animFrameRef = useRef<number>(0)
  const gameRef = useRef({
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: 6 },
    player: { x: 0, y: 0, w: 10, h: 60 },
    bot: { x: 0, y: 0, w: 10, h: 60 },
    score: { player: 0, bot: 0 },
    W: 0, H: 0,
    touchY: null as number | null,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    trail: [] as { x: number; y: number; alpha: number }[],
  })

  const resetBall = useCallback((dir: number) => {
    const g = gameRef.current
    g.ball.x = g.W / 2
    g.ball.y = g.H / 2
    const speed = Math.min(3.5 + g.score.player + g.score.bot * 0.2, 7)
    const angle = Math.random() * 0.8 - 0.4
    g.ball.vx = speed * dir * Math.cos(angle)
    g.ball.vy = speed * Math.sin(angle)
  }, [])

  const initGame = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const W = rect.width
    const H = Math.min(400, Math.max(280, rect.width * 0.55))
    canvas.width = W * 2
    canvas.height = H * 2
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(2, 2)
    const g = gameRef.current
    g.W = W; g.H = H
    g.player.x = 12; g.player.y = H / 2 - 30
    g.bot.x = W - 22; g.bot.y = H / 2 - 30
    g.score = { player: 0, bot: 0 }
    g.particles = []; g.trail = []
    resetBall(Math.random() < 0.5 ? 1 : -1)
  }, [resetBall])

  const startGame = useCallback(() => {
    initGame()
    gameStateRef.current = 'playing'
    setGameState('playing')
    setScore({ player: 0, bot: 0 })
  }, [initGame])

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      gameStateRef.current = 'paused'
      setGameState('paused')
    } else if (gameStateRef.current === 'paused') {
      gameStateRef.current = 'playing'
      setGameState('playing')
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = () => {
      const g = gameRef.current
      if (gameStateRef.current === 'playing') {
        const W = g.W; const H = g.H
        const ball = g.ball; const player = g.player; const bot = g.bot

        ball.x += ball.vx; ball.y += ball.vy

        g.trail.push({ x: ball.x, y: ball.y, alpha: 1 })
        if (g.trail.length > 12) g.trail.shift()
        g.trail.forEach(t => t.alpha *= 0.85)

        if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) }
        if (ball.y + ball.r >= H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy) }

        if (ball.x - ball.r <= player.x + player.w && ball.x + ball.r >= player.x && ball.y >= player.y && ball.y <= player.y + player.h && ball.vx < 0) {
          ball.vx = Math.abs(ball.vx) * 1.03
          const hit = (ball.y - (player.y + player.h / 2)) / (player.h / 2)
          ball.vy = hit * 4
          ball.x = player.x + player.w + ball.r
          for (let i = 0; i < 6; i++) g.particles.push({ x: ball.x, y: ball.y, vx: Math.random() * 3, vy: (Math.random() - 0.5) * 4, life: 1, color: '#4ade80' })
        }

        if (ball.x + ball.r >= bot.x && ball.x - ball.r <= bot.x + bot.w && ball.y >= bot.y && ball.y <= bot.y + bot.h && ball.vx > 0) {
          ball.vx = -Math.abs(ball.vx) * 1.03
          const hit = (ball.y - (bot.y + bot.h / 2)) / (bot.h / 2)
          ball.vy = hit * 4
          ball.x = bot.x - ball.r
          for (let i = 0; i < 6; i++) g.particles.push({ x: ball.x, y: ball.y, vx: -Math.random() * 3, vy: (Math.random() - 0.5) * 4, life: 1, color: '#ef4444' })
        }

        // Bot AI - intentionally dumb, only reacts when ball is on its half
        const botCenter = bot.y + bot.h / 2
        const diff = ball.y - botCenter
        const botSpeed = 1.2 + Math.random() * 0.4
        if (ball.vx > 0 && Math.abs(diff) > 25) {
          bot.y += Math.sign(diff) * Math.min(Math.abs(diff), botSpeed)
        }
        // Add random jitter so bot misses sometimes
        if (Math.random() < 0.06) {
          bot.y += (Math.random() - 0.5) * 8
        }
        bot.y = Math.max(0, Math.min(H - bot.h, bot.y))

        if (g.touchY !== null) player.y = Math.max(0, Math.min(H - player.h, g.touchY - player.h / 2))

        if (ball.x < -10) {
          g.score.bot++; setScore({ ...g.score })
          for (let i = 0; i < 10; i++) g.particles.push({ x: 20, y: ball.y, vx: Math.random() * 5, vy: (Math.random() - 0.5) * 6, life: 1, color: '#ef4444' })
          if (g.score.bot >= 10) { gameStateRef.current = 'idle'; setGameState('idle'); return }
          resetBall(1)
        }
        if (ball.x > W + 10) {
          g.score.player++; setScore({ ...g.score })
          for (let i = 0; i < 10; i++) g.particles.push({ x: W - 20, y: ball.y, vx: -Math.random() * 5, vy: (Math.random() - 0.5) * 6, life: 1, color: '#4ade80' })
          if (g.score.player >= 10) { gameStateRef.current = 'idle'; setGameState('idle'); return }
          resetBall(-1)
        }

        g.particles = g.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.03; p.vy += 0.1; return p.life > 0 })
      }

      const W = g.W; const H = g.H
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(5, 10, 5, 0.95)'
      ctx.fillRect(0, 0, W, H)

      ctx.setLineDash([6, 8])
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.15)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      ctx.setLineDash([])

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2); ctx.stroke()

      g.trail.forEach((t) => {
        ctx.beginPath(); ctx.arc(t.x, t.y, g.ball.r * t.alpha * 0.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(74, 222, 128, ${t.alpha * 0.3})`; ctx.fill()
      })

      g.particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })

      const grad1 = ctx.createLinearGradient(g.player.x, 0, g.player.x + g.player.w, 0)
      grad1.addColorStop(0, '#22c55e'); grad1.addColorStop(1, '#4ade80')
      ctx.fillStyle = grad1
      ctx.beginPath(); ctx.roundRect(g.player.x, g.player.y, g.player.w, g.player.h, 5); ctx.fill()
      ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0

      const grad2 = ctx.createLinearGradient(g.bot.x, 0, g.bot.x + g.bot.w, 0)
      grad2.addColorStop(0, '#f87171'); grad2.addColorStop(1, '#ef4444')
      ctx.fillStyle = grad2
      ctx.beginPath(); ctx.roundRect(g.bot.x, g.bot.y, g.bot.w, g.bot.h, 5); ctx.fill()
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0

      const ballGrad = ctx.createRadialGradient(g.ball.x, g.ball.y, 0, g.ball.x, g.ball.y, g.ball.r * 2)
      ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.5, '#4ade80'); ballGrad.addColorStop(1, 'rgba(74, 222, 128, 0)')
      ctx.fillStyle = ballGrad
      ctx.beginPath(); ctx.arc(g.ball.x, g.ball.y, g.ball.r * 2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(g.ball.x, g.ball.y, g.ball.r, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = 'rgba(74, 222, 128, 0.4)'
      ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'
      ctx.fillText(String(g.score.player), W / 2 - 40, 55)
      ctx.fillStyle = 'rgba(248, 113, 113, 0.4)'
      ctx.fillText(String(g.score.bot), W / 2 + 40, 55)

      ctx.fillStyle = 'rgba(74, 222, 128, 0.3)'; ctx.font = '10px monospace'
      ctx.fillText('ВЫ', W / 2 - 40, 70)
      ctx.fillStyle = 'rgba(248, 113, 113, 0.3)'
      ctx.fillText('БОТ', W / 2 + 40, 70)

      const winner = g.score.player >= 10 ? 'ВЫ ПОБЕДИЛИ!' : g.score.bot >= 10 ? 'БОТ ПОБЕДИЛ' : null
      if (gameStateRef.current === 'idle' && winner) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = g.score.player >= 10 ? '#4ade80' : '#ef4444'
        ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'
        ctx.fillText(winner, W / 2, H / 2 - 10)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px monospace'
        ctx.fillText('Нажмите "Играть" для новой партии', W / 2, H / 2 + 20)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      gameRef.current.touchY = ((e.clientY - rect.top) / rect.height) * gameRef.current.H
    }
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0]
      gameRef.current.touchY = ((touch.clientY - rect.top) / rect.height) * gameRef.current.H
    }
    const handleLeave = () => { gameRef.current.touchY = null }
    const handleTouchEnd = () => { gameRef.current.touchY = null }

    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseleave', handleLeave)
    canvas.addEventListener('touchmove', handleTouch, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)

    return () => {
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseleave', handleLeave)
      canvas.removeEventListener('touchmove', handleTouch)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const winner = score.player >= 10 ? 'ВЫ ПОБЕДИЛИ!' : score.bot >= 10 ? 'БОТ ПОБЕДИЛ' : null

  return (
    <div className="glass rounded-2xl p-4 border border-green-500/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-green-400" />
          <span className="font-mono text-sm text-green-300">Пинг-Понг</span>
          <span className="text-[10px] font-mono text-green-600">vs Bot</span>
        </div>
        <div className="flex items-center gap-2">
          {gameState === 'playing' || gameState === 'paused' ? (
            <Button onClick={togglePause} variant="outline" size="sm" className="rounded-lg gap-1 border-green-500/20 text-green-400 hover:bg-green-500/10 font-mono text-xs">
              {gameState === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {gameState === 'paused' ? 'Играть' : 'Пауза'}
            </Button>
          ) : null}
          {(gameState === 'playing' || gameState === 'paused' || winner) && (
            <Button onClick={startGame} variant="outline" size="sm" className="rounded-lg gap-1 border-green-500/20 text-green-400 hover:bg-green-500/10 font-mono text-xs">
              <RotateCcw className="w-3 h-3" />
              Заново
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mb-3 font-mono text-sm">
        <div className="text-center">
          <p className="text-green-500 font-bold text-lg">{score.player}</p>
          <p className="text-[10px] text-green-600">ВЫ</p>
        </div>
        <span className="text-green-600/50">:</span>
        <div className="text-center">
          <p className="text-red-400 font-bold text-lg">{score.bot}</p>
          <p className="text-[10px] text-green-600">БОТ</p>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-green-500/10 touch-none cursor-none"
        />
        {gameState === 'idle' && !winner && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <Gamepad2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
              <p className="text-lg font-bold text-green-300 mb-1 font-mono">Пинг-Понг</p>
              <p className="text-xs text-green-600 mb-4">Мышка / палец для управления</p>
              <Button onClick={startGame} className="rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold px-6 border border-green-500/30 font-mono">
                <Play className="w-4 h-4 mr-2" />
                Играть
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-green-600/50 text-center mt-2 font-mono">До 10 очков • Управление: мышь / палец</p>
    </div>
  )
}

// ==================== EXPORT BUTTON ====================
function ExportButton({ type, format, label, ext }: { type: string; format: string; label: string; ext: string }) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/panel/export?type=${type}&format=${format}`)
      if (!res.ok) {
        toast.error('Ошибка экспорта')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scambase_${type}_${Date.now()}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${label} скачан`)
    } catch {
      toast.error('Ошибка скачивания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant="outline"
      size="sm"
      className="rounded-lg gap-1.5 border-green-500/20 text-green-400 hover:bg-green-500/10 font-mono text-xs"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      {label}
    </Button>
  )
}

export default function PanelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<PanelTab>('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [scammers, setScammers] = useState<Scammer[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdminChecked, setIsAdminChecked] = useState(false)

  // Pagination & search for scammers
  const [scammerPage, setScammerPage] = useState(1)
  const [scammerTotal, setScammerTotal] = useState(0)
  const [scammerTotalPages, setScammerTotalPages] = useState(1)
  const [scammerSearch, setScammerSearch] = useState('')
  const [scammerSearchInput, setScammerSearchInput] = useState('')

  // Add scammer form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newStatus, setNewStatus] = useState('scam')
  const [newScammerType, setNewScammerType] = useState('')
  const [newScamDate, setNewScamDate] = useState('')
  const [newScamAmount, setNewScamAmount] = useState('')
  const [newScamCurrency, setNewScamCurrency] = useState('')
  const [newProofLink, setNewProofLink] = useState('')
  const [newTelegramUserId, setNewTelegramUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit scammer
  const [editScammer, setEditScammer] = useState<Scammer | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editSearchCount, setEditSearchCount] = useState(0)
  const [editScammerType, setEditScammerType] = useState('')
  const [editScamDate, setEditScamDate] = useState('')
  const [editProofLink, setEditProofLink] = useState('')
  const [editTelegramUserId, setEditTelegramUserId] = useState('')

  // Name history modal
  const [nameHistoryScammer, setNameHistoryScammer] = useState<{ id: string; name: string } | null>(null)

  // Comments moderation
  const [comments, setComments] = useState<any[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Complaints
  const [complaints, setComplaints] = useState<any[]>([])
  const [complaintsLoading, setComplaintsLoading] = useState(false)

  // Appeals management
  const [appeals, setAppeals] = useState<any[]>([])
  const [appealsLoading, setAppealsLoading] = useState(false)
  const [appealsPage, setAppealsPage] = useState(1)
  const [appealsTotalPages, setAppealsTotalPages] = useState(1)
  const [appealsTotal, setAppealsTotal] = useState(0)
  const [appealsStatusFilter, setAppealsStatusFilter] = useState('all')

  // Users management
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersSearchInput, setUsersSearchInput] = useState('')
  const [usersRoleFilter, setUsersRoleFilter] = useState('all')
  const [banModalUser, setBanModalUser] = useState<any>(null)
  const [banReason, setBanReason] = useState('')

  // User tags management
  const [tagsModalUser, setTagsModalUser] = useState<any>(null)
  const [userTags, setUserTags] = useState<any[]>([])
  const [newTagText, setNewTagText] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [newTagTextColor, setNewTagTextColor] = useState('#ffffff')
  const [newTagSparkly, setNewTagSparkly] = useState(false)

  // Revision
  const [revisionSub, setRevisionSub] = useState<Submission | null>(null)
  const [revisionReason, setRevisionReason] = useState('')

  // Reject with reason
  const [rejectSub, setRejectSub] = useState<Submission | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Status types
  const [statusTypes, setStatusTypes] = useState<any[]>([])
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [newStatusKey, setNewStatusKey] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#6b7280')
  const [newStatusTextColor, setNewStatusTextColor] = useState('#ffffff')
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editStatusLabel, setEditStatusLabel] = useState('')
  const [editStatusColor, setEditStatusColor] = useState('#6b7280')
  const [editStatusTextColor, setEditStatusTextColor] = useState('#ffffff')

  // Top 10 stats
  const [top10Data, setTop10Data] = useState<any[]>([])
  const [top10Loading, setTop10Loading] = useState(false)

  const loadScammers = useCallback(async (page: number, search: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/panel/scammers?${params}`)
      if (res.status === 403) {
        toast.error('Доступ запрещен')
        return
      }
      const data = await res.json()
      setScammers(data.results || [])
      setScammerTotal(data.total || 0)
      setScammerTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Load scammers error:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [statsRes, submissionsRes] = await Promise.all([
        fetch('/api/panel/stats'),
        fetch('/api/panel/submissions'),
      ])

      // Check if any returned 403 (not admin)
      if (statsRes.status === 403 || submissionsRes.status === 403) {
        toast.error('Доступ запрещен. Обновите страницу.')
        return
      }

      const [statsData, submissionsData] = await Promise.all([
        statsRes.json(),
        submissionsRes.json(),
      ])

      setStats(statsData)
      setSubmissions(submissionsData.results || [])
      // Load scammers separately with pagination
      loadScammers(scammerPage, scammerSearch)
    } catch (err) {
      console.error('Load data error:', err)
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }, [loadScammers, scammerPage, scammerSearch])

  // Reload scammers when page or search changes (after initial load)
  useEffect(() => {
    if (isAdminChecked && !loading) {
      loadScammers(scammerPage, scammerSearch)
    }
  }, [scammerPage, scammerSearch, isAdminChecked, loading, loadScammers])

  const handleSearch = () => {
    setScammerSearch(scammerSearchInput)
    setScammerPage(1)
  }

  const handleClearSearch = () => {
    setScammerSearchInput('')
    setScammerSearch('')
    setScammerPage(1)
  }

  // Load status types on mount (needed for forms everywhere, not just statuses tab)
  useEffect(() => {
    fetch('/api/status-types').then(r => r.json()).then(d => {
      if (d.statuses) setStatusTypes(d.statuses)
    }).catch(() => {})
  }, [])

  const handleAddStatus = async () => {
    if (!newStatusLabel.trim() || !newStatusKey.trim()) {
      toast.error('Заполните название и ключ')
      return
    }
    try {
      const res = await fetch('/api/status-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newStatusKey.trim(),
          label: newStatusLabel.trim(),
          color: newStatusColor,
          textColor: newStatusTextColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Тип создан')
      setNewStatusLabel('')
      setNewStatusKey('')
      setNewStatusColor('#6b7280')
      setNewStatusTextColor('#ffffff')
      const r2 = await fetch('/api/status-types')
      const d2 = await r2.json()
      if (d2.statuses) setStatusTypes(d2.statuses)
    } catch { toast.error('Ошибка') }
  }

  const handleDeleteStatus = async (id: string, isDefault: boolean) => {
    if (isDefault) { toast.error('Нельзя удалить тип по умолчанию'); return }
    try {
      const res = await fetch(`/api/status-types?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Тип удален')
      const r2 = await fetch('/api/status-types')
      const d2 = await r2.json()
      if (d2.statuses) setStatusTypes(d2.statuses)
    } catch { toast.error('Ошибка') }
  }

  const handleEditStatus = (st: any) => {
    setEditingStatusId(st.id)
    setEditStatusLabel(st.label)
    setEditStatusColor(st.color)
    setEditStatusTextColor(st.textColor)
  }

  const handleSaveEditStatus = async () => {
    if (!editingStatusId || !editStatusLabel.trim()) { toast.error('Введите название'); return }
    try {
      const res = await fetch('/api/status-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStatusId,
          label: editStatusLabel.trim(),
          color: editStatusColor,
          textColor: editStatusTextColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Тип обновлен')
      setEditingStatusId(null)
      const r2 = await fetch('/api/status-types')
      const d2 = await r2.json()
      if (d2.statuses) setStatusTypes(d2.statuses)
    } catch { toast.error('Ошибка') }
  }

  // Check admin status and load data only when confirmed admin
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !session?.user?.role) {
      router.replace('/panel/register')
      return
    }

    const userRole = session.user.role
    if (userRole !== 'admin') {
      router.replace('/panel/register')
      return
    }

    // Confirmed admin - load data
    if (!isAdminChecked) {
      setIsAdminChecked(true)
      loadData()
    }
  }, [status, session, router, loadData, isAdminChecked])

  // Load comments when tab is active
  useEffect(() => {
    if (tab !== 'comments' || !isAdminChecked) return
    setCommentsLoading(true)
    fetch('/api/panel/comments')
      .then(r => r.json())
      .then(d => setComments(d.results || []))
      .catch(() => toast.error('Ошибка загрузки комментариев'))
      .finally(() => setCommentsLoading(false))
  }, [tab, isAdminChecked])

  // Load complaints when tab is active
  useEffect(() => {
    if (tab !== 'complaints' || !isAdminChecked) return
    setComplaintsLoading(true)
    fetch('/api/panel/complaints')
      .then(r => r.json())
      .then(d => setComplaints(d.results || []))
      .catch(() => toast.error('Ошибка загрузки жалоб'))
      .finally(() => setComplaintsLoading(false))
  }, [tab, isAdminChecked])

  // Load appeals when tab is active
  const loadAppeals = useCallback(async (page: number, status: string) => {
    setAppealsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' })
      if (status && status !== 'all') params.set('status', status)
      const res = await fetch(`/api/panel/appeals?${params}`)
      if (res.status === 403) { toast.error('Доступ запрещен'); return }
      const data = await res.json()
      setAppeals(data.results || [])
      setAppealsTotal(data.total || 0)
      setAppealsTotalPages(data.totalPages || 1)
    } catch { toast.error('Ошибка загрузки апелляций') }
    finally { setAppealsLoading(false) }
  }, [])

  useEffect(() => {
    if (tab !== 'appeals' || !isAdminChecked) return
    setAppealsPage(1)
    loadAppeals(1, appealsStatusFilter)
  }, [tab, isAdminChecked, appealsStatusFilter])

  useEffect(() => {
    if (tab !== 'appeals' || appealsPage === 1) return
    loadAppeals(appealsPage, appealsStatusFilter)
  }, [appealsPage, tab, appealsStatusFilter])

  const handleAppealAction = async (appealId: string, action: string, scammerName: string) => {
    const confirmMsg = action === 'accept'
      ? `Принять апелляцию и удалить "${scammerName}" из базы?`
      : action === 'reject'
      ? 'Отклонить апелляцию?'
      : 'Забанить автора апелляции?'
    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch('/api/panel/appeals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealId, action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      loadAppeals(appealsPage, appealsStatusFilter)
    } catch { toast.error('Ошибка') }
  }

  // Load users when tab is active
  const loadUsers = useCallback(async (page: number, search: string, role: string) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (role && role !== 'all') params.set('role', role)
      const res = await fetch(`/api/panel/users?${params}`)
      if (res.status === 403) { toast.error('Доступ запрещен'); return }
      const data = await res.json()
      setUsers(data.results || [])
      setUsersTotal(data.total || 0)
      setUsersTotalPages(data.totalPages || 1)
    } catch { toast.error('Ошибка загрузки юзеров') }
    finally { setUsersLoading(false) }
  }, [])

  useEffect(() => {
    if (tab !== 'users' || !isAdminChecked) return
    loadUsers(1, usersSearch, usersRoleFilter)
  }, [tab, isAdminChecked, usersSearch, usersRoleFilter, loadUsers])

  // Load top10 when stats tab is active
  useEffect(() => {
    if (tab !== 'stats' || !isAdminChecked) return
    setTop10Loading(true)
    fetch('/api/top10')
      .then(r => r.json())
      .then(d => setTop10Data(d.results || []))
      .catch(() => toast.error('Ошибка загрузки статистики'))
      .finally(() => setTop10Loading(false))
  }, [tab, isAdminChecked])

  if (status === 'loading' || !isAdminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  const handleAddScammer = async () => {
    if (!newName.trim()) {
      toast.error('Введите имя')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/panel/scammers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          status: newStatus,
          screenshots: [],
          scammerType: newScammerType,
          scamDate: newScamDate,
          scamAmount: newScamAmount,
          scamCurrency: newScamCurrency,
          proofLink: newProofLink,
          telegramUserId: newTelegramUserId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка добавления')
        return
      }

      toast.success(data.message || 'Скамер добавлен')
      setNewName('')
      setNewDesc('')
      setNewStatus('scam')
      setNewScammerType('')
      setNewScamDate('')
      setNewScamAmount('')
      setNewScamCurrency('')
      setNewProofLink('')
      setNewTelegramUserId('')
      loadScammers(scammerPage, scammerSearch)
      loadData()
    } catch (err) {
      console.error('Add scammer error:', err)
      toast.error('Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateScammer = async () => {
    if (!editScammer) return

    try {
      const res = await fetch('/api/panel/scammers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editScammer.id,
          name: editName.trim(),
          description: editDesc.trim(),
          status: editStatus,
          searchCount: Number(editSearchCount) || 0,
          scammerType: editScammerType,
          scamDate: editScamDate,
          proofLink: editProofLink,
          telegramUserId: editTelegramUserId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка обновления')
        return
      }

      toast.success(data.message || 'Обновлено')
      setEditScammer(null)
      loadScammers(scammerPage, scammerSearch)
    } catch (err) {
      console.error('Update scammer error:', err)
      toast.error('Ошибка')
    }
  }

  const handleDeleteScammer = async (id: string) => {
    if (!confirm('Удалить этого скамера?')) return

    try {
      const res = await fetch(`/api/panel/scammers?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка удаления')
        return
      }
      toast.success(data.message || 'Удалено')
      loadScammers(scammerPage, scammerSearch)
    } catch (err) {
      console.error('Delete scammer error:', err)
      toast.error('Ошибка')
    }
  }

  const handleSubmissionAction = async (id: string, action: string, reason?: string) => {
    try {
      const res = await fetch('/api/panel/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action, revisionReason: reason }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка')
        return
      }

      toast.success(data.message || 'Статус обновлен')
      setRevisionSub(null)
      setRevisionReason('')
      setRejectSub(null)
      setRejectReason('')
      loadData()
    } catch (err) {
      console.error('Submission action error:', err)
      toast.error('Ошибка')
    }
  }

  const handleCommentAction = async (id: string, action: string) => {
    try {
      const res = await fetch('/api/panel/comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      // Reload comments
      fetch('/api/panel/comments').then(r => r.json()).then(d => setComments(d.results || []))
    } catch { toast.error('Ошибка') }
  }

  const handleDeleteComment = async (id: string) => {
    try {
      const res = await fetch(`/api/panel/comments?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      fetch('/api/panel/comments').then(r => r.json()).then(d => setComments(d.results || []))
    } catch { toast.error('Ошибка') }
  }

  const handleComplaintAction = async (id: string, action: string) => {
    try {
      const res = await fetch('/api/panel/complaints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      fetch('/api/panel/complaints').then(r => r.json()).then(d => setComplaints(d.results || []))
    } catch { toast.error('Ошибка') }
  }

  const handleDeleteComplaint = async (id: string) => {
    try {
      const res = await fetch(`/api/panel/complaints?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      fetch('/api/panel/complaints').then(r => r.json()).then(d => setComplaints(d.results || []))
    } catch { toast.error('Ошибка') }
  }

  const handleDeleteSubmission = async (id: string) => {
    if (!confirm('Удалить эту заявку?')) return
    try {
      const res = await fetch('/api/panel/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'delete' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      loadData()
    } catch { toast.error('Ошибка') }
  }

  const handleBanUser = async (userId: string, reason: string) => {
    try {
      const res = await fetch('/api/panel/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, action: 'ban', reason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      setBanModalUser(null)
      setBanReason('')
      loadUsers(usersPage, usersSearch, usersRoleFilter)
    } catch { toast.error('Ошибка') }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      const res = await fetch('/api/panel/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, action: 'unban' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      loadUsers(usersPage, usersSearch, usersRoleFilter)
    } catch { toast.error('Ошибка') }
  }

  const loadUserTags = async (userId: string) => {
    try {
      const res = await fetch(`/api/panel/users/${userId}/tags`)
      const data = await res.json()
      setUserTags(data.tags || [])
    } catch { setUserTags([]) }
  }

  const handleCreateTag = async () => {
    if (!tagsModalUser || !newTagText.trim()) return
    try {
      const res = await fetch(`/api/panel/users/${tagsModalUser.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newTagText.trim(),
          color: newTagColor,
          textColor: newTagTextColor,
          sparkly: newTagSparkly,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setUserTags(prev => [data.tag, ...prev])
        setNewTagText('')
      }
    } catch {}
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!tagsModalUser) return
    try {
      await fetch(`/api/panel/users/${tagsModalUser.id}/tags?tagId=${tagId}`, { method: 'DELETE' })
      setUserTags(prev => prev.filter(t => t.id !== tagId))
    } catch {}
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm('Удалить пользователя ' + username + '? Все его данные будут удалены безвозвратно.')) return
    if (!confirm('Точно удалить ' + username + '? Это действие необратимо.')) return
    try {
      const res = await fetch('/api/panel/users?id=' + userId, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(data.message)
      loadUsers(usersPage, usersSearch, usersRoleFilter)
    } catch { toast.error('Ошибка') }
  }

  const startEdit = (scammer: Scammer) => {
    setEditScammer(scammer)
    setEditName(scammer.name)
    setEditDesc(scammer.description)
    setEditStatus(scammer.status)
    setEditSearchCount(scammer.searchCount)
    setEditScammerType(scammer.scammerType || '')
    setEditScamDate(scammer.scamDate || '')
    setEditProofLink(scammer.proofLink || '')
    setEditTelegramUserId(scammer.telegramUserId || '')
  }

  const statusBadge = (status: string, label?: string, color?: string, textColor?: string) => {
    const displayLabel = label || status
    const style = color ? {
      backgroundColor: color + '22',
      color: textColor || color,
      borderColor: color + '44',
    } : undefined
    const fallback = !color ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''
    return (
      <span className={`text-[10px] px-2 py-0 rounded-full border font-semibold ${fallback}`} style={style}>
        {displayLabel}
      </span>
    )
  }

  const subStatusBadge = (status: string) => {
    const c: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
      revision: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    }
    const l: Record<string, string> = {
      pending: 'На рассмотрении',
      approved: 'Подтверждена',
      rejected: 'Отклонена',
      revision: 'На доработке',
    }
    return <Badge variant="outline" className={`${c[status] || ''} text-xs`}>{l[status] || status}</Badge>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-green-400">

      {/* Sidebar + Content */}
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 glass-strong border-r border-green-500/10 p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="font-bold text-green-400 font-mono">ScamBase</h1>
              <p className="text-[10px] text-green-600 font-mono">ADMIN PANEL v1.0</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {[
              { id: 'dashboard' as const, icon: Activity, label: 'Дашборд' },
              { id: 'scammers' as const, icon: Database, label: 'Скамеры' },
              { id: 'users' as const, icon: Users, label: 'Юзеры' },
              { id: 'submissions' as const, icon: FileText, label: 'Заявки' },
              { id: 'comments' as const, icon: MessageSquare, label: 'Комментарии' },
              { id: 'complaints' as const, icon: AlertTriangle, label: 'Жалобы' },
              { id: 'appeals' as const, icon: Scale, label: 'Апелляции' },
              { id: 'stats' as const, icon: TrendingUp, label: 'Статистика' },
              { id: 'add' as const, icon: Plus, label: 'Добавить' },
              { id: 'statuses' as const, icon: Tag, label: 'Типы статусов' },
              { id: 'export' as const, icon: Download, label: 'Экспорт' },
            ].map((item) => {
              const Icon = item.icon
              const isActive = tab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-sm transition-all ${
                    isActive
                      ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                      : 'text-green-600 hover:text-green-400 hover:bg-green-500/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="space-y-2 pt-4 border-t border-green-500/10">
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-sm text-green-600 hover:text-green-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              На сайт
            </button>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-sm text-red-600 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 glass-strong border-b border-green-500/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileMenu(true)} className="p-2 -ml-2 rounded-lg hover:bg-green-500/10">
                <Menu className="w-5 h-5 text-green-400" />
              </button>
              <Terminal className="w-5 h-5 text-green-400" />
              <span className="font-mono font-bold text-green-400">ADMIN</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/')} className="p-2 rounded-lg hover:bg-green-500/10">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu drawer */}
        <AnimatePresence>
          {mobileMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="md:hidden fixed inset-0 z-40"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                onClick={() => setMobileMenu(false)}
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#0a0a0f] border-r border-green-500/10 flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-green-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h1 className="font-bold text-green-400 font-mono text-sm">ScamBase</h1>
                      <p className="text-[9px] text-green-600 font-mono">ADMIN PANEL</p>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenu(false)} className="p-2 rounded-lg hover:bg-green-500/10">
                    <X className="w-4 h-4 text-green-400" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {[
                    { id: 'dashboard' as const, icon: Activity, label: 'Дашборд' },
                    { id: 'scammers' as const, icon: Database, label: 'Скамеры' },
                    { id: 'users' as const, icon: Users, label: 'Юзеры' },
                    { id: 'submissions' as const, icon: FileText, label: 'Заявки' },
                    { id: 'comments' as const, icon: MessageSquare, label: 'Комментарии' },
                    { id: 'complaints' as const, icon: AlertTriangle, label: 'Жалобы' },
                    { id: 'appeals' as const, icon: Scale, label: 'Апелляции' },
                    { id: 'stats' as const, icon: TrendingUp, label: 'Статистика' },
                    { id: 'add' as const, icon: Plus, label: 'Добавить' },
                    { id: 'statuses' as const, icon: Tag, label: 'Типы статусов' },
                    { id: 'export' as const, icon: Download, label: 'Экспорт' },
                  ].map((item) => {
                    const Icon = item.icon
                    const isActive = tab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setTab(item.id); setMobileMenu(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg font-mono text-sm transition-all ${
                          isActive
                            ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                            : 'text-green-600 hover:text-green-400 hover:bg-green-500/5'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    )
                  })}
                </nav>

                <div className="p-3 border-t border-green-500/10 space-y-1">
                  <button
                    onClick={() => { router.push('/'); setMobileMenu(false) }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg font-mono text-sm text-green-600 hover:text-green-400 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    На сайт
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg font-mono text-sm text-red-600 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {tab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Дашборд</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Панель администратора</p>
                  </div>

                  {/* Quick stats row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {[
                      { label: 'Скамеров', value: stats?.totalScammers || 0, icon: Users, color: 'text-red-400' },
                      { label: 'Заявок', value: stats?.pendingSubmissions || 0, icon: FileText, color: 'text-yellow-400' },
                      { label: 'Юзеров', value: stats?.totalUsers || 0, icon: Shield, color: 'text-blue-400' },
                      { label: 'Поисков сегодня', value: stats?.searchesToday || 0, icon: Search, color: 'text-purple-400' },
                    ].map((s, i) => (
                      <div key={s.label} className="glass rounded-xl p-3 border border-green-500/10">
                        <div className="flex items-center gap-2 mb-1">
                          <s.icon className={`w-4 h-4 ${s.color}`} />
                          <span className="text-[10px] font-mono text-green-600">{s.label}</span>
                        </div>
                        <p className="text-xl font-bold font-mono text-green-300">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Ping Pong Game */}
                  <PingPongGame />
                </motion.div>
              )}

              {tab === 'stats' && (
                <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Статистика</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Подробная статистика системы</p>
                  </div>

                  {/* Overview stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Всего скамеров', value: stats?.totalScammers || 0, icon: Users, color: 'text-red-400' },
                      { label: 'Всего заявок', value: stats?.totalSubmissions || 0, icon: FileText, color: 'text-yellow-400' },
                      { label: 'Всего юзеров', value: stats?.totalUsers || 0, icon: Shield, color: 'text-blue-400' },
                      { label: 'Всего поисков', value: stats?.totalSearches || 0, icon: Search, color: 'text-purple-400' },
                    ].map((s, i) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="glass rounded-xl p-4 border border-green-500/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <s.icon className={`w-4 h-4 ${s.color}`} />
                          <span className="text-xs font-mono text-green-600">{s.label}</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-green-300">{s.value}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Today stats */}
                  <div className="mb-6">
                    <p className="text-xs font-mono text-green-600 mb-3">{'// '}Статистика за сегодня</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Поисков', value: stats?.searchesToday || 0, icon: Search, color: 'text-cyan-400' },
                        { label: 'Лайков', value: stats?.likesToday || 0, icon: TrendingUp, color: 'text-green-400' },
                        { label: 'Изменений БД', value: stats?.dbChangesToday || 0, icon: Database, color: 'text-orange-400', sub: `+${stats?.scammersAddedToday || 0} / ~${stats?.scammersUpdatedToday || 0}` },
                        { label: 'Заявок на ревью', value: stats?.pendingSubmissions || 0, icon: AlertTriangle, color: 'text-yellow-400' },
                      ].map((s, i) => (
                        <motion.div
                          key={s.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (i + 4) * 0.05 }}
                          className="glass rounded-xl p-4 border border-green-500/10"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                            <span className="text-xs font-mono text-green-600">{s.label}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-green-300">{s.value}</p>
                          {s.sub && <p className="text-[10px] font-mono text-green-600/60 mt-1">{s.sub}</p>}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Terminal-style log */}
                  <div className="glass rounded-xl p-4 border border-green-500/10 font-mono text-xs mb-6">
                    <div className="flex items-center gap-2 mb-3 text-green-600">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      system.log
                    </div>
                    <div className="space-y-1 text-green-600/80">
                      <p>{'>'} ScamBase Admin Panel initialized</p>
                      <p>{'>'} Connected to database: OK</p>
                      <p>{'>'} Scamers in DB: {stats?.totalScammers || 0} | Users: {stats?.totalUsers || 0}</p>
                      <p>{'>'} Total searches: {stats?.totalSearches || 0} | Today: {stats?.searchesToday || 0}</p>
                      <p>{'>'} SCAM: {stats?.scamCount || 0} | Verified: {stats?.verifiedCount || 0}</p>
                      <p>{'>'} DB changes today: +{stats?.scammersAddedToday || 0} added, ~{stats?.scammersUpdatedToday || 0} updated</p>
                      <p>{'>'} Likes today: {stats?.likesToday || 0}</p>
                      <p className="text-green-400">{'>'} Ready for commands_</p>
                    </div>
                  </div>

                  {/* Top 10 */}
                  <div>
                    <p className="text-xs font-mono text-green-600 mb-3">{'// '}Топ-10 по поискам</p>
                    {top10Loading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                      </div>
                    ) : top10Data.length === 0 ? (
                      <div className="glass rounded-xl p-6 border border-green-500/10 text-center">
                        <p className="font-mono text-green-600 text-sm">Нет данных</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {top10Data.map((item: any, i: number) => (
                          <div key={item.id || i} className="glass rounded-xl p-3 border border-green-500/10 flex items-center gap-3">
                            <span className="font-mono text-green-500 font-bold w-6 text-center">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-green-300 text-sm font-semibold truncate">{item.name}</p>
                              <p className="text-[10px] font-mono text-green-600">
                                {item.searchCount} поисков
                                {item.likeCount !== undefined && ` | ❤️ ${item.likeCount}`}
                              </p>
                            </div>
                            <span className="text-xs font-mono text-green-500">{item.searchCount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {tab === 'scammers' && (
                <motion.div key="scammers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Скамеры</h2>
                      <p className="text-sm text-green-600 font-mono mt-1">{'// '}Управление базой ({scammerTotal} записей)</p>
                    </div>
                    <Button
                      onClick={() => setTab('add')}
                      variant="outline"
                      className="border-green-500/20 text-green-400 hover:bg-green-500/10 font-mono shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Добавить
                    </Button>
                  </div>

                  {/* Search */}
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                      <Input
                        placeholder="Поиск по имени..."
                        value={scammerSearchInput}
                        onChange={(e) => setScammerSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-10 pl-9 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40"
                      />
                    </div>
                    <Button
                      onClick={handleSearch}
                      variant="outline"
                      className="border-green-500/20 text-green-400 hover:bg-green-500/10 font-mono h-10 px-4"
                    >
                      Найти
                    </Button>
                    {scammerSearch && (
                      <Button
                        onClick={handleClearSearch}
                        variant="outline"
                        className="border-red-500/20 text-red-400 hover:bg-red-500/10 font-mono h-10 px-4"
                      >
                        Сброс
                      </Button>
                    )}
                  </div>

                  {scammers.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <p className="font-mono text-green-600">{scammerSearch ? 'Ничего не найдено.' : 'База пуста. Добавьте первого скамера.'}</p>
                    </div>
                  ) : (
                    <>
                    <div className="space-y-3">
                      {scammers.map((s, i) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="glass rounded-xl p-4 border border-green-500/10"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 font-mono font-bold text-green-400">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-mono font-semibold truncate">{s.name}</p>
                                <p className="text-xs text-green-600 font-mono">
                                  Поисков: {s.searchCount} | Заявок: {s.submissionCount || 0}
                                  {s.scammerType && ` | ${s.scammerType}`}
                                  {s.scamDate && ` | ${s.scamDate}`}
                                  {s.scamAmount && ` | ${s.scamAmount} ${s.scamCurrency || ''}`}
                                  {s.telegramUserId && ` | ID: ${s.telegramUserId}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {statusBadge(s.status, s.statusLabel, s.statusColor, s.statusTextColor)}
                              <button
                                onClick={function openHist() { setNameHistoryScammer({ id: s.id, name: s.name }) }}
                                className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                                title="История имён"
                              >
                                <Clock className="w-4 h-4 text-blue-400 hover:text-blue-300" />
                              </button>
                              <button
                                onClick={() => startEdit(s)}
                                className="p-2 rounded-lg hover:bg-green-500/10 transition-colors"
                              >
                                <Edit3 className="w-4 h-4 text-green-600 hover:text-green-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteScammer(s.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 hover:text-red-400" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {scammerTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                          onClick={() => setScammerPage(p => Math.max(1, p - 1))}
                          disabled={scammerPage <= 1}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg font-mono text-sm border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Назад
                        </button>
                        <span className="font-mono text-sm text-green-500 px-3">
                          {scammerPage} / {scammerTotalPages}
                        </span>
                        <button
                          onClick={() => setScammerPage(p => Math.min(scammerTotalPages, p + 1))}
                          disabled={scammerPage >= scammerTotalPages}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg font-mono text-sm border border-green-500/20 text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Вперёд
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Юзеры</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Управление аккаунтами ({usersTotal} всего)</p>
                  </div>

                  {/* Search and filter */}
                  <div className="glass rounded-xl p-4 border border-green-500/10 mb-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Поиск по имени..."
                          value={usersSearchInput}
                          onChange={(e) => setUsersSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setUsersSearch(usersSearchInput.trim())
                              setUsersPage(1)
                            }
                          }}
                          className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={usersRoleFilter}
                          onChange={(e) => { setUsersRoleFilter(e.target.value); setUsersPage(1) }}
                          className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono text-sm px-3 cursor-pointer"
                        >
                          <option value="all">Все роли</option>
                          <option value="user">Юзеры</option>
                          <option value="admin">Админы</option>
                          <option value="banned">Забаненные</option>
                        </select>
                        <Button
                          onClick={() => { setUsersSearch(usersSearchInput.trim()); setUsersPage(1) }}
                          className="h-10 bg-green-500/20 text-green-400 hover:bg-green-500/30 font-mono rounded-lg px-3"
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <p className="font-mono text-green-600">Юзеры не найдены.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {users.map((u: any, i: number) => (
                          <motion.div
                            key={u.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className={`glass rounded-xl p-4 border ${u.role === 'banned' ? 'border-red-500/20' : u.role === 'admin' ? 'border-green-500/20' : 'border-green-500/10'}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  u.role === 'admin' ? 'bg-green-500/20' : u.role === 'banned' ? 'bg-red-500/20' : 'bg-blue-500/20'
                                }`}>
                                  <span className={`font-bold text-sm ${
                                    u.role === 'admin' ? 'text-green-400' : u.role === 'banned' ? 'text-red-400' : 'text-blue-400'
                                  }`}>{u.username.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-mono font-semibold text-sm truncate">{u.username}</p>
                                    {u.role === 'admin' ? (
                                      <span className="text-[10px] px-2 py-0 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-mono">Админ</span>
                                    ) : u.role === 'banned' ? (
                                      <span className="text-[10px] px-2 py-0 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-mono">Бан</span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">Юзер</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-green-600 font-mono mt-0.5">
                                    <span>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                                    <span>{u.submissionsCount} заявок</span>
                                    <span>{u.commentsCount} комм.</span>
                                    <span>{u.searchesCount} поисков</span>
                                  </div>
                                  {u.role === 'banned' && u.banReason && (
                                    <p className="text-[10px] text-red-400/80 font-mono mt-0.5">Причина: {u.banReason}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setTagsModalUser(u); loadUserTags(u.id) }}
                                    className="h-8 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 font-mono text-[10px] rounded-lg"
                                  >
                                    <Tag className="w-3 h-3 mr-1" />
                                    Теги
                                  </Button>
                                  {u.role !== 'admin' && (
                                    <>
                                      {u.role === 'banned' ? (
                                        <Button
                                          size="sm"
                                          onClick={() => handleUnbanUser(u.id)}
                                          className="h-8 bg-green-600 hover:bg-green-700 text-white font-mono text-[10px] rounded-lg"
                                        >
                                          Разбанить
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => { setBanModalUser(u); setBanReason('') }}
                                          className="h-8 bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] rounded-lg"
                                        >
                                          Забанить
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                        className="h-8 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-mono text-[10px] rounded-lg"
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Удалить
                                      </Button>
                                    </>
                                  )}
                                </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {usersTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-6">
                          <button
                            onClick={() => { setUsersPage(p => Math.max(1, p - 1)); loadUsers(Math.max(1, usersPage - 1), usersSearch, usersRoleFilter) }}
                            disabled={usersPage <= 1}
                            className="p-2 rounded-lg hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-green-400" />
                          </button>
                          <span className="text-sm text-green-400 font-mono">
                            {usersPage} / {usersTotalPages}
                          </span>
                          <button
                            onClick={() => { setUsersPage(p => Math.min(usersTotalPages, p + 1)); loadUsers(Math.min(usersTotalPages, usersPage + 1), usersSearch, usersRoleFilter) }}
                            disabled={usersPage >= usersTotalPages}
                            className="p-2 rounded-lg hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-green-400" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'submissions' && (
                <motion.div key="submissions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Заявки</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Модерация ({submissions.length} записей)</p>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <p className="font-mono text-green-600">Нет заявок на рассмотрении.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map((sub, i) => (
                        <motion.div
                          key={sub.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="glass rounded-xl p-4 border border-green-500/10"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono font-semibold">{sub.scammerName}</p>
                                  {sub.scammerStatusLabel && (
                                    <span
                                      className="text-[10px] px-2 py-0 rounded-full border font-mono font-semibold ml-2"
                                      style={{
                                        backgroundColor: sub.scammerStatusColor + '22',
                                        color: sub.scammerStatusTextColor || sub.scammerStatusColor,
                                        borderColor: sub.scammerStatusColor + '44',
                                      }}
                                    >
                                      {sub.scammerStatusLabel}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-green-600 font-mono">
                                  от {sub.user?.username || 'неизвестно'} | {new Date(sub.createdAt).toLocaleDateString('ru-RU')}
                                  {sub.telegramUserId && ` | Telegram ID: ${sub.telegramUserId}`}
                                  {sub.scamAmount && ` | ${sub.scamAmount} ${sub.scamCurrency || ''}`}
                                </p>
                              </div>
                              {subStatusBadge(sub.status)}
                            </div>

                            {sub.scammerData && (
                              <p className="text-sm text-green-500/80 font-mono bg-green-500/5 rounded-lg p-2">
                                {sub.scammerData}
                              </p>
                            )}

                            {sub.screenshots && sub.screenshots.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto">
                                {sub.screenshots.map((src: string, j: number) => {
                                  const isImage = /\.(jpe?g|png|webp|gif|bmp|avif)(\?.*)?$/i.test(src)
                                  return isImage ? (
                                    <a key={j} href={src} target="_blank" rel="noopener noreferrer">
                                      <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-green-500/20" />
                                    </a>
                                  ) : (
                                    <a key={j} href={src} target="_blank" rel="noopener noreferrer"
                                      className="shrink-0 w-16 h-16 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-colors">
                                      <LinkIcon className="w-4 h-4" />
                                    </a>
                                  )
                                })}
                              </div>
                            )}

                            {sub.revisionReason && (
                              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <p className="text-xs text-orange-400 font-mono">{sub.revisionReason}</p>
                              </div>
                            )}

                            {sub.status === 'pending' && (
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmissionAction(sub.id, 'approved')}
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white font-mono text-xs rounded-lg"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Подтвердить
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => { setRejectSub(sub); setRejectReason('') }}
                                  className="h-8 bg-red-600 hover:bg-red-700 text-white font-mono text-xs rounded-lg"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Отклонить
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => { setRevisionSub(sub); setRevisionReason('') }}
                                  className="h-8 bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-xs rounded-lg"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Доработка
                                </Button>
                              </div>
                            )}

                            {(sub.status === 'approved' || sub.status === 'rejected' || sub.status === 'revision') && (
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleDeleteSubmission(sub.id)}
                                  className="h-7 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-mono text-[10px] rounded-lg px-2"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Удалить
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'comments' && (
                <motion.div key="comments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Комментарии</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Модерация комментариев ({comments.filter((c: any) => !c.hidden).length} записей)</p>
                  </div>

                  {commentsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <p className="font-mono text-green-600">Нет комментариев.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((c: any, i: number) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`glass rounded-xl p-4 border ${c.hidden ? 'border-gray-500/20 opacity-50' : c.approved ? 'border-green-500/10' : 'border-yellow-500/30'}`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{c.user?.username || 'Неизвестный'}</span>
                                <span className="text-[10px] text-green-600 font-mono">
                                  на <span className="text-green-400">{c.scammer?.name || '—'}</span>
                                </span>
                                {c.approved ? (
                                  <span className="text-[10px] px-2 py-0 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-mono">Опубликован</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-mono">На проверке</span>
                                )}
                                {c.user?.role === 'banned' && (
                                  <span className="text-[10px] px-2 py-0 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-mono">Забанен</span>
                                )}
                              </div>
                              <span className="text-[10px] text-green-600 font-mono">
                                {new Date(c.createdAt).toLocaleDateString('ru-RU')}
                              </span>
                            </div>
                            <p className="text-sm text-green-100/80 font-mono bg-green-500/5 rounded-lg p-2">{c.content}</p>
                            <div className="flex gap-2 flex-wrap justify-end">
                              {!c.approved && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCommentAction(c.id, 'approve')}
                                  className="h-7 bg-green-600 hover:bg-green-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Опубликовать
                                </Button>
                              )}
                              {!c.approved && c.user?.role !== 'banned' && (
                                <Button
                                  size="sm"
                                  onClick={() => { if (confirm(`Забанить ${c.user?.username}?`)) handleCommentAction(c.id, 'ban') }}
                                  className="h-7 bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  Забанить
                                </Button>
                              )}
                              {c.hidden ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleCommentAction(c.id, 'unhide')}
                                  className="h-7 bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  Вернуть
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleCommentAction(c.id, 'hide')}
                                  className="h-7 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-mono text-[10px] rounded-lg"
                                >
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Скрыть
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => { if (confirm('Удалить комментарий навсегда?')) handleDeleteComment(c.id) }}
                                className="h-7 bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] rounded-lg"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Удалить
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'complaints' && (
                <motion.div key="complaints" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Жалобы</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Жалобы без регистрации ({complaints.length} записей)</p>
                  </div>

                  {complaintsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : complaints.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <p className="font-mono text-green-600">Нет жалоб.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {complaints.map((c: any, i: number) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`glass rounded-xl p-4 border ${c.status === 'pending' ? 'border-orange-500/20' : 'border-green-500/10'}`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-mono font-semibold">{c.name}</p>
                                <p className="text-xs text-green-600 font-mono">{new Date(c.createdAt).toLocaleDateString('ru-RU')}</p>
                              </div>
                              {c.status === 'pending' ? (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">Ожидает</span>
                              ) : c.status === 'resolved' ? (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-mono">Решена</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 font-mono">Отклонена</span>
                              )}
                            </div>
                            {c.reason && (
                              <p className="text-sm text-green-500/80 font-mono bg-green-500/5 rounded-lg p-2">{c.reason}</p>
                            )}
                            <div className="flex gap-2 flex-wrap justify-end">
                              {c.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setNewName(c.name)
                                      setNewDesc(c.reason || '')
                                      setTab('add')
                                    }}
                                    className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px] rounded-lg"
                                  >
                                    <Database className="w-3 h-3 mr-1" />
                                    Записать
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleComplaintAction(c.id, 'resolved')}
                                    className="h-7 bg-green-600 hover:bg-green-700 text-white font-mono text-[10px] rounded-lg"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Решена
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleComplaintAction(c.id, 'dismissed')}
                                    className="h-7 bg-gray-600 hover:bg-gray-700 text-white font-mono text-[10px] rounded-lg"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Отклонить
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleDeleteComplaint(c.id)}
                                className="h-7 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-mono text-[10px] rounded-lg"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Удалить
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'appeals' && (
                <motion.div key="appeals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Апелляции</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Запросы на удаление из базы ({appealsTotal} всего)</p>
                  </div>

                  {/* Filter */}
                  <div className="glass rounded-xl p-4 border border-green-500/10 mb-4">
                    <div className="flex gap-2 flex-wrap">
                      {['all', 'pending', 'accepted', 'rejected', 'banned'].map((s) => (
                        <button
                          key={s}
                          onClick={() => { setAppealsStatusFilter(s); setAppealsPage(1) }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                            appealsStatusFilter === s
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-green-500/5 text-green-600 hover:text-green-400 border border-transparent'
                          }`}
                        >
                          {s === 'all' ? 'Все' : s === 'pending' ? 'Ожидают' : s === 'accepted' ? 'Принятые' : s === 'rejected' ? 'Отклонённые' : 'Забаненные'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {appealsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : appeals.length === 0 ? (
                    <div className="glass rounded-xl p-8 border border-green-500/10 text-center">
                      <Scale className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-mono text-green-600">Нет апелляций.</p>
                    </div>
                  ) : (
                    <>
                    <div className="space-y-3">
                      {appeals.map((a: any, i: number) => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`glass rounded-xl p-4 border ${
                            a.status === 'pending' ? 'border-orange-500/20' :
                            a.status === 'accepted' ? 'border-green-500/20' :
                            a.status === 'banned' ? 'border-red-500/20' :
                            'border-gray-500/20'
                          }`}
                        >
                          <div className="flex flex-col gap-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center shrink-0">
                                  <Scale className="w-5 h-5 text-orange-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-mono font-semibold text-sm truncate">{a.scammer?.name || 'Неизвестен'}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-green-600 font-mono mt-0.5">
                                    <span>{new Date(a.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>от {a.user?.username || 'Аноним'}</span>
                                  </div>
                                </div>
                              </div>
                              {a.status === 'pending' ? (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono shrink-0">Ожидает</span>
                              ) : a.status === 'accepted' ? (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-mono shrink-0">Принята</span>
                              ) : a.status === 'banned' ? (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-mono shrink-0">Забанен</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 font-mono shrink-0">Отклонена</span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-sm text-green-100/80 font-mono bg-green-500/5 rounded-lg p-3 whitespace-pre-wrap break-words">{a.description}</p>

                            {/* Proof link */}
                            {a.proofLink && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-green-600 font-mono shrink-0">Доказательство:</span>
                                <a href={a.proofLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-1 truncate">
                                  {a.proofLink}
                                </a>
                              </div>
                            )}

                            {/* Actions */}
                            {a.status === 'pending' && (
                              <div className="flex gap-2 flex-wrap justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleAppealAction(a.id, 'accept', a.scammer?.name)}
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Принять
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAppealAction(a.id, 'reject', a.scammer?.name)}
                                  className="h-8 bg-gray-600 hover:bg-gray-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Отклонить
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAppealAction(a.id, 'ban', a.scammer?.name)}
                                  className="h-8 bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] rounded-lg"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Забанить автора
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {appealsTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                          onClick={() => setAppealsPage(p => Math.max(1, p - 1))}
                          disabled={appealsPage <= 1}
                          className="p-2 rounded-lg glass border border-green-500/10 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-green-400" />
                        </button>
                        <span className="text-sm text-green-600 font-mono">{appealsPage} / {appealsTotalPages}</span>
                        <button
                          onClick={() => setAppealsPage(p => Math.min(appealsTotalPages, p + 1))}
                          disabled={appealsPage >= appealsTotalPages}
                          className="p-2 rounded-lg glass border border-green-500/10 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-green-400" />
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'add' && (
                <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Добавить скамера</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Новый элемент в базу</p>
                  </div>

                  <div className="glass rounded-xl p-6 border border-green-500/10 max-w-xl space-y-4">
                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Имя *</label>
                      <Input
                        placeholder="Имя скамера..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Описание</label>
                      <Textarea
                        placeholder="Данные, контакты..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40 min-h-[80px]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Статус</label>
                      <div className="flex flex-wrap gap-2">
                        {statusTypes.length > 0 ? statusTypes.map((st) => (
                          <button
                            key={st.key}
                            onClick={() => setNewStatus(st.key)}
                            className="px-3 py-1.5 rounded-lg font-mono text-xs border transition-all"
                            style={{
                              backgroundColor: newStatus === st.key ? st.color + '33' : st.color + '11',
                              color: st.textColor,
                              borderColor: newStatus === st.key ? st.color + '77' : st.color + '33',
                            }}
                          >
                            {newStatus === st.key && '✓ '}{st.label}
                          </button>
                        )) : (
                          <span className="text-xs text-green-600 font-mono">Загрузка...</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Тип</label>
                      <div className="flex gap-2">
                        {['', 'Бот', 'Человек'].map((t) => (
                          <button key={t} type="button" onClick={() => setNewScammerType(t)}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all ${
                              newScammerType === t ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-green-500/10 text-green-600 hover:text-green-400'
                            }`}>
                            {t || 'Не указан'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Дата добавления</label>
                      <Input placeholder="10.03.2026" value={newScamDate} onChange={(e) => setNewScamDate(e.target.value)}
                        className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Сумма скама</label>
                      <div className="flex gap-2">
                        <Input placeholder="Сколько..." value={newScamAmount} onChange={(e) => setNewScamAmount(e.target.value)}
                          className="flex-1 h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                        <select value={newScamCurrency} onChange={(e) => setNewScamCurrency(e.target.value)}
                          className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono px-3 min-w-[120px] appearance-none cursor-pointer focus:border-green-500/40">
                          <option value="">Валюта</option>
                          <option value="рубли">рубли</option>
                          <option value="TON">TON</option>
                          <option value="звёзды ТГ">звёзды ТГ</option>
                          <option value="PRgram">PRgram</option>
                          <option value="GRAM">GRAM</option>
                          <option value="USDT">USDT</option>
                          <option value="BTC">BTC</option>
                          <option value="custom">другое...</option>
                        </select>
                      </div>
                      {newScamCurrency === 'custom' && (
                        <Input placeholder="Название валюты..." value={newScamCurrency === 'custom' ? '' : newScamCurrency} onChange={(e) => setNewScamCurrency(e.target.value)}
                          className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40 mt-2" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Ссылка на доказательство</label>
                      <Input placeholder="https://t.me/..." value={newProofLink} onChange={(e) => setNewProofLink(e.target.value)}
                        className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-green-600 mb-1.5 block">Telegram User ID</label>
                      <Input placeholder="8393190771" value={newTelegramUserId} onChange={(e) => setNewTelegramUserId(e.target.value)}
                        className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                    </div>

                    <Button
                      onClick={handleAddScammer}
                      disabled={submitting || !newName.trim()}
                      className="w-full h-10 bg-green-600 hover:bg-green-700 text-white font-mono rounded-lg"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Добавить в базу'}
                    </Button>
                  </div>
                </motion.div>
              )}

              {tab === 'statuses' && (
                <motion.div key="statuses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Типы статусов</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Управление типами скамеров</p>
                  </div>

                  {/* Existing types */}
                  <div className="glass rounded-xl p-4 border border-green-500/10 mb-6">
                    <p className="text-sm font-mono text-green-400 mb-3">Существующие типы:</p>
                    <div className="space-y-2">
                      {statusTypes.map((st) => (
                        editingStatusId === st.id ? (
                          /* Edit mode */
                          <div key={st.id} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-600 font-mono">{st.key}</span>
                              {st.isDefault && <span className="text-[10px] text-muted-foreground">по умолчанию</span>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] text-green-600 font-mono mb-0.5 block">Название</label>
                                <Input
                                  value={editStatusLabel}
                                  onChange={(e) => setEditStatusLabel(e.target.value)}
                                  className="h-8 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-green-600 font-mono mb-0.5 block">Цвет фона</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={editStatusColor}
                                    onChange={(e) => setEditStatusColor(e.target.value)}
                                    className="w-7 h-7 rounded border border-green-500/20 cursor-pointer bg-transparent"
                                  />
                                  <Input
                                    value={editStatusColor}
                                    onChange={(e) => setEditStatusColor(e.target.value)}
                                    className="h-7 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono text-xs"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-green-600 font-mono mb-0.5 block">Цвет текста</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={editStatusTextColor}
                                    onChange={(e) => setEditStatusTextColor(e.target.value)}
                                    className="w-7 h-7 rounded border border-green-500/20 cursor-pointer bg-transparent"
                                  />
                                  <Input
                                    value={editStatusTextColor}
                                    onChange={(e) => setEditStatusTextColor(e.target.value)}
                                    className="h-7 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleSaveEditStatus}
                                className="px-3 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-mono transition-colors"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => setEditingStatusId(null)}
                                className="px-3 py-1 rounded-lg hover:bg-red-500/10 text-red-400 text-xs font-mono transition-colors"
                              >
                                Отмена
                              </button>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-semibold border ml-auto"
                                style={{
                                  backgroundColor: editStatusColor + '33',
                                  color: editStatusTextColor,
                                  borderColor: editStatusColor + '55',
                                }}
                              >
                                {editStatusLabel || '...'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div key={st.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-green-500/5">
                            <div className="flex items-center gap-3">
                              <span
                                className="text-xs px-3 py-1 rounded-full font-semibold border"
                                style={{
                                  backgroundColor: st.color + '33',
                                  color: st.textColor,
                                  borderColor: st.color + '55',
                                }}
                              >
                                {st.label}
                              </span>
                              <span className="text-xs text-green-600 font-mono">{st.key}</span>
                              {st.isDefault && <span className="text-[10px] text-muted-foreground">по умолч.</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: st.color }} />
                              <button
                                onClick={() => handleEditStatus(st)}
                                className="p-1 rounded hover:bg-green-500/20 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-green-400" />
                              </button>
                              {!st.isDefault && (
                                <button
                                  onClick={() => handleDeleteStatus(st.id, st.isDefault)}
                                  className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>

                  {/* Add new type */}
                  <div className="glass rounded-xl p-4 border border-green-500/10">
                    <p className="text-sm font-mono text-green-400 mb-4">Создать новый тип:</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-green-600 font-mono mb-1 block">Ключ (латиница)</label>
                          <Input
                            placeholder="например: scammer"
                            value={newStatusKey}
                            onChange={(e) => setNewStatusKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-green-600 font-mono mb-1 block">Название</label>
                          <Input
                            placeholder="например: СКАМЕР"
                            value={newStatusLabel}
                            onChange={(e) => setNewStatusLabel(e.target.value)}
                            className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-green-600 font-mono mb-1 block">Цвет фона</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newStatusColor}
                              onChange={(e) => setNewStatusColor(e.target.value)}
                              className="w-10 h-10 rounded-lg border border-green-500/20 cursor-pointer bg-transparent"
                            />
                            <Input
                              value={newStatusColor}
                              onChange={(e) => setNewStatusColor(e.target.value)}
                              className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-green-600 font-mono mb-1 block">Цвет текста</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newStatusTextColor}
                              onChange={(e) => setNewStatusTextColor(e.target.value)}
                              className="w-10 h-10 rounded-lg border border-green-500/20 cursor-pointer bg-transparent"
                            />
                            <Input
                              value={newStatusTextColor}
                              onChange={(e) => setNewStatusTextColor(e.target.value)}
                              className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <p className="text-xs text-green-600 font-mono mb-2">Превью:</p>
                        <span
                          className="text-sm px-4 py-1.5 rounded-full font-semibold border"
                          style={{
                            backgroundColor: newStatusColor + '33',
                            color: newStatusTextColor,
                            borderColor: newStatusColor + '55',
                          }}
                        >
                          {newStatusLabel || 'Название'}
                        </span>
                      </div>

                      <Button
                        onClick={handleAddStatus}
                        disabled={!newStatusLabel.trim() || !newStatusKey.trim()}
                        className="w-full h-10 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-mono border border-green-500/20"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Создать тип
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'export' && (
                <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-mono text-green-300">{'>'} Экспорт базы</h2>
                    <p className="text-sm text-green-600 font-mono mt-1">{'// '}Выгрузка данных в разные форматы</p>
                  </div>

                  <div className="grid gap-4">
                    {[
                      {
                        type: 'scammers' as const,
                        title: 'Скамеры',
                        desc: 'Полная база скамеров с описаниями, статусами, лайками и метаданными',
                        icon: Database,
                        count: stats?.totalScammers || 0,
                      },
                      {
                        type: 'users' as const,
                        title: 'Пользователи',
                        desc: 'Список всех юзеров с ролями и датами регистрации',
                        icon: Users,
                        count: stats?.totalUsers || 0,
                      },
                      {
                        type: 'submissions' as const,
                        title: 'Заявки',
                        desc: 'Все заявки на добавление скамеров со статусами',
                        icon: FileText,
                        count: stats?.totalSubmissions || 0,
                      },
                    ].map((section) => (
                      <div key={section.type} className="glass rounded-xl p-5 border border-green-500/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <section.icon className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-mono font-semibold text-green-300">{section.title}</h3>
                            <p className="text-[10px] text-green-600 font-mono">{section.count} записей</p>
                          </div>
                        </div>
                        <p className="text-xs text-green-600/80 mb-4">{section.desc}</p>
                        <div className="flex flex-wrap gap-2">
                          <ExportButton type={section.type} format="json" label="JSON" ext=".json" />
                          <ExportButton type={section.type} format="csv" label="CSV (Excel)" ext=".csv" />
                          <ExportButton type={section.type} format="sql" label="SQL" ext=".sql" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 glass rounded-xl p-4 border border-green-500/10 font-mono text-xs">
                    <div className="flex items-center gap-2 mb-2 text-green-600">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      info
                    </div>
                    <div className="space-y-1 text-green-600/80">
                      <p>{'>'} JSON — универсальный формат, можно импортировать в любую систему</p>
                      <p>{'>'} CSV — открывается в Excel, Google Sheets, LibreOffice</p>
                      <p>{'>'} SQL — INSERT-запросы для PostgreSQL, полезно для бэкапа/миграции</p>
                      <p>{'>'} Все файлы скачиваются автоматически в браузере</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Edit Scammer Modal */}
      <AnimatePresence>
        {editScammer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setEditScammer(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md glass rounded-2xl p-6 border border-green-500/20 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold text-green-300">Редактировать</h3>
                <button onClick={() => setEditScammer(null)} className="p-1 rounded hover:bg-green-500/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Имя</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Описание</label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono min-h-[60px]" />
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Статус</label>
                  <div className="flex flex-wrap gap-2">
                    {statusTypes.length > 0 ? statusTypes.map((st) => (
                      <button
                        key={st.key}
                        onClick={() => setEditStatus(st.key)}
                        className="px-3 py-1.5 rounded-lg font-mono text-xs border transition-all"
                        style={{
                          backgroundColor: editStatus === st.key ? st.color + '33' : st.color + '11',
                          color: st.textColor,
                          borderColor: editStatus === st.key ? st.color + '77' : st.color + '33',
                        }}
                      >
                        {editStatus === st.key && '✓ '}{st.label}
                      </button>
                    )) : (
                      <span className="text-xs text-green-600 font-mono">Загрузка...</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Количество поисков</label>
                  <Input
                    type="number"
                    value={editSearchCount}
                    onChange={(e) => setEditSearchCount(parseInt(e.target.value) || 0)}
                    className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Тип</label>
                  <div className="flex gap-2">
                    {['', 'Бот', 'Человек'].map((t) => (
                      <button key={t} type="button" onClick={() => setEditScammerType(t)}
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all ${
                          editScammerType === t ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-green-500/10 text-green-600 hover:text-green-400'
                        }`}>
                        {t || 'Не указан'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Дата добавления</label>
                  <Input placeholder="10.03.2026" value={editScamDate} onChange={(e) => setEditScamDate(e.target.value)}
                    className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Ссылка на доказательство</label>
                  <Input placeholder="https://t.me/..." value={editProofLink} onChange={(e) => setEditProofLink(e.target.value)}
                    className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                </div>
                <div>
                  <label className="text-xs font-mono text-green-600 mb-1 block">Telegram User ID</label>
                  <Input placeholder="8393190771" value={editTelegramUserId} onChange={(e) => setEditTelegramUserId(e.target.value)}
                    className="h-10 rounded-lg bg-green-500/5 border-green-500/20 text-green-300 font-mono focus:border-green-500/40" />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpdateScammer} className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-mono rounded-lg">
                    Сохранить
                  </Button>
                  <Button onClick={() => setEditScammer(null)} variant="outline" className="h-10 border-green-500/20 text-green-400 font-mono rounded-lg">
                    Отмена
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revision Reason Modal */}
      <AnimatePresence>
        {revisionSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setRevisionSub(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md glass rounded-2xl p-6 border border-yellow-500/20 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold text-yellow-300">Причина доработки</h3>
                <button onClick={() => setRevisionSub(null)} className="p-1 rounded hover:bg-yellow-500/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <Textarea
                placeholder="Опишите что нужно исправить..."
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                className="rounded-lg bg-yellow-500/5 border-yellow-500/20 text-yellow-200 font-mono min-h-[80px] mb-3"
              />

              <Button
                onClick={() => handleSubmissionAction(revisionSub.id, 'revision', revisionReason)}
                disabled={!revisionReason.trim()}
                className="w-full h-10 bg-yellow-600 hover:bg-yellow-700 text-white font-mono rounded-lg"
              >
                Отправить на доработку
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject with Reason Modal */}
      <AnimatePresence>
        {rejectSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectSub(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md glass rounded-2xl p-6 border border-red-500/20 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold text-red-300">Причина отклонения</h3>
                <button onClick={() => setRejectSub(null)} className="p-1 rounded hover:bg-red-500/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <Textarea
                placeholder="Опишите причину отклонения заявки..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-lg bg-red-500/5 border-red-500/20 text-red-200 font-mono min-h-[80px] mb-3"
              />

              <Button
                onClick={() => handleSubmissionAction(rejectSub.id, 'rejected', rejectReason)}
                disabled={!rejectReason.trim()}
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-mono rounded-lg"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Отклонить
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ban User Modal */}
      <AnimatePresence>
        {banModalUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setBanModalUser(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md glass rounded-2xl p-6 border border-red-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold text-red-300">Забанить {banModalUser.username}</h3>
                <button onClick={() => setBanModalUser(null)} className="p-1 rounded hover:bg-red-500/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-green-600 font-mono mb-3">Укажите причину бана:</p>
              <Textarea
                placeholder="Причина бана..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="rounded-lg bg-red-500/5 border-red-500/20 text-red-200 font-mono min-h-[80px] mb-4"
              />

              <Button
                onClick={() => handleBanUser(banModalUser.id, banReason)}
                disabled={!banReason.trim()}
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-mono rounded-lg"
              >
                Забанить
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags Modal */}
      <AnimatePresence>
        {tagsModalUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setTagsModalUser(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md glass rounded-2xl p-6 border border-yellow-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-bold text-yellow-300">Теги — {tagsModalUser.username}</h3>
                <button onClick={() => setTagsModalUser(null)} className="p-1 rounded hover:bg-yellow-500/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Existing tags */}
              {userTags.length > 0 && (
                <div className="space-y-2 mb-4">
                  {userTags.map(tag => (
                    <div key={tag.id} className="flex items-center justify-between glass rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: tag.color,
                            color: tag.textColor,
                            boxShadow: tag.sparkly ? `0 0 8px ${tag.color}80` : 'none',
                          }}
                        >
                          {tag.sparkly && <span className="mr-0.5">✨</span>}
                          {tag.text}
                        </span>
                        <div className="flex gap-1.5">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: tag.color }} title="Цвет фона" />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: tag.textColor }} title="Цвет текста" />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new tag */}
              <div className="space-y-3">
                <p className="text-[10px] text-green-600 font-mono">Добавить тег:</p>
                <Input
                  placeholder="Текст тега..."
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value.slice(0, 30))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  className="rounded-lg bg-yellow-500/5 border-yellow-500/20 text-yellow-200 font-mono text-sm"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-green-600 font-mono">Фон</label>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-green-500/20 bg-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-green-600 font-mono">Текст</label>
                    <input
                      type="color"
                      value={newTagTextColor}
                      onChange={(e) => setNewTagTextColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-green-500/20 bg-transparent"
                    />
                  </div>
                  <button
                    onClick={() => setNewTagSparkly(!newTagSparkly)}
                    className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg transition-colors ${
                      newTagSparkly ? 'bg-yellow-500/20 text-yellow-300' : 'text-green-600 hover:text-yellow-300'
                    }`}
                  >
                    ✨ Блеск
                  </button>
                </div>
                {newTagText.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-600 font-mono">Предпросмотр:</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: newTagColor,
                        color: newTagTextColor,
                        boxShadow: newTagSparkly ? `0 0 8px ${newTagColor}80` : 'none',
                      }}
                    >
                      {newTagSparkly && <span className="mr-0.5">✨</span>}
                      {newTagText.trim()}
                    </span>
                  </div>
                )}
                <Button
                  onClick={handleCreateTag}
                  disabled={!newTagText.trim()}
                  className="w-full h-10 bg-yellow-600 hover:bg-yellow-700 text-white font-mono rounded-lg text-sm"
                >
                  Добавить тег
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name History Modal */}
      <NameHistoryModal
        scammer={nameHistoryScammer}
        onClose={function closeHist() { setNameHistoryScammer(null) }}
        onRollback={function afterRollback() { loadScammers(scammerPage, scammerSearch) }}
      />
    </div>
  )
}
