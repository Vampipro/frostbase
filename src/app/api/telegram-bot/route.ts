import { Bot, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// ----------------------------------------------------------------------
// 5. Захист від спаму (Кулдаун 7 секунд)
// ----------------------------------------------------------------------
const COOLDOWN_SECONDS = 7;
const userCooldowns = new Map<number, number>();

function isSpamming(userId: number): { spam: boolean; timeLeft: number } {
  const now = Date.now();
  const lastRequestTime = userCooldowns.get(userId) || 0;
  const timePassed = (now - lastRequestTime) / 1000;

  if (timePassed < COOLDOWN_SECONDS) {
    const timeLeft = Math.ceil(COOLDOWN_SECONDS - timePassed);
    return { spam: true, timeLeft };
  }

  userCooldowns.set(userId, now);
  return { spam: false, timeLeft: 0 };
}

// Помічник для красивого виводу статусу з емоджі
function getStatusEmoji(status?: string | null): string {
  if (!status) return "🚨 SCAM";
  const lower = status.toLowerCase();
  if (lower.includes("scam") || lower.includes("скам")) return "🚨 SCAM";
  if (lower.includes("warn") || lower.includes("варн")) return "⚠️ Подозрительный";
  if (lower.includes("clear") || lower.includes("чист")) return "✅ Проверен";
  return `📌 ${status}`;
}

// ----------------------------------------------------------------------
// 2. Команда /start
// ----------------------------------------------------------------------
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 **Привет! Введите Юзернейм (например, `@username`) или ID пользователя для проверки.**",
    { parse_mode: "Markdown" }
  );
});

// ----------------------------------------------------------------------
// 1, 3, 4, 5. Обробка текстових запитів (пошук та кулдаун)
// ----------------------------------------------------------------------
bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id;
  const rawInput = ctx.message.text.trim();

  // Ігноруємо команди
  if (rawInput.startsWith("/")) return;

  // Захист від спаму
  if (userId) {
    const { spam, timeLeft } = isSpamming(userId);
    if (spam) {
      await ctx.reply(
        `⏳ **Пожалуйста, подождите ${timeLeft} сек.** перед следующим запросом.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  // Очищаємо юзернейм від символу @ для гнучкого пошуку
  const cleanInput = rawInput.replace(/^@/, "").trim();

  try {
    // 1. Перевірка на 2 поля одразу (і як ID, і як Username, з @ або без)
    const record = await db.scammer.findFirst({
      where: {
        OR: [
          { telegramUserId: rawInput },
          { telegramUserId: cleanInput },
          { name: { equals: rawInput, mode: "insensitive" } },
          { name: { equals: cleanInput, mode: "insensitive" } },
        ],
      },
    });

    // 4. Якщо скамера НЕ знайдено
    if (!record) {
      const displayTag = rawInput.startsWith("@") ? rawInput : `@${cleanInput}`;
      await ctx.reply(
        `❌ **Пользователь ${displayTag} (или ID: \`${cleanInput}\`) не найден в базе.**\n\n` +
          `Добавить скамера в базу или проверить других можно на нашем сайте:\n` +
          `🌐 https://frostscambase.vercel.app/`,
        {
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
        }
      );
      return;
    }

    // Форматування дати
    const dateToFormat = record.updatedAt || record.createdAt || new Date();
    const formattedDate = new Date(dateToFormat).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Форматування Юзернейму з @
    let usernameDisplay = "Не указан";
    if (record.name) {
      usernameDisplay = record.name.startsWith("@") ? record.name : `@${record.name}`;
    }

    // 3. Якщо знайдено — виводимо повну інформацію
    const responseText =
      `🚨 **Информация о нарушителе:**\n\n` +
      `👤 **Юзернейм:** ${usernameDisplay}\n` +
      `🆔 **ID:** \`${record.telegramUserId || "Не указан"}\` \n` +
      `📊 **Статус:** ${getStatusEmoji(record.status)}\n` +
      `📝 **Описание:** ${record.description || "Описание отсутствует"}\n` +
      `📅 **Дата добавления:** ${formattedDate}\n` +
      `🧾 **Пруфы:** ${record.proofLink || "Пруфы не предоставлены"}\n\n` +
      `───────────────\n` +
      `🌐 **Наш сайт:** https://frostscambase.vercel.app/\n` +
      `💬 **Наш чат:** @wocmf\n` +
      `❤️ **Поддержать проект:** t.me/send?start=IVkrkNlUFFtA\n\n` +
      `💡 *Добавить скамера, посмотреть других скамеров или проверенных ботов можно на нашем сайте!*`;

    await ctx.reply(responseText, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    });
  } catch (error) {
    console.error("Ошибка при поиске:", error);
    await ctx.reply("⚠️ **Произошла ошибка при поиске в базе данных.**", {
      parse_mode: "Markdown",
    });
  }
});

// Налаштування Webhook для Vercel / Next.js App Router
const handleWebhook = webhookCallback(bot, "std/http", {
  onNotHandled: "return",
});

export async function POST(req: NextRequest) {
  try {
    return await handleWebhook(req);
  } catch (err) {
    console.error("Ошибка Webhook:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
