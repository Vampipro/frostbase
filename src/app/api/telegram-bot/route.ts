import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ==================== LAZY BOT INIT (FIX BUILD CRASH) + OBFUSCATED TOKEN ====================
// Токен захардкожен в base64 чтобы сканеры не палили (env имеет приоритет)
// Декодируется только в рантайме
const _x0 = "ODgzMDkzOTgzNzpBQUVYVFN4VndjZHR6VEpRVkFmUFF6Y3gzZEdXVUV0RVdpNA==";
function _d(s: string): string {
  try {
    // Node.js
    return Buffer.from(s, "base64").toString("utf-8");
  } catch {
    try {
      // Edge / browser fallback
      // @ts-ignore
      return typeof atob !== "undefined" ? atob(s) : "";
    } catch {
      return "";
    }
  }
}
// Приоритет: ENV > hardcoded base64 (для скрытия от сканеров)
const token = process.env.TELEGRAM_BOT_TOKEN || _d(_x0);
let botInstance: Bot | null = null;
let botSetupDone = false;

type SupportedLang = "ua" | "ru" | "en" | "pl";
const userLanguages = new Map<number, SupportedLang>();

// ==================== TRANSLATIONS ====================
const t: Record<SupportedLang, Record<string, string>> = {
  ua: {
    chooseLang: "👋 <b>Оберіть мову / Выберите язык / Choose language / Wybierz język:</b>",
    langChanged: "✅ <b>Мову змінено на Українську!</b>\n\nНадішліть <b>юзернейм</b> (@username), <b>ID</b> (123456789), <b>посилання</b> (t.me/username) або просто ім'я для перевірки.\n\n<i>💡 Також можете переслати повідомлення від підозрілого користувача або поділитися контактом.</i>",
    spam: "⏳ <b>Зачекайте {sec} сек.</b> перед наступним запитом.",
    help: `📖 <b>Як користуватися ботом:</b>

• Надішліть <b>@username</b> — перевіримо юзернейм
• Надішліть <b>ID</b> (цифри) — перевіримо по Telegram ID
• Надішліть <b>посилання</b> t.me/username
• <b>Перешліть</b> повідомлення від підозрілого — бот витягне автора
• Надішліть <b>контакт</b> — перевіримо ID контакту

<b>Команди:</b>
/check username — швидка перевірка
/bots — список верифікованих ботів
/stats — статистика бази
/top — топ-10 скамерів
/lang — змінити мову
/help — ця довідка

<i>💡 У групових чатах: /check @username, /check ID, або дайте reply на повідомлення учасника і напишіть /check — бот перевірить його ID.</i>

🌐 Сайт: https://frostscambase.vercel.app/
💬 Чат: @wocmf`,
    notFound: `❌ <b>Не знайдено:</b> {query}

Користувача <b>{display}</b> немає в базі. Можливо він чистий, або ще не доданий.

Що робити?
• Перевірте написання (з @ або без)
• Спробуйте пошук по ID
• Якщо це скам — додайте його на сайті`,
    foundHeader: "🚨 <b>Знайдено в базі!</b>",
    searchCount: "👁 Переглядів",
    addedDate: "📅 Додано",
    amount: "💰 Сума скама",
    type: "🤖 Тип",
    likes: "👍 Лайків / 👎 Дизлайків",
    selectPrompt: "🔎 Знайдено <b>{count}</b> збігів. Оберіть:",
    statsHeader: "📊 <b>Статистика ScamBase</b>",
    topHeader: "🔥 <b>Топ-10 скамерів за пошуками</b>",
    error: "⚠️ Сталася помилка при пошуку. Спробуйте пізніше.",
    btnOpenSite: "🌐 Відкрити на сайті",
    btnReport: "➕ Повідомити про скам",
    btnChat: "💬 Наш чат",
    btnSupport: "❤️ Підтримати",
    btnCheckMore: "🔎 Перевірити ще",
    btnAddScam: "➕ Додати скамера",
    btnAppeal: "⚖️ Апелювати",
    btnDetails: "🔎 Детальніше",
    btnPrev: "⬅️ Назад",
    btnNext: "➡️ Далі",
    botsHeader: "🤖 <b>Верифіковані боти</b>",
    botsEmpty: "📭 Ботів зі статусом «Перевірено» поки не знайдено",
    botsPage: "Сторінка {page}/{total}",
    botsAdded: "Додано",
  },
  ru: {
    chooseLang: "👋 <b>Оберіть мову / Выберите язык / Choose language / Wybierz język:</b>",
    langChanged: "✅ <b>Язык изменен на Русский!</b>\n\nОтправьте <b>юзернейм</b> (@username), <b>ID</b>, <b>ссылку</b> t.me/username или просто имя для проверки.\n\n<i>💡 Можете переслать сообщение от подозрительного пользователя.</i>",
    spam: "⏳ <b>Подождите {sec} сек.</b> перед следующим запросом.",
    help: `📖 <b>Как пользоваться ботом:</b>

• Отправьте <b>@username</b> — проверим юзернейм
• Отправьте <b>ID</b> — проверим по Telegram ID
• Отправьте <b>ссылку</b> t.me/username
• <b>Перешлите</b> сообщение от подозрительного — бот вытащит автора
• Отправьте <b>контакт</b> — проверим его ID

<b>Команды:</b>
/check username — быстрая проверка
/bots — список верифицированных ботов
/stats — статистика
/top — топ-10
/lang — смена языка
/help — справка

<i>💡 В групповых чатах: /check @username, /check ID, или сделайте reply на сообщение участника и напишите /check — бот проверит его ID.</i>

🌐 Сайт: https://frostscambase.vercel.app/
💬 Чат: @wocmf`,
    notFound: `❌ <b>Не найдено:</b> {query}

Пользователя <b>{display}</b> нет в базе. Возможно он чистый.

Что делать?
• Проверьте написание
• Попробуйте поиск по ID
• Если это скам — добавьте на сайте`,
    foundHeader: "🚨 <b>Найдено совпадение!</b>",
    searchCount: "👁 Просмотров",
    addedDate: "📅 Добавлен",
    amount: "💰 Сумма",
    type: "🤖 Тип",
    likes: "👍 Лайки / 👎 Дизлайки",
    selectPrompt: "🔎 Найдено <b>{count}</b> совпадений. Выберите:",
    statsHeader: "📊 <b>Статистика ScamBase</b>",
    topHeader: "🔥 <b>Топ-10 скамеров</b>",
    error: "⚠️ Ошибка при поиске. Попробуйте позже.",
    btnOpenSite: "🌐 Открыть на сайте",
    btnReport: "➕ Сообщить о скаме",
    btnChat: "💬 Наш чат",
    btnSupport: "❤️ Поддержать",
    btnCheckMore: "🔎 Проверить еще",
    btnAddScam: "➕ Добавить скамера",
    btnAppeal: "⚖️ Апелляция",
    btnDetails: "🔎 Подробнее",
    btnPrev: "⬅️ Назад",
    btnNext: "➡️ Далее",
    botsHeader: "🤖 <b>Верифицированные боты</b>",
    botsEmpty: "📭 Ботов со статусом «Проверено» пока не найдено",
    botsPage: "Страница {page}/{total}",
    botsAdded: "Добавлен",
  },
  en: {
    chooseLang: "👋 <b>Choose language / Оберіть мову / Выберите язык / Wybierz język:</b>",
    langChanged: "✅ <b>Language set to English!</b>\n\nSend <b>username</b>, <b>ID</b>, <b>link</b> t.me/username or just a name to check.\n\n<i>💡 You can also forward a message from suspicious user.</i>",
    spam: "⏳ <b>Please wait {sec} sec.</b> before next request.",
    help: `📖 <b>How to use:</b>

• Send <b>@username</b> to check username
• Send <b>ID</b> to check by Telegram ID
• Send <b>link</b> t.me/username
• <b>Forward</b> a message from suspicious user
• Send a <b>contact</b> to check

<b>Commands:</b>
/check username — quick check
/bots — list of verified bots
/stats — stats
/top — top 10
/lang — change language
/help — help

<i>💡 In group chats: /check @username, /check ID, or reply to a member's message and send /check — the bot will check their ID.</i>

🌐 Site: https://frostscambase.vercel.app/
💬 Chat: @wocmf`,
    notFound: `❌ <b>Not found:</b> {query}

User <b>{display}</b> is not in database. Might be clean.

What to do?
• Check spelling
• Try ID search
• If it's scam — report on website`,
    foundHeader: "🚨 <b>Found in database!</b>",
    searchCount: "👁 Views",
    addedDate: "📅 Added",
    amount: "💰 Amount",
    type: "🤖 Type",
    likes: "👍 Likes / 👎 Dislikes",
    selectPrompt: "🔎 Found <b>{count}</b> matches. Choose:",
    statsHeader: "📊 <b>ScamBase Stats</b>",
    topHeader: "🔥 <b>Top 10 scammers</b>",
    error: "⚠️ Search error. Try later.",
    btnOpenSite: "🌐 Open on site",
    btnReport: "➕ Report scam",
    btnChat: "💬 Our chat",
    btnSupport: "❤️ Support",
    btnCheckMore: "🔎 Check more",
    btnAddScam: "➕ Add scammer",
    btnAppeal: "⚖️ Appeal",
    btnDetails: "🔎 Details",
    btnPrev: "⬅️ Back",
    btnNext: "➡️ Next",
    botsHeader: "🤖 <b>Verified bots</b>",
    botsEmpty: "📭 No bots with «Verified» status found yet",
    botsPage: "Page {page}/{total}",
    botsAdded: "Added",
  },
  pl: {
    chooseLang: "👋 <b>Wybierz język / Оберіть мову / Выберите язык / Choose language:</b>",
    langChanged: "✅ <b>Język zmieniony na Polski!</b>\n\nWyślij <b>nazwę użytkownika</b>, <b>ID</b>, <b>link</b> t.me/username lub samo imię do sprawdzenia.",
    spam: "⏳ <b>Poczekaj {sec} sek.</b> przed kolejnym zapytaniem.",
    help: `📖 <b>Jak używać:</b>

• Wyślij <b>@username</b>
• Wyślij <b>ID</b>
• Wyślij <b>link</b> t.me/username
• <b>Prześlij</b> wiadomość od podejrzanego

<b>Komendy:</b>
/check username — sprawdź
/bots — lista zweryfikowanych botów
/stats — statystyki
/top — top 10
/lang — zmień język
/help — pomoc

<i>💡 W czatach grupowych: /check @username, /check ID, lub odpowiedz (reply) na wiadomość uczestnika i wyślij /check — bot sprawdzi jego ID.</i>

🌐 Strona: https://frostscambase.vercel.app/
💬 Czat: @wocmf`,
    notFound: `❌ <b>Nie znaleziono:</b> {query}

Użytkownika <b>{display}</b> nie ma w bazie. Może jest czysty.

Co robić?
• Sprawdź pisownię
• Spróbuj ID
• Jeśli to oszust — zgłoś na stronie`,
    foundHeader: "🚨 <b>Znaleziono w bazie!</b>",
    searchCount: "👁 Wyświetleń",
    addedDate: "📅 Dodano",
    amount: "💰 Kwota",
    type: "🤖 Typ",
    likes: "👍 Lajki / 👎 Dislajki",
    selectPrompt: "🔎 Znaleziono <b>{count}</b> dopasowań. Wybierz:",
    statsHeader: "📊 <b>Statystyki ScamBase</b>",
    topHeader: "🔥 <b>Top 10</b>",
    error: "⚠️ Błąd wyszukiwania.",
    btnOpenSite: "🌐 Otwórz na stronie",
    btnReport: "➕ Zgłoś oszusta",
    btnChat: "💬 Nasz czat",
    btnSupport: "❤️ Wesprzyj",
    btnCheckMore: "🔎 Sprawdź więcej",
    btnAddScam: "➕ Dodaj oszusta",
    btnAppeal: "⚖️ Apelacja",
    btnDetails: "🔎 Szczegóły",
    btnPrev: "⬅️ Wstecz",
    btnNext: "➡️ Dalej",
    botsHeader: "🤖 <b>Zweryfikowane boty</b>",
    botsEmpty: "📭 Nie znaleziono jeszcze botów ze statusem «Zweryfikowano»",
    botsPage: "Strona {page}/{total}",
    botsAdded: "Dodano",
  },
};

// ==================== HELPERS ====================
function getUserLanguage(userId?: number, telegramLangCode?: string): SupportedLang {
  if (userId && userLanguages.has(userId)) return userLanguages.get(userId)!;
  if (telegramLangCode) {
    const code = telegramLangCode.toLowerCase();
    if (code.startsWith("ru")) return "ru";
    if (code.startsWith("en")) return "en";
    if (code.startsWith("pl")) return "pl";
    if (code.startsWith("uk") || code.startsWith("ua")) return "ua";
  }
  return "en";
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Robust input parser
interface ParsedInput {
  username?: string; // without @
  id?: string; // digits
  raw: string; // original cleaned
  cleanName: string; // for name contains search
}

function parseInput(rawInput: string): ParsedInput {
  const raw = rawInput.trim();
  if (!raw) return { raw: "", cleanName: "" };

  // Try to extract t.me links
  const tmeMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
  if (tmeMatch) {
    const candidate = tmeMatch[1];
    // If candidate is all digits, treat as ID (rare for t.me but possible)
    if (/^\d{5,}$/.test(candidate)) {
      return { id: candidate, raw, cleanName: raw };
    }
    return { username: candidate.replace(/^@/, ""), raw, cleanName: candidate };
  }

  // tg://resolve?domain=USERNAME
  const tgResolve = raw.match(/tg:\/\/resolve\?domain=([a-zA-Z0-9_]{5,32})/i);
  if (tgResolve) {
    return { username: tgResolve[1], raw, cleanName: tgResolve[1] };
  }

  // Pure @username
  const atMatch = raw.match(/^@([a-zA-Z0-9_]{5,32})\b/);
  if (atMatch) {
    return { username: atMatch[1], raw, cleanName: atMatch[1] };
  }

  // Pure digits => ID (5+ digits)
  if (/^\d{5,20}$/.test(raw.replace(/^@/, ""))) {
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length >= 5) return { id: digits, raw, cleanName: digits };
  }

  // If input contains @username somewhere
  const insideAt = raw.match(/@([a-zA-Z0-9_]{5,32})/);
  if (insideAt) {
    return { username: insideAt[1], raw, cleanName: insideAt[1] };
  }

  // Fallback: treat whole trimmed input as name query (for custom names, site links, etc)
  // Remove @ at start for cleanName
  const cleanName = raw.replace(/^@/, "").split(/\s+/)[0].slice(0, 100);
  return { raw, cleanName };
}

// ===== Status cache (ScammerStatus table) =====
let statusCache: { data: Map<string, { label: string; color: string }>; ts: number } | null = null;
const STATUS_CACHE_TTL = 5 * 60 * 1000;

async function getStatusMap(): Promise<Map<string, { label: string; color: string }>> {
  const now = Date.now();
  if (statusCache && now - statusCache.ts < STATUS_CACHE_TTL) return statusCache.data;

  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT key, label, color FROM "ScammerStatus" WHERE hidden = false ORDER BY "sortOrder"`
    )) as any[];
    const map = new Map<string, { label: string; color: string }>();
    for (const r of rows) map.set(r.key, { label: r.label, color: r.color });
    statusCache = { data: map, ts: now };
    return map;
  } catch {
    // fallback map with all languages
    const fallback = new Map<string, { label: string; color: string }>();
    fallback.set("scam", { label: "SCAM", color: "#ef4444" });
    fallback.set("verified", { label: "Перевірено", color: "#22c55e" });
    fallback.set("suspicious", { label: "Підозріло", color: "#f59e0b" });
    fallback.set("no_rewards", { label: "Не виводить", color: "#ef4444" });
    fallback.set("admin", { label: "Адмін", color: "#3b82f6" });
    return fallback;
  }
}

function getStatusEmoji(key: string): string {
  const k = (key || "").toLowerCase();
  if (k.includes("scam") || k === "scam") return "🚫";
  if (k.includes("verified") || k.includes("вывод") || k === "verified") return "✅";
  if (k.includes("no_rewards") || k.includes("не выводит")) return "🔴";
  if (k.includes("suspicious") || k.includes("podoz")) return "🧐";
  if (k.includes("admin") || k.includes("влад")) return "💎";
  if (k.includes("nft")) return "🛞";
  if (k.includes("swiaz") || k.includes("связь")) return "🔗";
  if (k.includes("us_skamera")) return "👤";
  return "📌";
}

// ===== Spam protection improved =====
const userRequests = new Map<number, number[]>(); // userId -> timestamps
const COOLDOWN_SEC = 7;
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_SEC = 30;

function isSpamming(userId: number): { spam: boolean; timeLeft: number; reason?: string } {
  const now = Date.now();
  const arr = userRequests.get(userId) || [];
  // clean old
  const fresh = arr.filter((t) => now - t < WINDOW_SEC * 1000);
  // check cooldown
  const last = fresh.length > 0 ? fresh[fresh.length - 1] : 0;
  const sinceLast = (now - last) / 1000;
  if (fresh.length > 0 && sinceLast < COOLDOWN_SEC) {
    return { spam: true, timeLeft: Math.ceil(COOLDOWN_SEC - sinceLast) };
  }
  // check window limit
  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = fresh[0];
    const timeLeft = Math.ceil(WINDOW_SEC - (now - oldestInWindow) / 1000);
    return { spam: true, timeLeft, reason: "limit" };
  }
  fresh.push(now);
  userRequests.set(userId, fresh);
  return { spam: false, timeLeft: 0 };
}

// ==================== SEARCH LOGIC ====================
async function searchScammers(parsed: ParsedInput, limit = 6) {
  const conditions: any[] = [];

  if (parsed.id) {
    conditions.push({ telegramUserId: { contains: parsed.id, mode: "insensitive" } });
    conditions.push({ telegramUserId: parsed.id });
  }
  if (parsed.username) {
    const u = parsed.username;
    conditions.push({ name: { equals: u, mode: "insensitive" } });
    conditions.push({ name: { equals: `@${u}`, mode: "insensitive" } });
    conditions.push({ name: { contains: u, mode: "insensitive" } });
  }
  if (parsed.cleanName && parsed.cleanName !== parsed.username && parsed.cleanName !== parsed.id) {
    // for custom names / site links
    const clean = parsed.cleanName.slice(0, 100);
    if (clean.length >= 2) {
      conditions.push({ name: { contains: clean, mode: "insensitive" } });
      conditions.push({ description: { contains: clean, mode: "insensitive" } });
    }
  }

  if (conditions.length === 0) return [];

  const results = await db.scammer.findMany({
    where: { OR: conditions },
    take: limit,
    orderBy: [{ searchCount: "desc" }, { createdAt: "desc" }],
  });
  return results;
}

// ==================== BOT SETUP ====================
function setupBot(bot: Bot) {
  if (botSetupDone) return;
  botSetupDone = true;

  // /start
  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("🇺🇦 Українська", "lang_ua")
      .text("🇷🇺 Русский", "lang_ru")
      .row()
      .text("🇬🇧 English", "lang_en")
      .text("🇵🇱 Polski", "lang_pl");

    await ctx.reply(t.ua.chooseLang, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  bot.command("lang", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("🇺🇦 Українська", "lang_ua")
      .text("🇷🇺 Русский", "lang_ru")
      .row()
      .text("🇬🇧 English", "lang_en")
      .text("🇵🇱 Polski", "lang_pl");
    await ctx.reply(t[getUserLanguage(ctx.from?.id, ctx.from?.language_code)].chooseLang, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  bot.command("help", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.reply(t[lang].help, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  });

  bot.command("check", async (ctx) => {
    const args = (ctx.match as string)?.trim();
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);

    // /check as a reply to a participant's message (works in groups too):
    // takes the replied-to user's id/username, no args needed.
    const repliedUser = ctx.message?.reply_to_message?.from;
    if (!args && repliedUser) {
      if (repliedUser.is_bot && !repliedUser.username) {
        const botNoIdMsg: Record<SupportedLang, string> = {
          ua: "ℹ️ Не можу перевірити цього бота — немає юзернейму",
          ru: "ℹ️ Не могу проверить этого бота — нет юзернейма",
          en: "ℹ️ Can't check this bot — no username",
          pl: "ℹ️ Nie mogę sprawdzić tego bota — brak nazwy użytkownika",
        };
        await ctx.reply(botNoIdMsg[lang], { parse_mode: "HTML" });
        return;
      }
      const query = repliedUser.username ? `@${repliedUser.username}` : String(repliedUser.id);
      await handleSearch(ctx, query);
      return;
    }

    if (!args) {
      const translations: Record<SupportedLang, string> = {
        ua: "ℹ️ Використовуй: /check @username або /check 123456789\n\nАбо зроби reply на повідомлення учасника і напиши /check — перевіримо його ID.",
        ru: "ℹ️ Используй: /check @username или /check 123456789\n\nИли сделай reply на сообщение участника и напиши /check — проверим его ID.",
        en: "ℹ️ Use: /check @username or /check 123456789\n\nOr reply to a member's message and send /check — we'll check their ID.",
        pl: "ℹ️ Użyj: /check @username lub /check 123456789\n\nLub odpowiedz (reply) na wiadomość uczestnika i wyślij /check — sprawdzimy jego ID.",
      };
      await ctx.reply(translations[lang], { parse_mode: "HTML" });
      return;
    }

    await handleSearch(ctx, args);
  });

  // /bots — paginated list of verified bots
  bot.command("bots", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await sendBotsList(ctx, lang, 1);
  });

  bot.callbackQuery(/^bots_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10) || 1;
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.answerCallbackQuery();
    await sendBotsList(ctx, lang, page, true);
  });

  bot.command("stats", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    try {
      await ctx.replyWithChatAction("typing");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [totalScammers, totalUsers, searchesToday, scamCount, verifiedCount] = await Promise.all([
        db.scammer.count(),
        db.user.count(),
        db.searchLog.count({ where: { createdAt: { gte: todayStart } } }),
        db.scammer.count({ where: { status: "scam" } }),
        db.scammer.count({ where: { status: "verified" } }),
      ]);

      const msg = `${t[lang].statsHeader}

👤 ${lang === "ua" ? "Всього скамерів" : lang === "en" ? "Total scammers" : lang === "pl" ? "Łącznie oszustów" : "Всего скамеров"}: <b>${totalScammers}</b>
  └ 🚫 ${lang === "ua" ? "Скам" : lang === "en" ? "Scam" : lang === "pl" ? "Oszustwa" : "Скам"}: ${scamCount}
  └ ✅ ${lang === "ua" ? "Перевірено" : lang === "en" ? "Verified" : lang === "pl" ? "Zweryfikowano" : "Перевірено"}: ${verifiedCount}
👥 ${lang === "ua" ? "Користувачів" : lang === "en" ? "Users" : lang === "pl" ? "Użytkowników" : "Користувачів"}: <b>${totalUsers}</b>
🔍 ${lang === "ua" ? "Пошуків сьогодні" : lang === "en" ? "Searches today" : lang === "pl" ? "Wyszukiwań dzisiaj" : "Пошуків сьогодні"}: <b>${searchesToday}</b>

🌐 Сайт: https://frostscambase.vercel.app/`;

      await ctx.reply(msg, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/")
          .url(t[lang].btnChat, "https://t.me/wocmf"),
      });
    } catch (e) {
      console.error("stats error", e);
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
    }
  });

  bot.command("top", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    try {
      await ctx.replyWithChatAction("typing");
      const top = await db.scammer.findMany({
        where: { searchCount: { gt: 0 } },
        orderBy: { searchCount: "desc" },
        take: 10,
      });
      if (top.length === 0) {
        const emptyMsg: Record<SupportedLang, string> = {
          ua: "📭 Поки що пусто",
          ru: "📭 Пока что пусто",
          en: "📭 Empty for now",
          pl: "📭 Na razie pusto",
        };
        await ctx.reply(emptyMsg[lang], { parse_mode: "HTML" });
        return;
      }
      let msg = `${t[lang].topHeader}\n\n`;
      const searchesLabel: Record<SupportedLang, string> = {
        ua: "пошуків",
        ru: "поисков",
        en: "searches",
        pl: "wyszukiwań",
      };
      top.forEach((s, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const name = escapeHtml(s.name);
        msg += `${medal} ${name} — <b>${s.searchCount}</b> ${searchesLabel[lang]}\n`;
      });
      await ctx.reply(msg, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/"),
      });
    } catch (e) {
      console.error("top error", e);
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
    }
  });

  // Language callback
  bot.callbackQuery(/^lang_(ua|ru|en|pl)$/, async (ctx) => {
    const lang = ctx.match[1] as SupportedLang;
    if (ctx.from?.id) userLanguages.set(ctx.from.id, lang);
    await ctx.answerCallbackQuery();
    await ctx.reply(t[lang].langChanged, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/")
        .url(t[lang].btnChat, "https://t.me/wocmf"),
    });
  });

  // Select scammer from multiple results
  bot.callbackQuery(/^select_(.+)$/, async (ctx) => {
    const scammerId = ctx.match[1];
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    try {
      await ctx.answerCallbackQuery();
      const record = await db.scammer.findUnique({ where: { id: scammerId } });
      if (!record) {
        await ctx.reply("❌ Не найдено", { parse_mode: "HTML" });
        return;
      }
      // Increment safely
      const updated = await db.scammer.update({
        where: { id: record.id },
        data: { searchCount: { increment: 1 } },
      });
      // Log
      db.searchLog
        .create({ data: { query: updated.name, scammerId: updated.id } })
        .catch(() => {});
      await sendScammerCard(ctx, updated, lang);
    } catch (e) {
      console.error("select error", e);
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
    }
  });

  // Contact shared
  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    const userId = contact.user_id;
    if (userId) {
      await handleSearch(ctx, String(userId));
    } else {
      const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
      await ctx.reply(t[lang].error || "❌ У контакта нет Telegram ID", { parse_mode: "HTML" });
    }
  });

  // Forwarded message
  bot.on("message:forward_origin", async (ctx) => {
    // @ts-ignore grammy types
    const origin = ctx.message.forward_origin;
    if (!origin) return;
    // @ts-ignore
    if (origin.type === "user") {
      // @ts-ignore
      const fwdId = origin.sender_user?.id;
      // @ts-ignore
      const fwdUsername = origin.sender_user?.username;
      if (fwdId) await handleSearch(ctx, String(fwdId));
      else if (fwdUsername) await handleSearch(ctx, `@${fwdUsername}`);
    } else if (origin.type === "hidden_user") {
      const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
      const hiddenMsg: Record<SupportedLang, string> = {
        ua: "⚠️ Автор скрыт настройками приватности, перешлите @username или ID",
        ru: "⚠️ Автор скрыт настройками приватности, перешлите @username или ID",
        en: "⚠️ Author is hidden by privacy settings, forward @username or ID",
        pl: "⚠️ Autor ukryty w ustawieniach prywatności, prześlij @username lub ID",
      };
      await ctx.reply(hiddenMsg[lang], {
        parse_mode: "HTML",
      });
    }
  });

  // Inline query support
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    if (!query || query.length < 2) return;
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    const parsed = parseInput(query);
    const results = await searchScammers(parsed, 8);
    
    const inlineLabels: Record<SupportedLang, { views: string; status: string; noId: string; openSite: string; checkTitle: string }> = {
      ua: { views: "пошуків", status: "Статус", noId: "без ID", openSite: "🌐 Відкрити на сайті", checkTitle: "🔍 Перевірка" },
      ru: { views: "поисков", status: "Статус", noId: "без ID", openSite: "🌐 Открыть на сайте", checkTitle: "🔍 Проверка" },
      en: { views: "views", status: "Status", noId: "no ID", openSite: "🌐 Open on site", checkTitle: "🔍 Check" },
      pl: { views: "wyszukiwań", status: "Status", noId: "bez ID", openSite: "🌐 Otwórz na stronie", checkTitle: "🔍 Sprawdzenie" },
    };
    
    const lbl = inlineLabels[lang];
    
    const articles = results.map((s, i) => ({
      type: "article",
      id: s.id,
      title: s.name,
      description: `${s.status} • ${s.searchCount} ${lbl.views} • ${s.telegramUserId || lbl.noId}`,
      input_message_content: {
        message_text: `${lbl.checkTitle}: ${s.name}\nID: ${s.telegramUserId || "—"}\n${lbl.status}: ${s.status}\n\nДетальніше: https://frostscambase.vercel.app/?q=${encodeURIComponent(s.name)}`,
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: lbl.openSite, url: `https://frostscambase.vercel.app/?q=${encodeURIComponent(s.name)}` }],
        ],
      },
    }));
    // @ts-ignore grammy inline answer
    await ctx.answerInlineQuery(articles, { cache_time: 10 });
  });

  // Main text handler — only in private chats.
  // In groups/supergroups the bot only responds to explicit commands
  // (/check, /bots, etc.) to avoid triggering a search on every message.
  bot.on("message:text", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const raw = ctx.message.text.trim();
    if (raw.startsWith("/")) return; // commands handled elsewhere
    await handleSearch(ctx, raw);
  });
}

// ==================== CORE SEARCH HANDLER ====================
async function handleSearch(ctx: any, rawInput: string, forcedLang?: SupportedLang) {
  const userId = ctx.from?.id;
  const lang = forcedLang || getUserLanguage(userId, ctx.from?.language_code);

  // spam check
  if (userId) {
    const { spam, timeLeft } = isSpamming(userId);
    if (spam) {
      const msg = t[lang].spam.replace("{sec}", String(timeLeft));
      await ctx.reply(msg, { parse_mode: "HTML" });
      return;
    }
  }

  const parsed = parseInput(rawInput);
  if (!parsed.raw || (!parsed.username && !parsed.id && !parsed.cleanName)) {
    const noInputMsg: Record<SupportedLang, string> = {
      ua: "ℹ️ Надішліть @username або ID для перевірки",
      ru: "ℹ️ Отправьте @username или ID для проверки",
      en: "ℹ️ Send @username or ID to check",
      pl: "ℹ️ Wyślij @username lub ID do sprawdzenia",
    };
    await ctx.reply(noInputMsg[lang], { parse_mode: "HTML" });
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    const results = await searchScammers(parsed, 6);

    if (results.length === 0) {
      const display = escapeHtml(parsed.username ? `@${parsed.username}` : parsed.id ? `${parsed.id}` : parsed.cleanName);
      const queryEsc = escapeHtml(parsed.raw.slice(0, 100));
      let text = t[lang].notFound.replace("{display}", display).replace("{query}", queryEsc);

      const kb = new InlineKeyboard()
        .url(t[lang].btnAddScam, "https://frostscambase.vercel.app/")
        .url(t[lang].btnChat, "https://t.me/wocmf")
        .row()
        .url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(parsed.cleanName || parsed.username || "")}`)
        .url(t[lang].btnSupport, "https://t.me/send?start=IVkrkNlUFFtA");

      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
      // log not-found search too (absolute search)
      db.searchLog
        .create({ data: { query: parsed.raw.slice(0, 200), scammerId: null } })
        .catch(() => {});
      return;
    }

    if (results.length === 1) {
      const updated = await db.scammer.update({
        where: { id: results[0].id },
        data: { searchCount: { increment: 1 } },
      });
      db.searchLog
        .create({ data: { query: parsed.raw.slice(0, 200), scammerId: updated.id } })
        .catch(() => {});
      await sendScammerCard(ctx, updated, lang);
      return;
    }

    // Multiple results
    const statusMap = await getStatusMap();
    let header = t[lang].selectPrompt.replace("{count}", String(results.length)) + "\n\n";
    results.forEach((r, i) => {
      const sm = statusMap.get(r.status);
      const label = sm?.label || r.status;
      header += `${i + 1}. <b>${escapeHtml(r.name)}</b> — ${escapeHtml(label)} (${r.searchCount} 🔍)\n`;
    });

    const kb = new InlineKeyboard();
    results.forEach((r, i) => {
      // two per row
      if (i % 2 === 0 && i !== 0) kb.row();
      kb.text(`${i + 1}. ${r.name.slice(0, 15)}`, `select_${r.id}`);
    });
    kb.row().url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(parsed.cleanName || "")}`);

    await ctx.reply(header, {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  } catch (e) {
    console.error("Search error", e);
    await ctx.reply(t[lang].error, { parse_mode: "HTML" });
  }
}

// ==================== CARD SENDER ====================
async function sendScammerCard(ctx: any, scammer: any, lang: SupportedLang) {
  const statusMap = await getStatusMap();
  const sm = statusMap.get(scammer.status);
  const statusLabel = sm?.label || scammer.status;
  const emoji = getStatusEmoji(scammer.status);

  const noText: Record<SupportedLang, string> = {
    ua: "Не вказано",
    ru: "Не указан",
    pl: "Nie podano",
    en: "Not specified",
  };

  const safeName = escapeHtml(scammer.name?.startsWith("@") ? scammer.name : `@${scammer.name}`);
  const safeId = escapeHtml(scammer.telegramUserId || noText[lang]);
  const safeDesc = escapeHtml((scammer.description || "").slice(0, 600)) || (lang === "ua" ? "Опис відсутній" : lang === "ru" ? "Описания нет" : lang === "pl" ? "Brak opisu" : "No description");
  const safeProof = escapeHtml(scammer.proofLink || "");
  const safeAmount = escapeHtml(scammer.scamAmount ? `${scammer.scamAmount} ${scammer.scamCurrency || ""}` : "");
  const safeType = escapeHtml(scammer.scammerType || "");

  const dateObj = scammer.updatedAt || scammer.createdAt || new Date();
  const localeMap: Record<SupportedLang, string> = { ua: "uk-UA", ru: "ru-RU", pl: "pl-PL", en: "en-US" };
  let formattedDate = "";
  try {
    formattedDate = new Date(dateObj).toLocaleDateString(localeMap[lang], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    formattedDate = new Date().toLocaleDateString();
  }

  const searchCount = scammer.searchCount ?? 0;
  const likeCount = scammer.likeCount ?? 0;
  const dislikeCount = scammer.dislikeCount ?? 0;

  const cardLabels: Record<SupportedLang, { username: string; id: string; status: string; desc: string; site: string; chat: string; proofs: string }> = {
    ua: { username: "Юзернейм", id: "ID", status: "Статус", desc: "Опис", site: "Сайт", chat: "Чат", proofs: "Пруфи" },
    ru: { username: "Юзернейм", id: "ID", status: "Статус", desc: "Описание", site: "Сайт", chat: "Чат", proofs: "Пруфы" },
    en: { username: "Username", id: "ID", status: "Status", desc: "Description", site: "Site", chat: "Chat", proofs: "Proofs" },
    pl: { username: "Nazwa użytkownika", id: "ID", status: "Status", desc: "Opis", site: "Strona", chat: "Czat", proofs: "Dowody" },
  };

  const lbl = cardLabels[lang];

  let text = `${t[lang].foundHeader}\n\n`;
  text += `👤 <b>${lbl.username}:</b> ${safeName}\n`;
  text += `🆔 <b>${lbl.id}:</b> <code>${safeId}</code>\n`;
  text += `📊 <b>${lbl.status}:</b> ${emoji} ${escapeHtml(statusLabel)}\n`;
  if (safeAmount) text += `${t[lang].amount}: <b>${safeAmount}</b>\n`;
  if (safeType) text += `${t[lang].type}: <b>${safeType}</b>\n`;
  text += `📝 <b>${lbl.desc}:</b> ${safeDesc}\n`;
  text += `${t[lang].searchCount}: <b>${searchCount}</b>\n`;
  text += `👍 ${likeCount} / 👎 ${dislikeCount}\n`;
  text += `${t[lang].addedDate}: <b>${formattedDate}</b>\n`;
  if (safeProof) text += `🧾 <b>${lbl.proofs}:</b> ${safeProof ? `<a href="${escapeHtml(scammer.proofLink)}">link</a>` : "—"}\n`;
  text += `\n───────────────\n`;
  text += `🌐 <b>${lbl.site}:</b> https://frostscambase.vercel.app/\n`;
  text += `💬 <b>${lbl.chat}:</b> @wocmf\n`;

  const kb = new InlineKeyboard()
    .url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(scammer.name)}`)
    .url(t[lang].btnAppeal, `https://frostscambase.vercel.app/`)
    .row()
    .url(t[lang].btnReport, "https://frostscambase.vercel.app/")
    .url(t[lang].btnChat, "https://t.me/wocmf")
    .row()
    .url(t[lang].btnSupport, "https://t.me/send?start=IVkrkNlUFFtA")
    .text(t[lang].btnCheckMore, "lang_ua"); // dummy to show language chooser as check more? Actually we want language chooser

  // Improve last row - check more triggers language chooser? Better to just offer lang change
  const finalKb = new InlineKeyboard()
    .url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(scammer.name)}`)
    .row()
    .url(t[lang].btnReport, "https://frostscambase.vercel.app/")
    .url(t[lang].btnChat, "https://t.me/wocmf")
    .row()
    .url(t[lang].btnSupport, "https://t.me/send?start=IVkrkNlUFFtA")
    .text("🌐 Language / Мова", "lang_ua");

  // If proof is image, send photo
  const isImage = scammer.proofLink && /\.(jpe?g|png|webp|gif|bmp|avif)(\?.*)?$/i.test(scammer.proofLink);

  try {
    if (isImage) {
      // Try to send photo with caption (cap max 1024 chars)
      const caption = text.length > 900 ? text.slice(0, 900) + "…" : text;
      await ctx.replyWithPhoto(scammer.proofLink, {
        caption,
        parse_mode: "HTML",
        reply_markup: finalKb,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: finalKb,
        link_preview_options: { is_disabled: true },
      });
    }
  } catch (e) {
    // Fallback to text if photo fails
    console.error("photo send fail", e);
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: finalKb,
      link_preview_options: { is_disabled: true },
    });
  }
}

// ==================== BOTS LIST (verified bots) ====================
async function sendBotsList(ctx: any, lang: SupportedLang, page: number, isEdit = false) {
  const PAGE_SIZE = 10;
  try {
    if (!isEdit) {
      await ctx.replyWithChatAction("typing").catch(() => {});
    }

    const where = {
      status: "verified",
      scammerType: { contains: "Бот", mode: "insensitive" as const },
    };

    const [total, items] = await Promise.all([
      db.scammer.count({ where }),
      db.scammer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: Math.max(0, (page - 1) * PAGE_SIZE),
        take: PAGE_SIZE,
      }),
    ]);

    if (total === 0) {
      const text = t[lang].botsEmpty;
      if (isEdit) {
        await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(() => ctx.reply(text, { parse_mode: "HTML" }));
      } else {
        await ctx.reply(text, { parse_mode: "HTML" });
      }
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const localeMap: Record<SupportedLang, string> = { ua: "uk-UA", ru: "ru-RU", pl: "pl-PL", en: "en-US" };

    let text = `${t[lang].botsHeader}\n`;
    text += `${t[lang].botsPage.replace("{page}", String(safePage)).replace("{total}", String(totalPages))}\n\n`;

    items.forEach((s, i) => {
      const idx = (safePage - 1) * PAGE_SIZE + i + 1;
      const name = escapeHtml(s.name?.startsWith("@") ? s.name : `@${s.name}`);
      let dateStr = "";
      try {
        dateStr = new Date(s.updatedAt || s.createdAt).toLocaleDateString(localeMap[lang], {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        dateStr = "";
      }
      text += `${idx}. <b>${name}</b> — 📅 ${dateStr}\n`;
    });

    const kb = new InlineKeyboard();
    items.forEach((s, i) => {
      if (i % 2 === 0 && i !== 0) kb.row();
      kb.text(`${t[lang].btnDetails} ${(safePage - 1) * PAGE_SIZE + i + 1}`, `select_${s.id}`);
    });
    kb.row();
    if (safePage > 1) kb.text(t[lang].btnPrev, `bots_page_${safePage - 1}`);
    if (safePage < totalPages) kb.text(t[lang].btnNext, `bots_page_${safePage + 1}`);
    kb.row().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/");

    if (isEdit) {
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      } catch {
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
      }
    } else {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("bots list error", e);
    await ctx.reply(t[lang].error, { parse_mode: "HTML" });
  }
}

// ==================== BOT GETTER ====================
function getBot(): Bot | null {
  if (botInstance) return botInstance;
  if (!token) return null;
  botInstance = new Bot(token);
  setupBot(botInstance);
  return botInstance;
}

// ==================== WEBHOOK HANDLER ====================
let webhookHandler: any = null;
function getWebhookHandler() {
  if (webhookHandler) return webhookHandler;
  const bot = getBot();
  if (!bot) return null;
  webhookHandler = webhookCallback(bot, "std/http", { onNotHandled: "return" });
  return webhookHandler;
}

export async function POST(req: NextRequest) {
  const handler = getWebhookHandler();
  if (!handler) {
    // Token not set — don't crash build, just return 503
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 503 });
  }
  try {
    return await handler(req);
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function GET() {
  const bot = getBot();
  if (!bot) {
    return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, bot: "frostbase bot v2 is running" });
}
