/* import { Bot, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; 

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// Команда /start
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 **Приветствую! Я бот для проверки базы скамеров.**\n\n" +
      "Отправь мне **Username** или **Telegram ID**, и я проверю наличие записи в базе.",
    { parse_mode: "Markdown" }
  );
});

// Обработка входящего текста
bot.on("message:text", async (ctx) => {
  const query = ctx.message.text.trim();

  // Игнорируем команды
  if (query.startsWith("/")) return;

  // Очищаем юзернейм от символа @, если он есть
  const cleanUsername = query.replace(/^@/, "").trim();

  try {
    // Ищем в БД одновременно по telegramUserId и по name (без учета регистра)
    const record = await db.scammer.findFirst({
      where: {
        OR: [
          { telegramUserId: query },
          { telegramUserId: cleanUsername },
          { name: { equals: cleanUsername, mode: "insensitive" } },
          { name: { equals: query, mode: "insensitive" } },
        ],
      },
    });

    // Если ничего не найдено
    if (!record) {
      await ctx.reply(
        "❌ **Ничего не найдено.**\nПользователь с такими данными отсутствует в базе.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Форматируем дату
    const dateToFormat = record.updatedAt || record.createdAt || new Date();
    const formattedDate = new Date(dateToFormat).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Формируем текст ответа под твои поля
    const responseText =
      `🚨 **Запись найдена в базе!**\n\n` +
      `👤 **Имя / Юзернейм:** ${record.name || "Не указано"}\n` +
      `🆔 **Telegram ID:** \`${record.telegramUserId || "Не указан"}\` \n` +
      `📌 **Тип:** ${record.scammerType || "Не указан"}\n` +
      `📊 **Статус:** ${record.status || "scam"}\n` +
      `📅 **Дата обновления:** ${formattedDate}\n\n` +
      `📝 **Описание:**\n${record.description || "Описание отсутствует"}\n\n` +
      `🔗 **Пруфы:** ${record.proofLink || "Пруфы не предоставлены"}`;

    await ctx.reply(responseText, { 
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false } 
    });
  } catch (error) {
    console.error("Ошибка работы с БД:", error);
    await ctx.reply("⚠️ **Произошла ошибка при поиске в базе данных.**", {
      parse_mode: "Markdown",
    });
  }
});

// Настройка Webhook для Vercel / Next.js
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
}*/
