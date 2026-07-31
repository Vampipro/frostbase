import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// Глобальне збереження мови користувачів (UA / RU / EN / PL)
type SupportedLang = "ua" | "ru" | "en" | "pl";
const userLanguages = new Map<number, SupportedLang>();

// Визначення мови користувача (з пам'яті або за налаштуваннями Telegram)
function getUserLanguage(userId?: number, telegramLangCode?: string): SupportedLang {
  if (userId && userLanguages.has(userId)) {
    return userLanguages.get(userId)!;
  }

  // Автоматичне визначення за мовою Telegram акаунта
  if (telegramLangCode) {
    const code = telegramLangCode.toLowerCase();
    if (code.startsWith("ru")) return "ru";
    if (code.startsWith("en")) return "en";
    if (code.startsWith("pl")) return "pl";
    if (code.startsWith("uk") || code.startsWith("ua")) return "ua";
  }

  return "ua"; // Мова за замовчуванням
}

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
// Переклад статусів на 4 мови (UA / RU / EN / PL)
// ----------------------------------------------------------------------
function getFormattedStatus(status?: string | null, lang: SupportedLang = "ua"): string {
  if (!status) {
    return "🚫 SCAM";
  }

  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "scam":
      return "🚫 SCAM";

    case "verified":
      if (lang === "ru") return "✅ Выводит";
      if (lang === "en") return "✅ Verified Payouts";
      if (lang === "pl") return "✅ Wypłaca";
      return "✅ Виводить";

    case "no_rewards":
      if (lang === "ru") return "🔴 Не выводит";
      if (lang === "en") return "🔴 No Payouts";
      if (lang === "pl") return "🔴 Nie wypłaca";
      return "🔴 Не виводить";

    case "us_skamera":
      if (lang === "ru") return "👤 ЮЗ мошенника";
      if (lang === "en") return "👤 Scammer Username";
      if (lang === "pl") return "👤 Nazwa oszusta";
      return "👤 ЮЗ шахрая";

    case "rewardidk":
      if (lang === "ru") return "⚠️ Нестабильно";
      if (lang === "en") return "⚠️ Unstable";
      if (lang === "pl") return "⚠️ Niestabilnie";
      return "⚠️ Нестабільно";

    case "podozritelnyj":
      if (lang === "ru") return "🧐 Подозрительно";
      if (lang === "en") return "🧐 Suspicious";
      if (lang === "pl") return "🧐 Podejrzany";
      return "🧐 Підозріло";

    case "dimka":
      return "dimka";

    case "wllad":
      if (lang === "ru") return "💎 Владелец";
      if (lang === "en") return "💎 Owner";
      if (lang === "pl") return "💎 Właściciel";
      return "💎 Власник";

    case "no_baza":
      if (lang === "ru") return "❓ Нет в базе";
      if (lang === "en") return "❓ Not in Database";
      if (lang === "pl") return "❓ Brak w bazie";
      return "❓ Немає в базі";

    case "stolen_nft":
      if (lang === "ru") return "🛞 Краденый NFT";
      if (lang === "en") return "🛞 Stolen NFT";
      if (lang === "pl") return "🛞 Skradziony NFT";
      return "🛞 Крадений NFT";

    case "swiazsoskam":
      if (lang === "ru") return "🔗 Связь со скамом";
      if (lang === "en") return "🔗 Linked to Scam";
      if (lang === "pl") return "🔗 Powiązanie z oszustwem";
      return "🔗 Зв'язок зі скамом";

    case "admin":
      if (lang === "ru") return "Админ";
      if (lang === "en") return "Admin";
      if (lang === "pl") return "Admin";
      return "Адмін";

    case "scambot":
      return "scam bot";

    default:
      return `📌 ${status}`;
  }
}

// ----------------------------------------------------------------------
// 1. /start — Вибір мови з 4 кнопками (UA / RU / EN / PL)
// ----------------------------------------------------------------------
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🇺🇦 Українська", "lang_ua")
    .text("🇷🇺 Русский", "lang_ru")
    .row()
    .text("🇬🇧 English", "lang_en")
    .text("🇵🇱 Polski", "lang_pl");

  await ctx.reply(
    "👋 **Оберіть мову / Выберите язык / Choose language / Wybierz język:**",
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// ----------------------------------------------------------------------
// 2. Обробка натискання на кнопки мови
// ----------------------------------------------------------------------
bot.callbackQuery(/^lang_(ua|ru|en|pl)$/, async (ctx) => {
  const lang = ctx.match[1] as SupportedLang;
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
  } else if (lang === "ru") {
    await ctx.reply(
      "✅ **Язык изменен на Русский!**\n\n" +
        "Отправьте **Юзернейм** (например, `@username`) или **ID** пользователя для проверки.",
      { parse_mode: "Markdown" }
    );
  } else if (lang === "pl") {
    await ctx.reply(
      "✅ **Język zmieniony na Polski!**\n\n" +
        "Wyślij **Nazwę użytkownika** (np. `@username`) lub **ID** użytkownika, aby sprawdzić bazę.",
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(
      "✅ **Language set to English!**\n\n" +
        "Send a **Username** (e.g., `@username`) or **Telegram ID** to check the database.",
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------------------------------------------
// 3. Обробка пошуку
// ----------------------------------------------------------------------
bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id;
  const rawInput = ctx.message.text.trim();

  if (rawInput.startsWith("/")) return;

  // Отримуємо мову користувача
  const userLang = getUserLanguage(userId, ctx.from?.language_code);

  // Захист від спаму
  if (userId) {
    const { spam, timeLeft } = isSpamming(userId);
    if (spam) {
      let spamMsg = `⏳ **Будь ласка, зачекайте ${timeLeft} сек.** перед наступним запитом.`;
      if (userLang === "ru") {
        spamMsg = `⏳ **Пожалуйста, подождите ${timeLeft} сек.** перед следующим запросом.`;
      } else if (userLang === "pl") {
        spamMsg = `⏳ **Proszę czekać ${timeLeft} sek.** przed wysłaniem kolejnego zapytania.`;
      } else if (userLang === "en") {
        spamMsg = `⏳ **Please wait ${timeLeft} sec.** before sending another request.`;
      }
      await ctx.reply(spamMsg, { parse_mode: "Markdown" });
      return;
    }
  }

  // 🛠 ГЕНЕРУЄМО ВАРІАНТИ ДЛЯ ПОШУКУ (з @ та без @)
  const withoutAt = rawInput.replace(/^@/, "").trim();
  const withAt = `@${withoutAt}`;

  try {
    // Гнучкий пошук у базі Neon через Prisma (перевіряє і з @, і без @)
    const record = await db.scammer.findFirst({
      where: {
        OR: [
          { telegramUserId: rawInput },
          { telegramUserId: withoutAt },
          { telegramUserId: withAt },
          { name: { equals: rawInput, mode: "insensitive" } },
          { name: { equals: withoutAt, mode: "insensitive" } },
          { name: { equals: withAt, mode: "insensitive" } },
        ],
      },
    });

    // Якщо НЕ знайдено
    if (!record) {
      const displayTag = withAt;

      let notFoundText = "";
      if (userLang === "ua") {
        notFoundText =
          `❌ **Користувача ${displayTag} (або ID: \`${withoutAt}\`) не знайдено в базі.**\n\n` +
          `Додати скамера в базу або переглянути інших можна на нашому сайті:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else if (userLang === "ru") {
        notFoundText =
          `❌ **Пользователь ${displayTag} (или ID: \`${withoutAt}\`) не найден в базе.**\n\n` +
          `Добавить скамера в базу или проверить других можно на нашем сайте:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else if (userLang === "pl") {
        notFoundText =
          `❌ **Użytkownik ${displayTag} (lub ID: \`${withoutAt}\`) nie został znaleziony w bazie danych.**\n\n` +
          `Możesz zgłosić oszusta lub sprawdzić innych na naszej stronie:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else {
        notFoundText =
          `❌ **User ${displayTag} (or ID: \`${withoutAt}\`) was not found in the database.**\n\n` +
          `You can report a scammer or search others on our website:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      }

      await ctx.reply(notFoundText, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // ➕ ДОДАЄМО +1 ДО ЛІЧИЛЬНИКА ПОШУКІВ (searchCount)
    const updatedRecord = await db.scammer.update({
      where: { id: record.id },
      data: {
        searchCount: { increment: 1 },
      },
    });

    // Форматування дати
    const localeMap: Record<SupportedLang, string> = {
      ua: "uk-UA",
      ru: "ru-RU",
      pl: "pl-PL",
      en: "en-US",
    };
    const dateToFormat = updatedRecord.updatedAt || updatedRecord.createdAt || new Date();
    const formattedDate = new Date(dateToFormat).toLocaleDateString(localeMap[userLang], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Юзернейм
    const noNameText: Record<SupportedLang, string> = {
      ua: "Не вказано",
      ru: "Не указан",
      pl: "Nie podano",
      en: "Not specified",
    };
    let usernameDisplay = noNameText[userLang];
    if (updatedRecord.name) {
      usernameDisplay = updatedRecord.name.startsWith("@") ? updatedRecord.name : `@${updatedRecord.name}`;
    }

    // Текст відповіді на 4 мовах
    let responseText = "";

    if (userLang === "ua") {
      responseText =
        `🚨 **Знайдено збіг у базі:**\n\n` +
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
    } else if (userLang === "ru") {
      responseText =
        `🚨 **Найдено совпадение в базе:**\n\n` +
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
    } else if (userLang === "pl") {
      responseText =
        `🚨 **Znaleziono wpis w bazie danych:**\n\n` +
        `👤 **Nazwa użytkownika:** ${usernameDisplay}\n` +
        `🆔 **ID:** \`${updatedRecord.telegramUserId || "Nie podano"}\` \n` +
        `📊 **Status:** ${getFormattedStatus(updatedRecord.status, "pl")}\n` +
        `📝 **Opis:** ${updatedRecord.description || "Brak opisu"}\n` +
        `👁 **Liczba wyświetleń:** ${updatedRecord.searchCount}\n` +
        `📅 **Data dodania:** ${formattedDate}\n` +
        `🧾 **Dowody:** ${updatedRecord.proofLink || "Brak dowodów"}\n\n` +
        `───────────────\n` +
        `🌐 **Nasza strona:** https://frostscambase.vercel.app/\n` +
        `💬 **Nasz czat:** @wocmf\n` +
        `❤️ **Wesprzyj projekt:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Możesz dodać oszusta, przejrzeć innych lub sprawdzić zweryfikowane boty na naszej stronie!*`;
    } else {
      responseText =
        `🚨 **Record found in database:**\n\n` +
        `👤 **Username:** ${usernameDisplay}\n` +
        `🆔 **ID:** \`${updatedRecord.telegramUserId || "Not specified"}\` \n` +
        `📊 **Status:** ${getFormattedStatus(updatedRecord.status, "en")}\n` +
        `📝 **Description:** ${updatedRecord.description || "No description available"}\n` +
        `👁 **Search count:** ${updatedRecord.searchCount}\n` +
        `📅 **Date added:** ${formattedDate}\n` +
        `🧾 **Proofs:** ${updatedRecord.proofLink || "No proof provided"}\n\n` +
        `───────────────\n` +
        `🌐 **Our Website:** https://frostscambase.vercel.app/\n` +
        `💬 **Our Chat:** @wocmf\n` +
        `❤️ **Support Project:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *You can report a scammer, view others, or check verified bots on our website!*`;
    }

    await ctx.reply(responseText, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    });
  } catch (error) {
    console.error("Помилка під час пошуку:", error);
    let errorMsg = "⚠️ **Сталася помилка при пошуку в базі даних.**";
    if (userLang === "ru") errorMsg = "⚠️ **Произошла ошибка при поиске в базе данных.**";
    if (userLang === "pl") errorMsg = "⚠️ **Wystąpił błąd podczas przeszukiwania bazy danych.**";
    if (userLang === "en") errorMsg = "⚠️ **An error occurred while searching the database.**";

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
