import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// One-time migration: create ScammerStatus table + seed defaults + add telegramUserId to Submission
export async function POST(req: NextRequest) {
  try {
    // Auth check — only admins can run migrations
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    const userRole = (session.user as { role?: string }).role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }
    // 0. Add telegramUserId column to Submission table if not exists
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "telegramUserId" TEXT NOT NULL DEFAULT '';
      `)
    } catch (e) {
      // Column might already exist
    }

    // 0b. Add scammerStatus column to Submission table if not exists
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "scammerStatus" TEXT NOT NULL DEFAULT 'scam';
      `)
    } catch (e) {
      // Column might already exist
    }

    // 1. Create ScammerStatus table if not exists
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ScammerStatus" (
          "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
          "key" TEXT NOT NULL UNIQUE,
          "label" TEXT NOT NULL,
          "color" TEXT NOT NULL DEFAULT '#6b7280',
          "textColor" TEXT NOT NULL DEFAULT '#ffffff',
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "isDefault" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
        );
      `)
    } catch (e) {
      // Table might already exist
    }

    // 2. Seed default statuses only if table is empty
    const existing = await db.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "ScammerStatus"`) as any[]
    if (existing[0]?.cnt === 0) {
      await db.$executeRawUnsafe(`
        INSERT INTO "ScammerStatus" ("key", "label", "color", "textColor", "sortOrder", "isDefault") VALUES
        ('scam', 'СКАМ', '#ef4444', '#ffffff', 0, true),
        ('verified', 'Проверен', '#22c55e', '#ffffff', 1, true),
        ('suspicious', 'Подозрительный', '#f59e0b', '#ffffff', 2, true),
        ('not_in_db', 'Нет в базе', '#6b7280', '#ffffff', 3, true),
        ('unverified', 'Не проверен', '#3b82f6', '#ffffff', 4, true);
      `)
    }

    // 3. Clean descriptions — replace literal \r\n with actual newlines
    const scammers = await db.scammer.findMany({
      select: { id: true, description: true },
    })

    let cleaned = 0
    for (const s of scammers) {
      if (!s.description) continue
      const fixed = s.description
        .replace(/\\r\\n/g, '\n')
        .replace(/\\r/g, '\n')
        .replace(/\\n/g, '\n')
      if (fixed !== s.description) {
        await db.scammer.update({
          where: { id: s.id },
          data: { description: fixed },
        })
        cleaned++
      }
    }

    // 4. Populate telegramUserId from SQL dump
    const sqlMapping: Record<string, string> = {
      'StarsHalal_bot': '8393190771', 'CatStarssRobot': '8295648239', 'GameUGSbot': '7621307264',
      'tgpiarcom_bot': '8363372624', 'free_starssbot': '7820022987', 'Interesboy': '6416047359',
      'losslyy_giftsbot': '8502049742', 'nftscrapbot': '8397737593', 'erronstars_bot': '8424410928',
      'Duroovestarz_bot': '8264784324', 'StarsovEarnBot': '7974361539', 'xoLdyNFT': '8132947527',
      'WhiteStarXBot': '8310247094', 'lousinq': '7443994249', 'heIlsin': '7285263751',
      'MorZam1I': '6979936129', 'zyvarix': '6525712678', 'starsborzbot': '8507730481',
      'на момент публикации юз бил удален': '8256626106', 'krutoi_772': '8267957997',
      'm3ws_u': '6969239276', 'Heti_s': '1954350124', 'nasvoy': '2455004',
      'pashagift_bot': '8260936010', 'qqmmm7': '7435616661', 'Fix_refersbot': '8125475564',
      'poctik6': '6902856088', 'Paketiktravi': '1780294359', 'roman777temki': '8255637412',
      'Crackerstars_bot': '8252203704', 'farmakast_bot': '8554442156', 'Hayrapetyan1122': '8113710507',
      'hjkazvvv': '8261183869', 'sasha_08201': '7328854533', 'druun1': '6639931676',
      'GiftLouder': '8041010655', 'ROOKLRT': '8068978802', 'нету на момент добавления': '8592499178',
      'STEWIEGRIFINS': '7039509059', 'dmacalister777': '8153381436', 'tghuliganov': '8133534057',
      'SuboGiftsBot': '8473188448', 'starsovik777bot': '7902041061', 'Snegorita': '8507081547',
      'andrew_adminos': '7541254645', 'imgerpDZ': '5774018491', 'starsovoybot': '7711385218',
      'sqouw': '7656478405', 'swagbagkillstrongman': '7735430806', 'WansRef_bot': '8096856445',
      'ToMineeBot': '7632611386', 'StarsMiningBot': '8035675361', 'giftportugalets_bot': '8124880153',
      'topilonda': '6045326018', 'Gg98737': '8109589822', 'Vampipro': '2017175774',
      'rbx_queeen': '8267905208', 'Ish1ka1': '1074703005', 'herobreen': '8068504064',
      'nunoa_1': '6128311696', 'afinukade': '1866526809', 'RefoCheckBot': '8433448555',
      'offline2470': '7992130351', 'unbrokenstaff': '7669601741', 'Senkonft': '8440441574',
      'heisenberg_guarant': '7075832024', 'unversiay': '8488604612', 'Lynne_1_2': '8230944540',
      'white_krik': '8598063125', 'Molopn1': '5984888436', 'Satty71': '611453786',
      'Tajikkivb': '7891123962', 'quuev': '1992237076', 'caturov': '594842488',
      'qweniznm': '7391456379', 'trozb': '204949466', 'Laysik_Laysikov': '7674435738',
      'budabonus_bot': '6487610825', 'KukiGiftBot': '8599218427', 'magicbyt_bot': '6519384844',
      'osoisuhhgg': '8706546536', 'cexonov': '8128381503', 'Lox2281425': '1154462529',
      'Garant_A44': '8768633549', 'wogov': '88579442', 'trakovkm': '7236225826',
      'skoehxn69': '6922287256', 'KitanIovee': '8027939866', 'korka021': '8433304843',
      'RemakeCash': '8486355509', 'Mercillesov': '7096435385', 'hororovas': '840847830',
      'ZomBeStarsbot': '8242190604', 'AfganBogKm': '8380605835', 'нету': '153520957',
      'evgeniabest37': '8554725781', 'FunPayDeaIbot': '8354762161', 'нету1': '8554592074',
      'нету2': '7726012311', 'literally00': '1431994259', 'mkalove': '8738848738',
    }

    let tgUpdated = 0
    for (const [name, tgId] of Object.entries(sqlMapping)) {
      const scammer = await db.scammer.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      })
      if (scammer && (!scammer.telegramUserId || scammer.telegramUserId === '')) {
        await db.scammer.update({
          where: { id: scammer.id },
          data: { telegramUserId: tgId },
        })
        tgUpdated++
      }
    }

    return NextResponse.json({
      success: true,
      descriptionsCleaned: cleaned,
      telegramUserIdsPopulated: tgUpdated,
      totalScammers: scammers.length,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 })
  }
}
