import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') return null
  return session.user
}

function escCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const s = String(val).replace(/"/g, '""')
  return `"${s}"`
}

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'json').toLowerCase()
    const type = searchParams.get('type') || 'scammers' // scammers, users, submissions

    if (type === 'users') {
      const users = await db.user.findMany({ orderBy: { createdAt: 'desc' } })
      const data = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        banReason: u.banReason || '',
        createdAt: u.createdAt.toISOString(),
      }))

      if (format === 'csv') {
        const header = 'ID,Имя,Роль,Причина бана,Дата регистрации'
        const rows = data.map(r =>
          `${escCSV(r.id)},${escCSV(r.username)},${escCSV(r.role)},${escCSV(r.banReason)},${escCSV(r.createdAt)}`
        )
        const csv = '\uFEFF' + [header, ...rows].join('\n')
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="scambase_users_${Date.now()}.csv"`,
          },
        })
      }

      if (format === 'sql') {
        const sql = generateSQL('User', data, ['id', 'username', 'role', 'banReason'])
        return new NextResponse(sql, {
          headers: {
            'Content-Type': 'application/sql',
            'Content-Disposition': `attachment; filename="scambase_users_${Date.now()}.sql"`,
          },
        })
      }

      return NextResponse.json(data, {
        headers: {
          'Content-Disposition': `attachment; filename="scambase_users_${Date.now()}.json"`,
        },
      })
    }

    if (type === 'submissions') {
      const subs = await db.submission.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true } } },
      })
      const data = subs.map((s: any) => ({
        id: s.id,
        scammerName: s.scammerName,
        scammerData: s.scammerData || '',
        telegramUserId: s.telegramUserId || '',
        status: s.status,
        revisionReason: s.revisionReason || '',
        username: s.user?.username || '',
        createdAt: s.createdAt.toISOString(),
      }))

      if (format === 'csv') {
        const header = 'ID,Имя скамера,Данные,Telegram ID,Статус,Причина ревью,Юзер,Дата'
        const rows = data.map(r =>
          `${escCSV(r.id)},${escCSV(r.scammerName)},${escCSV(r.scammerData)},${escCSV(r.telegramUserId)},${escCSV(r.status)},${escCSV(r.revisionReason)},${escCSV(r.username)},${escCSV(r.createdAt)}`
        )
        const csv = '\uFEFF' + [header, ...rows].join('\n')
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="scambase_submissions_${Date.now()}.csv"`,
          },
        })
      }

      if (format === 'sql') {
        const sql = generateSQL('Submission', data, ['id', 'scammerName', 'scammerData', 'telegramUserId', 'status', 'revisionReason', 'userId'])
        return new NextResponse(sql, {
          headers: {
            'Content-Type': 'application/sql',
            'Content-Disposition': `attachment; filename="scambase_submissions_${Date.now()}.sql"`,
          },
        })
      }

      return NextResponse.json(data, {
        headers: {
          'Content-Disposition': `attachment; filename="scambase_submissions_${Date.now()}.json"`,
        },
      })
    }

    // Default: scammers
    const scammers = await db.scammer.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const data = scammers.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: (s.description || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n'),
      status: s.status,
      searchCount: s.searchCount,
      likeCount: s.likeCount ?? 0,
      dislikeCount: s.dislikeCount ?? 0,
      scammerType: s.scammerType || '',
      scamDate: s.scamDate || '',
      proofLink: s.proofLink || '',
      telegramUserId: s.telegramUserId || '',
      createdBy: s.createdBy || '',
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    if (format === 'csv') {
      const header = 'ID,Имя,Описание,Статус,Поисков,Лайки,Дизлайки,Тип,Дата скама,Доказательство,Telegram ID,Кто добавил,Дата создания,Дата обновления'
      const rows = data.map(r =>
        `${escCSV(r.id)},${escCSV(r.name)},${escCSV(r.description)},${escCSV(r.status)},${r.searchCount},${r.likeCount},${r.dislikeCount},${escCSV(r.scammerType)},${escCSV(r.scamDate)},${escCSV(r.proofLink)},${escCSV(r.telegramUserId)},${escCSV(r.createdBy)},${escCSV(r.createdAt)},${escCSV(r.updatedAt)}`
      )
      const csv = '\uFEFF' + [header, ...rows].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="scambase_scammers_${Date.now()}.csv"`,
        },
      })
    }

    if (format === 'sql') {
      const sql = generateSQL('Scammer', data, [
        'id', 'name', 'description', 'status', 'searchCount', 'likeCount',
        'dislikeCount', 'scammerType', 'scamDate', 'proofLink', 'telegramUserId',
        'createdBy',
      ])
      return new NextResponse(sql, {
        headers: {
          'Content-Type': 'application/sql',
          'Content-Disposition': `attachment; filename="scambase_scammers_${Date.now()}.sql"`,
        },
      })
    }

    // JSON
    return NextResponse.json(data, {
      headers: {
        'Content-Disposition': `attachment; filename="scambase_scammers_${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 })
  }
}

function generateSQL(table: string, rows: Record<string, unknown>[], fields: string[]): string {
  const now = new Date().toISOString()
  let sql = `-- ScamBase export: ${table}\n-- Generated: ${now}\n-- Records: ${rows.length}\n\n`
  sql += `-- WARNING: Review before executing. IDs may conflict with existing data.\n\n`

  for (const row of rows) {
    const cols: string[] = []
    const vals: string[] = []
    for (const f of fields) {
      const v = row[f]
      if (v === undefined || v === null || v === '') continue
      if (f === 'id') {
        cols.push(f)
        vals.push(`'${v}'`)
      } else if (typeof v === 'number') {
        cols.push(f)
        vals.push(String(v))
      } else {
        cols.push(f)
        vals.push(`E'${String(v).replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`)
      }
    }
    if (cols.length > 0) {
      sql += `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});\n`
    }
  }

  sql += `\n-- End of export. ${rows.length} records.\n`
  return sql
}
