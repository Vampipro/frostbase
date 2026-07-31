import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// Збереження мови користувачів у пам'яті (за замовчуванням 'ua')
const userLanguages = new Map<number, "ua" | "ru">();

// ----------------------------------------------------------------------
// Захист від спаму (Кулдаун 7 секунд)
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

// ----------------------------------------------------------------------
// Кастомна мапа статусів згідно зі скріншотом
// ----------------------------------------------------------------------
function getFormattedStatus(status?: string | null, lang: "ua" | "ru" = "ua"): string {
  if (!status) {
    return lang === "ua" ? "🚫 СКАМ" : "🚫 СКАМ";
  }

  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "scam":
      return lang === "ua" ? "🚫 СКАМ" : "🚫 СКАМ";

    case "verified":
      return lang === "ua" ? "✅ Виводить" : "✅ Выводит";

    case "no_rewards":
      return lang === "ua" ? "🔴 Не виводить" : "🔴 Не выводит";

    case "us_skamera":
      return lang === "ua" ? "👤 ЮЗ шахрая" : "👤 ЮЗ мошенника";

    case "rewardidk":
      return lang === "ua" ? "⚠️ Нестабільно" : "⚠️ Нестабильно";

    case "podozritelnyj":
      return lang === "ua" ? "🧐 Підозріло" : "🧐 Подозрительно";

    case "dimka":
      return lang === "ua" ? "димка" : "димка";

    case "wllad":
      return lang === "ua" ? "💎 Власник" : "💎 Владелец";

    case "no_baza":
      return lang === "ua" ? "❓ Немає в базі" : "❓ Нет в базе";

    case "stolen_nft":
      return lang === "ua" ? "🛞 Крадений NFT" : "🛞 Краденый NFT";

    case "swiazsoskam":
      return lang === "ua" ? "🔗 Зв'язок зі скамом" : "🔗 Связь со скамом";

    case "admin":
      return lang === "ua" ? "Адмін" : "Админ";

    case "scambot":
      return lang === "ua" ? "скам бот" : "скам бот";

    default:
      return `📌 ${status}`;
  }
}

// ----------------------------------------------------------------------
// 1. /start — Вибір мови кнопками
// ----------------------------------------------------------------------
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🇺🇦 Українська", "lang_ua")
    .text("🇷🇺 Русский", "lang_ru");

  await ctx.reply(
    "👋 **Оберіть мову / Выберите язык:**",
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// ----------------------------------------------------------------------
// 2. Обробка натискання на кнопки мови
// ----------------------------------------------------------------------
bot.callbackQuery(/^lang_(ua|ru)$/, async (ctx) => {
  const lang = ctx.match[1] as "ua" | "ru";
  if (ctx.from?.id) {
    userLanguages.set(ctx.from.id, lang);
  }

  await ctx.answerCallbackQuery();

  if (lang === "ua") {
    await ctx.reply(
      "✅ **Мову змінено на Українську!**\n\n" +
        "Надішліть **Юзернейм** (наприклад, `@username`) або **ID** користувача для перевірки.",
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(
      "✅ **Язык изменен на Русский!**\n\n" +
        "Отправьте **Юзернейм** (например, `@username`) или **ID** пользователя для проверки.",
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------------------------------------------
// 3. Обробка пошуку та інкремент searchCount
// ----------------------------------------------------------------------
bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id;
  const rawInput = ctx.message.text.trim();

  if (rawInput.startsWith("/")) return;

  const userLang = (userId && userLanguages.get(userId)) || "ua";

  // Захист від спаму
  if (userId) {
    const { spam, timeLeft } = isSpamming(userId);
    if (spam) {
      const spamMsg =
        userLang === "ua"
          ? `⏳ **Будь ласка, зачекайте ${timeLeft} сек.** перед наступним запитом.`
          : `⏳ **Пожалуйста, подождите ${timeLeft} сек.** перед следующим запросом.`;
      await ctx.reply(spamMsg, { parse_mode: "Markdown" });
      return;
    }
  }

  const cleanInput = rawInput.replace(/^@/, "").trim();

  try {
    // Шукаємо запис в БД
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

    // Якщо НЕ знайдено
    if (!record) {
      const displayTag = rawInput.startsWith("@") ? rawInput : `@${cleanInput}`;
      
      const notFoundText =
        userLang === "ua"
          ? `❌ **Користувача ${displayTag} (або ID: \`${cleanInput}\`) не знайдено в базі.**\n\n` +
            `Додати скамера в базу або переглянути інших можна на нашому сайті:\n` +
            `🌐 https://frostscambase.vercel.app/`
          : `❌ **Пользователь ${displayTag} (или ID: \`${cleanInput}\`) не найден в базе.**\n\n` +
            `Добавить скамера в базу или проверить других можно на нашем сайте:\n` +
            `🌐 https://frostscambase.vercel.app/`;

      await ctx.reply(notFoundText, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // ➕ ДОДАЄМО +1 ДО ЛІЧИЛЬНИКА ПОШУКІВ (searchCount) В NEON DB
    const updatedRecord = await db.scammer.update({
      where: { id: record.id },
      data: {
        searchCount: { increment: 1 },
      },
    });

    // Форматування дати
    const dateToFormat = updatedRecord.updatedAt || updatedRecord.createdAt || new Date();
    const formattedDate = new Date(dateToFormat).toLocaleDateString(
      userLang === "ua" ? "uk-UA" : "ru-RU",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    let usernameDisplay = userLang === "ua" ? "Не вказано" : "Не указан";
    if (updatedRecord.name) {
      usernameDisplay = updatedRecord.name.startsWith("@") ? updatedRecord.name : `@${updatedRecord.name}`;
    }

    // Формування повідомлення з новими статусами та лічильником
    let responseText = "";

    if (userLang === "ua") {
      responseText =
        `🚨 **Інформація про порушника:**\n\n` +
        `👤 **Юзернейм:** ${usernameDisplay}\n` +
        `🆔 **ID:** \`${updatedRecord.telegramUserId || "Не вказано"}\` \n` +
        `📊 **Статус:** ${getFormattedStatus(updatedRecord.status, "ua")}\n` +
        `📝 **Опис:** ${updatedRecord.description || "Опис відсутній"}\n` +
        `👁 **Кількість переглядів:** ${updatedRecord.searchCount}\n` +
        `📅 **Дата додавання:** ${formattedDate}\n` +
        `🧾 **Докази:** ${updatedRecord.proofLink || "Докази не надано"}\n\n` +
        `───────────────\n` +
        `🌐 **Наш сайт:** https://frostscambase.vercel.app/\n` +
        `💬 **Наш чат:** @wocmf\n` +
        `❤️ **Підтримати проєкт:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Додати скамера, переглянути інших або перевірених ботів можна на нашому сайті!*`;
    } else {
      responseText =
        `🚨 **Информация о нарушителе:**\n\n` +
        `👤 **Юзернейм:** ${usernameDisplay}\n` +
        `🆔 **ID:** \`${updatedRecord.telegramUserId || "Не указан"}\` \n` +
        `📊 **Статус:** ${getFormattedStatus(updatedRecord.status, "ru")}\n` +
        `📝 **Описание:** ${updatedRecord.description || "Описание отсутствует"}\n` +
        `👁 **Количество просмотров:** ${updatedRecord.searchCount}\n` +
        `📅 **Дата добавления:** ${formattedDate}\n` +
        `🧾 **Пруфы:** ${updatedRecord.proofLink || "Пруфы не предоставлены"}\n\n` +
        `───────────────\n` +
        `🌐 **Наш сайт:** https://frostscambase.vercel.app/\n` +
        `💬 **Наш чат:** @wocmf\n` +
        `❤️ **Поддержать проект:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Добавить скамера, посмотреть других скамеров или проверенных ботов можно на нашем сайте!*`;
    }

    await ctx.reply(responseText, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    });
  } catch (error) {
    console.error("Помилка під час пошуку:", error);
    const errorMsg =
      userLang === "ua"
        ? "⚠️ **Сталася помилка при пошуку в базі даних.**"
        : "⚠️ **Произошла ошибка при поиске в базе данных.**";
    await ctx.reply(errorMsg, { parse_mode: "Markdown" });
  }
});

// Налаштування Webhook для Vercel / Next.js
const handleWebhook = webhookCallback(bot, "std/http", {
  onNotHandled: "return",
});

export async function POST(req: NextRequest) {
  try {
    return await handleWebhook(req);
  } catch (err) {
    console.error("Помилка Webhook:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
