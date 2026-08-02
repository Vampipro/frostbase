import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в Environment Variables");
}

const bot = new Bot(token);

// Підтримувані мови
type SupportedLang = "ua" | "ru" | "en" | "pl";
const userLanguages = new Map<number, SupportedLang>();

// Гнучке визначення мови користувача
function getUserLanguage(userId?: number, telegramLangCode?: string): SupportedLang {
  // 1. Перевіряємо пам'ять (якщо процес ще живий)
  if (userId && userLanguages.has(userId)) {
    return userLanguages.get(userId)!;
  }

  // 2. Визначення за мовою Telegram-клієнта користувача
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
// Екранування Markdown (виправляє помилки Telegram API "can't parse entities")
// ----------------------------------------------------------------------
// У legacy режимі "Markdown" зарезервовані символи: _ * ` [
// Якщо в тексті (юзернейм, опис, посилання, статус) трапляється непарний
// такий символ (наприклад @user_qwe), Telegram кидає помилку парсингу
// і бот падає в catch. Тому будь-який динамічний (не наш власний) текст
// перед вставкою в повідомлення з parse_mode: "Markdown" ОБОВ'ЯЗКОВО
// треба екранувати.
function escapeMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/([_*`[])/g, "\\$1");
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
  if (!status) return "🚫 SCAM";

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

    // ВАЖЛИВО: тут статус може прийти прямо з бази (довільний текст),
    // тому його теж треба екранувати перед вставкою в Markdown-повідомлення.
    default:
      return `📌 ${escapeMarkdown(status)}`;
  }
}

// ----------------------------------------------------------------------
// 1. /start — Вибір мови
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
      "✅ **Мову змінено на Українську!**\n\nНадішліть **Юзернейм** (наприклад, `@username`) або **ID** користувача для перевірки.",
      { parse_mode: "Markdown" }
    );
  } else if (lang === "ru") {
    await ctx.reply(
      "✅ **Язык изменен на Русский!**\n\nОтправьте **Юзернейм** (например, `@username`) или **ID** пользователя для проверки.",
      { parse_mode: "Markdown" }
    );
  } else if (lang === "pl") {
    await ctx.reply(
      "✅ **Język zmieniony na Polski!**\n\nWyślij **Nazwę użytkownika** (np. `@username`) lub **ID** użytkownika, aby sprawdzić bazę.",
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(
      "✅ **Language set to English!**\n\nSend a **Username** (e.g., `@username`) or **Telegram ID** to check the database.",
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

  const userLang = getUserLanguage(userId, ctx.from?.language_code);

  // Спам фільтр
  if (userId) {
    const { spam, timeLeft } = isSpamming(userId);
    if (spam) {
      let spamMsg = `⏳ **Будь ласка, зачекайте ${timeLeft} сек.** перед наступним запитом.`;
      if (userLang === "ru") spamMsg = `⏳ **Пожалуйста, подождите ${timeLeft} сек.** перед следующим запросом.`;
      if (userLang === "pl") spamMsg = `⏳ **Proszę czekać ${timeLeft} sek.** przed wysłaniem kolejnego zapytania.`;
      if (userLang === "en") spamMsg = `⏳ **Please wait ${timeLeft} sec.** before sending another request.`;

      await ctx.reply(spamMsg, { parse_mode: "Markdown" });
      return;
    }
  }

  // Очистка та перевірка типу введення
  const withoutAt = rawInput.replace(/^@/, "").trim();
  const withAt = `@${withoutAt}`;

  // Перевіряємо, чи ввів користувач суто цифри (ID), незалежно від "@" на початку
  const isNumericInput = /^\d+$/.test(withoutAt);

  try {
    let record = null;

    // ВИПРАВЛЕННЯ БАГА №2:
    // Якщо ввели чисто цифри (з "@" чи без) — це ID, і шукати треба
    // САМЕ по telegramUserId, окремим запитом, а не в спільному OR
    // разом з полем name. Інакше Prisma/findFirst може повернути
    // "випадковий" запис, де name випадково збігся з цим рядком,
    // замість реального власника цього ID.
    if (isNumericInput) {
      record = await db.scammer.findFirst({
        where: {
          OR: [{ telegramUserId: withoutAt }, { telegramUserId: rawInput }],
        },
      });
    }

    // Якщо по ID нічого не знайшли (або ввід не числовий) — шукаємо по юзернейму
    if (!record) {
      record = await db.scammer.findFirst({
        where: {
          OR: [
            { name: { equals: rawInput, mode: "insensitive" } },
            { name: { equals: withoutAt, mode: "insensitive" } },
            { name: { equals: withAt, mode: "insensitive" } },
          ],
        },
      });
    }

    // Якщо НЕ знайдено
    if (!record) {
      const displayTag = escapeMarkdown(withAt);
      const displayId = escapeMarkdown(withoutAt);

      let notFoundText = "";
      if (userLang === "ua") {
        notFoundText =
          `❌ **Користувача ${displayTag} (або ID: \`${displayId}\`) не знайдено в базі.**\n\n` +
          `Додати скамера в базу або переглянути інших можна на нашому сайті:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else if (userLang === "ru") {
        notFoundText =
          `❌ **Пользователь ${displayTag} (или ID: \`${displayId}\`) не найден в базе.**\n\n` +
          `Добавить скамера в базу или проверить других можно на нашем сайте:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else if (userLang === "pl") {
        notFoundText =
          `❌ **Użytkownik ${displayTag} (lub ID: \`${displayId}\`) nie został znaleziony w bazie danych.**\n\n` +
          `Możesz zgłosić oszusta lub sprawdzić innych na naszej stronie:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      } else {
        notFoundText =
          `❌ **User ${displayTag} (or ID: \`${displayId}\`) was not found in the database.**\n\n` +
          `You can report a scammer or search others on our website:\n` +
          `🌐 https://frostscambase.vercel.app/`;
      }

      await ctx.reply(notFoundText, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // ➕ БЕЗПЕЧНЕ ОНОВЛЕННЯ ЛІЧИЛЬНИКА (Захист від null)
    const currentSearchCount = typeof record.searchCount === "number" ? record.searchCount : 0;

    const updatedRecord = await db.scammer.update({
      where: { id: record.id },
      data: {
        searchCount: currentSearchCount + 1,
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

    // Форматування Юзернейму
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

    // ВИПРАВЛЕННЯ БАГА №1 і №3:
    // Екрануємо ВСІ значення з бази даних (юзернейм, ID, опис, посилання),
    // бо вони можуть містити символи _ * ` [ , які ламають Markdown-парсер
    // Telegram і призводять до помилки "can't parse entities" -> бот падає
    // в catch і показує "Сталася помилка".
    const safeUsername = escapeMarkdown(usernameDisplay);
    const safeId = escapeMarkdown(updatedRecord.telegramUserId || noNameText[userLang]);
    const safeDescription = escapeMarkdown(updatedRecord.description);
    const safeProofLink = escapeMarkdown(updatedRecord.proofLink);

    // Текст відповіді на 4 мовах
    let responseText = "";

    if (userLang === "ua") {
      responseText =
        `🚨 **Знайдено збіг у базі:**\n\n` +
        `👤 **Юзернейм:** ${safeUsername}\n` +
        `🆔 **ID:** \`${safeId}\` \n` +
        `📊 **Статус:** ${getFormattedStatus(updatedRecord.status, "ua")}\n` +
        `📝 **Опис:** ${safeDescription || "Опис відсутній"}\n` +
        `👁 **Кількість переглядів:** ${updatedRecord.searchCount}\n` +
        `📅 **Дата додавання:** ${formattedDate}\n` +
        `🧾 **Докази:** ${safeProofLink || "Докази не надано"}\n\n` +
        `───────────────\n` +
        `🌐 **Наш сайт:** https://frostscambase.vercel.app/\n` +
        `💬 **Наш чат:** @wocmf\n` +
        `❤️ **Підтримати проєкт:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Додати скамера, переглянути інших або перевірених ботів можна на нашому сайті!*`;
    } else if (userLang === "ru") {
      responseText =
        `🚨 **Найдено совпадение в базе:**\n\n` +
        `👤 **Юзернейм:** ${safeUsername}\n` +
        `🆔 **ID:** \`${safeId}\` \n` +
        `📊 **Статус:** ${getFormattedStatus(updatedRecord.status, "ru")}\n` +
        `📝 **Описание:** ${safeDescription || "Описание отсутствует"}\n` +
        `👁 **Количество просмотров:** ${updatedRecord.searchCount}\n` +
        `📅 **Дата добавления:** ${formattedDate}\n` +
        `🧾 **Пруфы:** ${safeProofLink || "Пруфы не предоставлены"}\n\n` +
        `───────────────\n` +
        `🌐 **Наш сайт:** https://frostscambase.vercel.app/\n` +
        `💬 **Наш чат:** @wocmf\n` +
        `❤️ **Поддержать проект:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Добавить скамера, посмотреть других скамеров или проверенных ботов можно на нашем сайте!*`;
    } else if (userLang === "pl") {
      responseText =
        `🚨 **Znaleziono wpis w bazie danych:**\n\n` +
        `👤 **Nazwa użytkownika:** ${safeUsername}\n` +
        `🆔 **ID:** \`${safeId}\` \n` +
        `📊 **Status:** ${getFormattedStatus(updatedRecord.status, "pl")}\n` +
        `📝 **Opis:** ${safeDescription || "Brak opisu"}\n` +
        `👁 **Liczba wyświetleń:** ${updatedRecord.searchCount}\n` +
        `📅 **Data dodania:** ${formattedDate}\n` +
        `🧾 **Dowody:** ${safeProofLink || "Brak dowodów"}\n\n` +
        `───────────────\n` +
        `🌐 **Nasza strona:** https://frostscambase.vercel.app/\n` +
        `💬 **Nasz czat:** @wocmf\n` +
        `❤️ **Wesprzyj projekt:** t.me/send?start=IVkrkNlUFFtA\n\n` +
        `💡 *Możesz dodać oszusta, przejrzeć innych lub sprawdzić zweryfikowane boty na naszej stronie!*`;
    } else {
      responseText =
        `🚨 **Record found in database:**\n\n` +
        `👤 **Username:** ${safeUsername}\n` +
        `🆔 **ID:** \`${safeId}\` \n` +
        `📊 **Status:** ${getFormattedStatus(updatedRecord.status, "en")}\n` +
        `📝 **Description:** ${safeDescription || "No description available"}\n` +
        `👁 **Search count:** ${updatedRecord.searchCount}\n` +
        `📅 **Date added:** ${formattedDate}\n` +
        `🧾 **Proofs:** ${safeProofLink || "No proof provided"}\n\n` +
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
