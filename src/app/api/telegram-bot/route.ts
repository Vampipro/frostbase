import { Bot, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
// Переконайся, що шлях до твоєї Prisma (або іншої БД) вказано правильно
import { db } from "@/lib/db"; 

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// Команда /start
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 **Приветствую! Я бот для проверки по базе данных.**\n\n" +
      "Отправь мне **Username** (например, `@username`) или **Telegram ID** (например, `123456789`), и я проверю наличие записи в базе.",
    { parse_mode: "Markdown" }
  );
});

// Обробка тексту
bot.on("message:text", async (ctx) => {
  const query = ctx.message.text.trim();

  // Ігноруємо командні запити типу /help, /start
  if (query.startsWith("/")) return;

  // Визначаємо, чи це Telegram ID (тільки цифри), чи Username
  const isId = /^\d+$/.test(query);
  const cleanUsername = query.replace(/^@/, "").trim();

  try {
    let record = null;

    if (isId) {
      // Пошук за Telegram ID
      record = await db.scammer.findFirst({
        where: {
          telegramId: query,
        },
      });
    } else {
      // Пошук за Юзернеймом (без урахування регістру)
      record = await db.scammer.findFirst({
        where: {
          username: {
            equals: cleanUsername,
            mode: "insensitive",
          },
        },
      });
    }

    // Якщо нічого не знайдено
    if (!record) {
      await ctx.reply(
        "❌ **Ничего не найдено.**\nПользователь с такими данными отсутствует в базе.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Збільшуємо лічильник пошуків на +1
    const updatedRecord = await db.scammer.update({
      where: { id: record.id },
      data: {
        searchCount: { increment: 1 },
      },
    });

    // Форматуємо дату створення
    const formattedDate = new Date(updatedRecord.createdAt).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Формуємо відповідь
    const responseText =
      `🚨 **Запись найдена в базе!**\n\n` +
      `👤 **Юзернейм:** ${updatedRecord.username ? `@${updatedRecord.username}` : "Не указан"}\n` +
      `🆔 **Telegram ID:** \`${updatedRecord.telegramId || "Не указан"}\` \n` +
      `📅 **Когда добавили:** ${formattedDate}\n` +
      `🔍 **Количество проверок:** ${updatedRecord.searchCount}\n` +
      `⚠️ **Причина / Описание:** ${updatedRecord.reason || "Информация отсутствует"}\n` +
      `🧾 **Пруфы:** ${updatedRecord.proofs || "Пруфы не предоставлены"}\n` +
      `📊 **Статус:** ${updatedRecord.status || "Подтвержден"}`;

    await ctx.reply(responseText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Ошибка работы с БД:", error);
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
