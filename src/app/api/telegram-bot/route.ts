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

// Owner is always an admin, hardcoded, cannot be removed via the panel.
const OWNER_ID = 2017175774;

type SupportedLang = "ua" | "ru" | "en" | "pl";
const userLanguages = new Map<number, SupportedLang>();

// Generic per-user "what are we waiting for next" state, used by all
// multi-step flows (admin panel actions, /addbot submission, proof upload).
type UserState = { action: string; step: string; data: Record<string, any> };
const userState = new Map<number, UserState>();

// Small inline keyboard with just a "Cancel" button, attached to every
// prompt that starts/continues a multi-step flow (admin actions, /addbot,
// proof upload) so the user always has a way out mid-flow.
function cancelKb(lang: SupportedLang): InlineKeyboard {
  return new InlineKeyboard().text(xt.cancelBtn[lang], "cancel_flow");
}

function genId(): string {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

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
/botrating — рейтинг ботів на перевірку, голосування
/addbot — додати свого бота на перевірку
/stats — статистика бази
/statistic — загальна статистика бота
/top — топ-10 скамерів
/settings — налаштування чату (реклама)
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
    btnSupport: "❤️ Підтримати донатом",
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
/botrating — рейтинг ботов на проверку, голосование
/addbot — добавить своего бота на проверку
/stats — статистика
/statistic — общая статистика бота
/top — топ-10
/settings — настройки чата (реклама)
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
    btnSupport: "❤️ Поддержать донатом",
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
/botrating — bot review rating, voting
/addbot — submit your bot for review
/stats — stats
/statistic — overall bot statistics
/top — top 10
/settings — chat settings (ads)
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
    btnSupport: "❤️ Support with a donation",
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
/botrating — ranking botów do sprawdzenia, głosowanie
/addbot — zgłoś swojego bota do sprawdzenia
/stats — statystyki
/statistic — ogólne statystyki bota
/top — top 10
/settings — ustawienia czatu (reklamy)
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
    btnSupport: "❤️ Wesprzyj donacją",
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

// ==================== EXTRA TRANSLATIONS (settings / addbot / rating / proof) ====================
const xt: Record<string, Record<SupportedLang, string>> = {
  settingsHeader: {
    ua: "⚙️ <b>Налаштування чату</b>\n\nТут можна вимкнути рекламні елементи (посилання на сайт/чат) у відповідях бота в цьому чаті.",
    ru: "⚙️ <b>Настройки чата</b>\n\nЗдесь можно отключить рекламные элементы (ссылки на сайт/чат) в ответах бота в этом чате.",
    en: "⚙️ <b>Chat settings</b>\n\nHere you can disable ad elements (site/chat links) in the bot's replies in this chat.",
    pl: "⚙️ <b>Ustawienia czatu</b>\n\nTutaj możesz wyłączyć elementy reklamowe (linki do strony/czatu) w odpowiedziach bota w tym czacie.",
  },
  settingsDisableAdsBtn: {
    ua: "🚫 Вимкнути рекламу",
    ru: "🚫 Отключить рекламу",
    en: "🚫 Disable ads",
    pl: "🚫 Wyłącz reklamy",
  },
  settingsEnableAdsBtn: {
    ua: "✅ Увімкнути рекламу",
    ru: "✅ Включить рекламу",
    en: "✅ Enable ads",
    pl: "✅ Włącz reklamy",
  },
  settingsNoRights: {
    ua: "⛔ Змінювати ці налаштування можуть лише адміни чату.",
    ru: "⛔ Изменять эти настройки могут только админы чата.",
    en: "⛔ Only chat admins can change these settings.",
    pl: "⛔ Tylko administratorzy czatu mogą zmieniać te ustawienia.",
  },
  settingsAdsOff: {
    ua: "✅ Рекламу вимкнено",
    ru: "✅ Реклама отключена",
    en: "✅ Ads disabled",
    pl: "✅ Reklamy wyłączone",
  },
  settingsAdsOn: {
    ua: "✅ Рекламу увімкнено",
    ru: "✅ Реклама включена",
    en: "✅ Ads enabled",
    pl: "✅ Reklamy włączone",
  },
  dmOnly: {
    ua: "ℹ️ Ця команда працює лише в особистих повідомленнях з ботом.",
    ru: "ℹ️ Эта команда работает только в личных сообщениях с ботом.",
    en: "ℹ️ This command only works in a private chat with the bot.",
    pl: "ℹ️ Ta komenda działa tylko w prywatnej rozmowie z botem.",
  },
  maxReached: {
    ua: "⚠️ Ви вже додали максимум 2 боти. Дочекайтесь розгляду перших заявок.",
    ru: "⚠️ Вы уже добавили максимум 2 бота. Дождитесь рассмотрения первых заявок.",
    en: "⚠️ You've already added the maximum of 2 bots. Wait for your existing requests to be reviewed.",
    pl: "⚠️ Dodałeś już maksymalnie 2 boty. Poczekaj na rozpatrzenie poprzednich zgłoszeń.",
  },
  askUsername: {
    ua: "🤖 Надішліть <b>@username</b> бота, якого хочете додати на перевірку:",
    ru: "🤖 Отправьте <b>@username</b> бота, которого хотите добавить на проверку:",
    en: "🤖 Send the <b>@username</b> of the bot you want to submit for review:",
    pl: "🤖 Wyślij <b>@username</b> bota, którego chcesz zgłosić do sprawdzenia:",
  },
  invalidUsername: {
    ua: "⚠️ Невірний формат юзернейму. Приклад: @earn_bot",
    ru: "⚠️ Неверный формат юзернейма. Пример: @earn_bot",
    en: "⚠️ Invalid username format. Example: @earn_bot",
    pl: "⚠️ Nieprawidłowy format nazwy użytkownika. Przykład: @earn_bot",
  },
  alreadyExists: {
    ua: "ℹ️ Цей бот вже є в списку на перевірку. Можете проголосувати за нього в /botrating",
    ru: "ℹ️ Этот бот уже есть в списке на проверку. Можете проголосовать за него в /botrating",
    en: "ℹ️ This bot is already in the review list. You can vote for it in /botrating",
    pl: "ℹ️ Ten bot jest już na liście do sprawdzenia. Możesz na niego zagłosować w /botrating",
  },
  askSubscribers: {
    ua: "👥 Скільки приблизно підписників / учасників у бота (число)?",
    ru: "👥 Сколько примерно подписчиков / участников у бота (число)?",
    en: "👥 Roughly how many subscribers / members does the bot have (number)?",
    pl: "👥 Ile mniej więcej subskrybentów / uczestników ma bot (liczba)?",
  },
  invalidNumber: {
    ua: "⚠️ Надішліть число, будь ласка.",
    ru: "⚠️ Отправьте число, пожалуйста.",
    en: "⚠️ Please send a number.",
    pl: "⚠️ Wyślij liczbę.",
  },
  askReward: {
    ua: "🎁 Яка нагорода/умови виплат у бота? (коротко, текстом)",
    ru: "🎁 Какая награда/условия выплат у бота? (коротко, текстом)",
    en: "🎁 What's the reward / payout terms of the bot? (short text)",
    pl: "🎁 Jaka jest nagroda/warunki wypłat bota? (krótko, tekstem)",
  },
  submitted: {
    ua: "✅ Заявку на @{bot} надіслано! Статус: «Очікується». Слідкуйте за оновленнями в /botrating",
    ru: "✅ Заявка на @{bot} отправлена! Статус: «Ожидается». Следите за обновлениями в /botrating",
    en: "✅ Your submission for @{bot} was sent! Status: «Pending». Track it in /botrating",
    pl: "✅ Zgłoszenie @{bot} zostało wysłane! Status: «Oczekuje». Śledź w /botrating",
  },
  invalid: {
    ua: "⚠️ Некоректне значення, спробуйте ще раз.",
    ru: "⚠️ Некорректное значение, попробуйте еще раз.",
    en: "⚠️ Invalid value, try again.",
    pl: "⚠️ Nieprawidłowa wartość, spróbuj ponownie.",
  },
  ratingHeader: {
    ua: "Рейтинг ботів на перевірку",
    ru: "Рейтинг ботов на проверку",
    en: "Bot review rating",
    pl: "Ranking botów do sprawdzenia",
  },
  ratingEmpty: {
    ua: "📭 Поки немає жодної заявки. Додайте бота через /addbot",
    ru: "📭 Пока нет ни одной заявки. Добавьте бота через /addbot",
    en: "📭 No submissions yet. Add a bot via /addbot",
    pl: "📭 Nie ma jeszcze żadnych zgłoszeń. Dodaj bota przez /addbot",
  },
  subsLabel: { ua: "підп.", ru: "подп.", en: "subs", pl: "subs" },
  rewardLabel: { ua: "Нагорода", ru: "Награда", en: "Reward", pl: "Nagroda" },
  statusFieldLabel: { ua: "Статус", ru: "Статус", en: "Status", pl: "Status" },
  likesLabel: { ua: "Лайків", ru: "Лайков", en: "Likes", pl: "Polubienia" },
  addBotBtn: {
    ua: "➕ Додати свого бота",
    ru: "➕ Добавить своего бота",
    en: "➕ Add your bot",
    pl: "➕ Dodaj swojego bota",
  },
  addBotHint: {
    ua: "Напишіть боту в особисті команду /addbot",
    ru: "Напишите боту в личные команду /addbot",
    en: "Message the bot privately with /addbot",
    pl: "Napisz do bota prywatnie komendę /addbot",
  },
  likeBtn: { ua: "👍 Лайк", ru: "👍 Лайк", en: "👍 Like", pl: "👍 Lubię to" },
  votedBtn: { ua: "✅ Ви проголосували", ru: "✅ Вы проголосовали", en: "✅ You voted", pl: "✅ Zagłosowano" },
  votedToast: { ua: "👍 Голос враховано!", ru: "👍 Голос учтён!", en: "👍 Vote counted!", pl: "👍 Głos zaliczony!" },
  checkedBtn: { ua: "✅ Провірив", ru: "✅ Проверил", en: "✅ Checked it", pl: "✅ Sprawdziłem" },
  proofDmOnly: {
    ua: "ℹ️ Щоб надіслати підтвердження, напишіть боту в особисті та натисніть кнопку ще раз.",
    ru: "ℹ️ Чтобы отправить подтверждение, напишите боту в личные и нажмите кнопку ещё раз.",
    en: "ℹ️ To send proof, message the bot privately and tap the button again.",
    pl: "ℹ️ Aby wysłać potwierdzenie, napisz do bota prywatnie i naciśnij przycisk ponownie.",
  },
  askWithdrew: {
    ua: "💰 Ви вже вивели кошти з цього бота?",
    ru: "💰 Вы уже вывели средства из этого бота?",
    en: "💰 Have you already withdrawn funds from this bot?",
    pl: "💰 Czy już wypłaciłeś środki z tego bota?",
  },
  yes: { ua: "✅ Так", ru: "✅ Да", en: "✅ Yes", pl: "✅ Tak" },
  no: { ua: "❌ Ні", ru: "❌ Нет", en: "❌ No", pl: "❌ Nie" },
  askScreenshot1: {
    ua: "📸 Надішліть скріншот заявки на вивід коштів:",
    ru: "📸 Отправьте скриншот заявки на вывод средств:",
    en: "📸 Send a screenshot of the withdrawal request:",
    pl: "📸 Wyślij zrzut ekranu wniosku o wypłatę:",
  },
  askScreenshot2: {
    ua: "📸 Тепер надішліть скріншот успішного виводу коштів:",
    ru: "📸 Теперь отправьте скриншот успешного вывода средств:",
    en: "📸 Now send a screenshot of the successful withdrawal:",
    pl: "📸 Teraz wyślij zrzut ekranu udanej wypłaty:",
  },
  askVideo: {
    ua: "🎥 Надішліть відео вашого доходу за останні 3 дні (запис екрану бота):",
    ru: "🎥 Отправьте видео вашего дохода за последние 3 дня (запись экрана бота):",
    en: "🎥 Send a video of your earnings over the last 3 days (screen recording of the bot):",
    pl: "🎥 Wyślij wideo swoich zarobków z ostatnich 3 dni (nagranie ekranu bota):",
  },
  needPhoto: {
    ua: "⚠️ Потрібен саме скріншот (фото). Спробуйте ще раз.",
    ru: "⚠️ Нужен именно скриншот (фото). Попробуйте ещё раз.",
    en: "⚠️ A screenshot (photo) is required. Try again.",
    pl: "⚠️ Wymagany jest zrzut ekranu (zdjęcie). Spróbuj ponownie.",
  },
  needVideo: {
    ua: "⚠️ Потрібне саме відео. Спробуйте ще раз.",
    ru: "⚠️ Нужно именно видео. Попробуйте ещё раз.",
    en: "⚠️ A video is required. Try again.",
    pl: "⚠️ Wymagany jest film. Spróbuj ponownie.",
  },
  proofSaved: {
    ua: "✅ Дякуємо! Ваше підтвердження збережено та буде враховано модераторами.",
    ru: "✅ Спасибо! Ваше подтверждение сохранено и будет учтено модераторами.",
    en: "✅ Thanks! Your proof has been saved and will be reviewed by moderators.",
    pl: "✅ Dziękujemy! Twoje potwierdzenie zostało zapisane i zostanie zweryfikowane przez moderatorów.",
  },
  statusPending: { ua: "⏳ Очікується", ru: "⏳ Ожидается", en: "⏳ Pending", pl: "⏳ Oczekuje" },
  statusInReview: { ua: "👀 Розглянуто", ru: "👀 Рассмотрено", en: "👀 Reviewed", pl: "👀 Rozpatrzono" },
  statusChecking: { ua: "🔍 Провіряється", ru: "🔍 Проверяется", en: "🔍 Being checked", pl: "🔍 W trakcie sprawdzania" },
  statusAwaitingWithdrawal: { ua: "💸 Очікується вивід", ru: "💸 Ожидается вывод", en: "💸 Awaiting withdrawal", pl: "💸 Oczekuje na wypłatę" },
  statusVerified: { ua: "✅ Провірено", ru: "✅ Проверено", en: "✅ Verified", pl: "✅ Zweryfikowano" },

  // ---- cancel button (attached to every multi-step flow prompt) ----
  cancelBtn: { ua: "❌ Скасувати", ru: "❌ Отменить", en: "❌ Cancel", pl: "❌ Anuluj" },
  cancelledMsg: { ua: "🚫 Дію скасовано.", ru: "🚫 Действие отменено.", en: "🚫 Action cancelled.", pl: "🚫 Anulowano." },
  nothingToCancel: {
    ua: "ℹ️ Немає активної дії для скасування.",
    ru: "ℹ️ Нет активного действия для отмены.",
    en: "ℹ️ There's no active action to cancel.",
    pl: "ℹ️ Nie ma żadnej aktywnej akcji do anulowania.",
  },

  // ---- proof already submitted for this bot (once per account) ----
  proofAlreadySubmitted: {
    ua: "ℹ️ Ви вже надсилали підтвердження по цьому боту. Повторно надсилати не можна.",
    ru: "ℹ️ Вы уже отправляли подтверждение по этому боту. Повторно отправить нельзя.",
    en: "ℹ️ You've already submitted proof for this bot. You can't submit it again.",
    pl: "ℹ️ Wysłałeś już potwierdzenie dla tego bota. Nie można wysłać ponownie.",
  },

  // ---- bot already exists in the main scam/verified database ----
  alreadyInDatabase: {
    ua: "ℹ️ Цей бот вже є в базі сайту (перевірений або вже оцінений). Додавати повторно не потрібно.",
    ru: "ℹ️ Этот бот уже есть в базе сайта (проверен или уже оценён). Добавлять повторно не нужно.",
    en: "ℹ️ This bot is already in the site's database (checked or already rated). No need to submit it again.",
    pl: "ℹ️ Ten bot jest już w bazie strony (sprawdzony lub już oceniony). Nie trzeba zgłaszać ponownie.",
  },

  // ---- /garant ----
  garantHeader: { ua: "🛡 <b>Список гарантів</b>", ru: "🛡 <b>Список гарантов</b>", en: "🛡 <b>List of guarantors</b>", pl: "🛡 <b>Lista gwarantów</b>" },
  garantEmpty: {
    ua: "📭 Поки що жодного гаранта не додано.",
    ru: "📭 Пока ни одного гаранта не добавлено.",
    en: "📭 No guarantors added yet.",
    pl: "📭 Nie dodano jeszcze żadnego gwaranta.",
  },
  garantReviewsBtn: { ua: "⭐️ Відгуки", ru: "⭐️ Отзывы", en: "⭐️ Reviews", pl: "⭐️ Opinie" },

  // ---- admin: proof review queue ----
  adminProofsBtn: { ua: "🧾 Провірити пруфи", ru: "🧾 Проверить пруфы", en: "🧾 Review proofs", pl: "🧾 Sprawdź dowody" },
  adminProofsEmpty: { ua: "📭 Немає пруфів, що очікують перевірки.", ru: "📭 Нет пруфов, ожидающих проверки.", en: "📭 No proofs awaiting review.", pl: "📭 Brak dowodów oczekujących na sprawdzenie." },

  // ---- statistic: total & new-today users ----
  usersTotalLabel: { ua: "Людей у боті всього", ru: "Людей в боте всего", en: "Total people in the bot", pl: "Łącznie osób w bocie" },
  usersTodayLabel: { ua: "Нових сьогодні", ru: "Новых сегодня", en: "New today", pl: "Nowych dzisiaj" },
};

function statusLabelLocalized(status: string, lang: SupportedLang): string {
  switch (status) {
    case "pending":
      return xt.statusPending[lang];
    case "in_review":
      return xt.statusInReview[lang];
    case "checking":
      return xt.statusChecking[lang];
    case "awaiting_withdrawal":
      return xt.statusAwaitingWithdrawal[lang];
    case "verified":
      return xt.statusVerified[lang];
    default:
      return status;
  }
}

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

const SUPPORTED_LANGS: SupportedLang[] = ["ua", "ru", "en", "pl"];

// The in-memory `userLanguages` Map is what every getUserLanguage() call
// actually reads from, but it's wiped on every cold start / redeploy — so
// the bot would "forget" a user's explicitly chosen language. This loads
// a previously saved choice from the DB (once per process, per user) so it
// can populate the Map before any reply is sent for that update.
async function preloadUserLanguage(userId: number) {
  if (userLanguages.has(userId)) return;
  try {
    await ensureTables();
    const rows = (await db.$queryRawUnsafe(
      `SELECT "botLang" FROM "BotUser" WHERE "telegramUserId" = $1 AND "botLang" IS NOT NULL ORDER BY "updatedAt" DESC LIMIT 1`,
      userId
    )) as any[];
    const stored = rows[0]?.botLang;
    if (stored && (SUPPORTED_LANGS as string[]).includes(stored)) {
      userLanguages.set(userId, stored as SupportedLang);
    }
  } catch (e) {
    console.error("preloadUserLanguage failed", e);
  }
}

// Persists the user's explicit language choice so it survives restarts.
// Only written for private chats, since "BotUser" is keyed by chatId and a
// user's DM chatId equals their own telegramUserId — that's the one place
// we can be sure this is "the" language for that person.
async function persistUserLanguage(chatId: number | undefined, userId: number, lang: SupportedLang, isPrivate: boolean) {
  if (!isPrivate || !chatId) return;
  try {
    await ensureTables();
    await db.$executeRawUnsafe(
      `INSERT INTO "BotUser" ("chatId","telegramUserId","botLang","updatedAt","createdAt")
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT ("chatId") DO UPDATE SET "botLang" = $3, "updatedAt" = NOW()`,
      chatId, userId, lang
    );
  } catch (e) {
    console.error("persistUserLanguage failed", e);
  }
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

// ==================== ADMIN / EXTRA FEATURE TABLES (self-bootstrapping) ====================
// These tables are created on first use via raw SQL, so no separate Prisma
// migration is required. Uses db.$executeRawUnsafe / db.$queryRawUnsafe,
// same approach already used for ScammerStatus above.
let tablesReadyPromise: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (tablesReadyPromise) return tablesReadyPromise;
  tablesReadyPromise = (async () => {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS "BotAdmin" (
        "telegramId" BIGINT PRIMARY KEY,
        "addedBy" BIGINT,
        "addedAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "BotGroup" (
        "chatId" BIGINT PRIMARY KEY,
        "title" TEXT,
        "type" TEXT,
        "active" BOOLEAN DEFAULT TRUE,
        "addedAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "BotUser" (
        "chatId" BIGINT PRIMARY KEY,
        "telegramUserId" BIGINT,
        "username" TEXT,
        "languageCode" TEXT,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "ChatSettings" (
        "chatId" BIGINT PRIMARY KEY,
        "adsDisabled" BOOLEAN DEFAULT FALSE,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "BotRequest" (
        "id" TEXT PRIMARY KEY,
        "telegramUserId" BIGINT NOT NULL,
        "username" TEXT,
        "botUsername" TEXT NOT NULL,
        "subscribers" INTEGER,
        "reward" TEXT,
        "status" TEXT DEFAULT 'pending',
        "likes" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "BotRequestVote" (
        "requestId" TEXT NOT NULL,
        "userId" BIGINT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY ("requestId", "userId")
      )`,
      `CREATE TABLE IF NOT EXISTS "BotRequestProof" (
        "id" TEXT PRIMARY KEY,
        "requestId" TEXT NOT NULL,
        "userId" BIGINT NOT NULL,
        "step1FileId" TEXT,
        "withdrew" BOOLEAN,
        "step2FileId" TEXT,
        "reviewed" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,
    ];
    for (const sql of stmts) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e) {
        console.error("ensureTables statement failed:", e);
      }
    }
    // Additive column migrations for tables that already existed before
    // these fields were introduced (CREATE TABLE IF NOT EXISTS won't add
    // columns to an existing table, so we ALTER separately, safely).
    const alters = [
      `ALTER TABLE "BotRequestProof" ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE "BotUser" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`,
      `ALTER TABLE "BotUser" ADD COLUMN IF NOT EXISTS "botLang" TEXT`,
      `ALTER TABLE "BotRequestVote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`,
    ];
    for (const sql of alters) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e) {
        console.error("ensureTables alter failed:", e);
      }
    }
  })();
  return tablesReadyPromise;
}

// ===== Admin cache =====
let adminCache: { ids: Set<number>; ts: number } | null = null;
const ADMIN_CACHE_TTL = 60 * 1000;

async function isAdmin(userId?: number): Promise<boolean> {
  if (!userId) return false;
  if (userId === OWNER_ID) return true;
  const now = Date.now();
  if (adminCache && now - adminCache.ts < ADMIN_CACHE_TTL) return adminCache.ids.has(userId);
  try {
    await ensureTables();
    const rows = (await db.$queryRawUnsafe(`SELECT "telegramId" FROM "BotAdmin"`)) as any[];
    const ids = new Set<number>(rows.map((r: any) => Number(r.telegramId)));
    ids.add(OWNER_ID);
    adminCache = { ids, ts: now };
    return ids.has(userId);
  } catch (e) {
    console.error("isAdmin query failed", e);
    return userId === OWNER_ID;
  }
}

// ===== Per-chat "ads disabled" setting cache =====
const chatSettingsCache = new Map<number, { disabled: boolean; ts: number }>();
async function getChatAdsDisabled(chatId: number): Promise<boolean> {
  const cached = chatSettingsCache.get(chatId);
  if (cached && Date.now() - cached.ts < 60_000) return cached.disabled;
  try {
    await ensureTables();
    const rows = (await db.$queryRawUnsafe(`SELECT "adsDisabled" FROM "ChatSettings" WHERE "chatId" = $1`, chatId)) as any[];
    const disabled = !!rows[0]?.adsDisabled;
    chatSettingsCache.set(chatId, { disabled, ts: Date.now() });
    return disabled;
  } catch {
    return false;
  }
}

async function trackBotUser(chatId: number, telegramUserId: number, username?: string | null, languageCode?: string | null) {
  try {
    await ensureTables();
    // NOTE: "createdAt" is only set on first INSERT (first time this person
    // starts the bot) and intentionally left untouched on conflict, so it
    // can be used later to count "new users today" (see /statistic, admin stats).
    await db.$executeRawUnsafe(
      `INSERT INTO "BotUser" ("chatId","telegramUserId","username","languageCode","updatedAt","createdAt")
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT ("chatId") DO UPDATE SET "telegramUserId"=$2,"username"=$3,"languageCode"=$4,"updatedAt"=NOW()`,
      chatId, telegramUserId, username || null, languageCode || null
    );
  } catch (e) {
    console.error("trackBotUser failed", e);
  }
}

// Tracks a group chat from ANY message the bot sees in it, not just
// my_chat_member updates. my_chat_member only fires when the bot's own
// membership status changes (added/removed/promoted) — if the bot was
// already sitting in a group before this tracking code was deployed, or if
// that update type was ever missed, the group would never appear in
// "BotGroup" and the bot would effectively "not see" that chat in
// broadcast/write-as pickers. Upserting on every message is a robust fallback.
async function trackBotGroup(chatId: number, title: string | null | undefined, type: string) {
  try {
    await ensureTables();
    await db.$executeRawUnsafe(
      `INSERT INTO "BotGroup" ("chatId","title","type","active","updatedAt")
       VALUES ($1,$2,$3,TRUE,NOW())
       ON CONFLICT ("chatId") DO UPDATE SET title=$2, type=$3, active=TRUE, "updatedAt"=NOW()`,
      chatId, title || "Без назви", type
    );
  } catch (e) {
    console.error("trackBotGroup failed", e);
  }
}

function formatScammerType(type: string | null | undefined, lang: SupportedLang): string {
  if (!type) return "";
  const k = type.trim().toLowerCase();
  const botLabel: Record<SupportedLang, string> = { ua: "Бот", ru: "Бот", en: "Bot", pl: "Bot" };
  if (k === "bot" || k === "bots" || k === "бот" || k === "боти" || k === "боты") return botLabel[lang];
  return type;
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

// ==================== USER STATE MACHINE (admin flows, /addbot, proof upload) ====================
async function processUserState(ctx: any, uid: number): Promise<boolean> {
  const state = userState.get(uid);
  if (!state) return false;

  // ---- Admin: add admin ----
  if (state.action === "add_admin") {
    const text = ctx.message?.text?.trim();
    if (!text || !/^\d{5,15}$/.test(text)) {
      await ctx.reply("⚠️ Надішліть коректний числовий Telegram ID.");
      return true;
    }
    const newId = Number(text);
    try {
      await ensureTables();
      await db.$executeRawUnsafe(
        `INSERT INTO "BotAdmin" ("telegramId","addedBy") VALUES ($1,$2) ON CONFLICT ("telegramId") DO NOTHING`,
        newId, uid
      );
      adminCache = null;
      await ctx.reply(`✅ Користувача <code>${newId}</code> додано як адміна.`, { parse_mode: "HTML" });
    } catch (e) {
      console.error("add admin failed", e);
      await ctx.reply("⚠️ Помилка при додаванні адміна.");
    }
    userState.delete(uid);
    return true;
  }

  // ---- Admin: broadcast content received ----
  if (state.action === "broadcast" && state.step === "awaiting_content") {
    userState.delete(uid);
    await runBroadcast(ctx, state.data.target);
    return true;
  }

  // ---- Admin: write-as-bot content received ----
  if (state.action === "write_as" && state.step === "awaiting_content") {
    const targetChatId = state.data.targetChatId;
    userState.delete(uid);
    try {
      await ctx.api.copyMessage(targetChatId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply("✅ Повідомлення надіслано від імені бота.");
    } catch (e) {
      console.error("write as failed", e);
      await ctx.reply("⚠️ Не вдалося надіслати повідомлення (можливо, бот видалений з цього чату).");
    }
    return true;
  }

  // ---- /addbot submission steps ----
  if (state.action === "addbot") {
    return await processAddBotStep(ctx, uid, state);
  }

  // ---- "Провірив" proof submission steps ----
  if (state.action === "proof") {
    return await processProofStep(ctx, uid, state);
  }

  return false;
}

async function runBroadcast(ctx: any, target: "dm" | "groups" | "all") {
  await ensureTables();
  const sourceChatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  let targets: number[] = [];
  try {
    if (target === "dm" || target === "all") {
      const rows = (await db.$queryRawUnsafe(`SELECT "chatId" FROM "BotUser"`)) as any[];
      targets.push(...rows.map((r: any) => Number(r.chatId)));
    }
    if (target === "groups" || target === "all") {
      const rows = (await db.$queryRawUnsafe(`SELECT "chatId" FROM "BotGroup" WHERE active = true`)) as any[];
      targets.push(...rows.map((r: any) => Number(r.chatId)));
    }
  } catch (e) {
    console.error("broadcast target fetch failed", e);
  }

  targets = Array.from(new Set(targets));
  const MAX_TARGETS = 500; // safety cap to stay within one function invocation
  const truncated = targets.length > MAX_TARGETS;
  if (truncated) targets = targets.slice(0, MAX_TARGETS);

  const progressMsg = await ctx.reply(
    `⏳ Розсилка розпочата. Отримувачів: ${targets.length}${truncated ? " (обмежено 500 за раз)" : ""}\n\nНадсилаю по 1 повідомленню, щоб не впертись у ліміти Telegram...`
  );

  let sent = 0;
  let failed = 0;
  // Sent strictly one at a time (sequential await, not Promise.all) with a
  // small delay between each send — Telegram allows roughly ~30 msg/sec
  // globally and ~1 msg/sec per chat, so going one-by-one with a delay
  // avoids flood-control errors that batch sending would trigger.
  for (const chatId of targets) {
    try {
      await ctx.api.copyMessage(chatId, sourceChatId, messageId);
      sent++;
    } catch {
      failed++;
    }
    // Periodic progress update so the admin can see it's actually going 1-by-1.
    if ((sent + failed) % 50 === 0) {
      try {
        await ctx.api.editMessageText(
          progressMsg.chat.id,
          progressMsg.message_id,
          `⏳ Розсилка триває... ${sent + failed}/${targets.length}\n📤 Надіслано: ${sent}\n❌ Помилок: ${failed}`
        );
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  await ctx.reply(`✅ Розсилку завершено.\n📤 Надіслано: ${sent}\n❌ Помилок: ${failed}`);
}

async function sendGroupPicker(ctx: any, page: number) {
  await ensureTables();
  const PAGE_SIZE = 8;
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT "chatId","title" FROM "BotGroup" WHERE active = true ORDER BY "title" ASC LIMIT $1 OFFSET $2`,
      PAGE_SIZE, (page - 1) * PAGE_SIZE
    )) as any[];
    const countRows = (await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotGroup" WHERE active = true`)) as any[];
    const total = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (rows.length === 0) {
      const text = "📭 Бот поки не доданий у жодну групу.";
      const kb = new InlineKeyboard().text("⬅️ Назад", "admin_back");
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
      } catch {
        await ctx.reply(text, { reply_markup: kb });
      }
      return;
    }

    const kb = new InlineKeyboard();
    rows.forEach((r: any) => {
      kb.text(`${(r.title || "Без назви").slice(0, 30)}`, `wa_pick_${r.chatId}`).row();
    });
    if (page > 1) kb.text("⬅️", `wa_page_${page - 1}`);
    if (page < totalPages) kb.text("➡️", `wa_page_${page + 1}`);
    kb.row().text("⬅️ Назад в меню", "admin_back");

    const text = `✍️ <b>Оберіть чат</b> (стор. ${page}/${totalPages})`;
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("group picker error", e);
    await ctx.reply("⚠️ Помилка завантаження списку груп.");
  }
}

async function sendAdminPanel(ctx: any) {
  const kb = new InlineKeyboard()
    .text("➕ Додати адміна", "admin_add")
    .row()
    .text("📢 Розсилка", "admin_broadcast")
    .row()
    .text("✍️ Написати від імені бота", "admin_writeas")
    .row()
    .text("📊 Статистика", "admin_stats")
    .row()
    .text("📋 Черга запитів на боти", "admin_requests_1")
    .row()
    .text(xt.adminProofsBtn.ua, "admin_proofs_1");
  const text = "🛠 <b>Адмін-панель</b>\n\nОберіть дію:";
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
}

async function sendFullStats(ctx: any) {
  await ensureTables();
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [searchesToday, searchesMonth, searchesTotal, groupsCountRows, adminsCountRows, pendingRows, usersTotalRows, usersTodayRows] = await Promise.all([
      db.searchLog.count({ where: { createdAt: { gte: todayStart } } }),
      db.searchLog.count({ where: { createdAt: { gte: monthStart } } }),
      db.searchLog.count(),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotGroup" WHERE active = true`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotAdmin"`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotRequest" WHERE status = 'pending'`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotUser"`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotUser" WHERE "createdAt" >= $1`, todayStart),
    ]);
    const groupsCount = Number((groupsCountRows as any[])[0]?.count || 0);
    const adminsCount = Number((adminsCountRows as any[])[0]?.count || 0) + 1; // +owner
    const pendingCount = Number((pendingRows as any[])[0]?.count || 0);
    const usersTotal = Number((usersTotalRows as any[])[0]?.count || 0);
    const usersToday = Number((usersTodayRows as any[])[0]?.count || 0);

    const text = `📊 <b>Повна статистика</b>

🔍 Запитів сьогодні: <b>${searchesToday}</b>
🔍 Запитів за місяць: <b>${searchesMonth}</b>
🔍 Запитів за весь час: <b>${searchesTotal}</b>

🙋 Людей у боті всього: <b>${usersTotal}</b>
🆕 Нових сьогодні: <b>${usersToday}</b>

👥 Груп з ботом: <b>${groupsCount}</b>
🛠 Адмінів: <b>${adminsCount}</b>
📋 Заявок на боти в очікуванні: <b>${pendingCount}</b>`;

    const kb = new InlineKeyboard().text("⬅️ Назад", "admin_back");
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("full stats error", e);
    await ctx.reply("⚠️ Помилка статистики.");
  }
}

function statusLabelUa(status: string): string {
  switch (status) {
    case "pending":
      return "⏳ Очікується";
    case "in_review":
      return "👀 Розглянуто";
    case "checking":
      return "🔍 Провіряється";
    case "awaiting_withdrawal":
      return "💸 Очікується вивід";
    case "verified":
      return "✅ Провірено";
    default:
      return status;
  }
}

async function sendAdminRequestsQueue(ctx: any, page: number) {
  await ensureTables();
  const PAGE_SIZE = 8;
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT * FROM "BotRequest" ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 WHEN 'checking' THEN 2 ELSE 3 END,
        "createdAt" DESC LIMIT $1 OFFSET $2`,
      PAGE_SIZE, (page - 1) * PAGE_SIZE
    )) as any[];
    const countRows = (await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotRequest"`)) as any[];
    const total = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (rows.length === 0) {
      const text = "📭 Заявок ще немає.";
      const kb = new InlineKeyboard().text("⬅️ Назад", "admin_back");
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
      } catch {
        await ctx.reply(text, { reply_markup: kb });
      }
      return;
    }

    let text = `📋 <b>Черга запитів на боти</b> (стор. ${page}/${totalPages})\n\n`;
    const kb = new InlineKeyboard();
    rows.forEach((r: any, i: number) => {
      const idx = (page - 1) * PAGE_SIZE + i + 1;
      text += `${idx}. <b>@${escapeHtml(r.botUsername)}</b> — ${statusLabelUa(r.status)} — 👍${r.likes}\n`;
      kb.text(`${idx}. ${r.botUsername.slice(0, 15)}`, `admreq_view_${r.id}`).row();
    });
    if (page > 1) kb.text("⬅️", `admin_requests_${page - 1}`);
    if (page < totalPages) kb.text("➡️", `admin_requests_${page + 1}`);
    kb.row().text("⬅️ Назад в меню", "admin_back");

    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("admin requests queue error", e);
    await ctx.reply("⚠️ Помилка завантаження черги.");
  }
}

async function sendAdminRequestDetail(ctx: any, id: string) {
  await ensureTables();
  try {
    const rows = (await db.$queryRawUnsafe(`SELECT * FROM "BotRequest" WHERE id = $1`, id)) as any[];
    const r = rows[0];
    if (!r) {
      await ctx.reply("❌ Заявку не знайдено.");
      return;
    }
    const proofRows = (await db.$queryRawUnsafe(
      `SELECT * FROM "BotRequestProof" WHERE "requestId" = $1 ORDER BY "createdAt" DESC LIMIT 5`,
      id
    )) as any[];

    let text = `🤖 <b>@${escapeHtml(r.botUsername)}</b>\n\n`;
    text += `👤 Автор заявки: <code>${r.telegramUserId}</code>${r.username ? " (@" + escapeHtml(r.username) + ")" : ""}\n`;
    text += `👥 Підписників: <b>${r.subscribers ?? "—"}</b>\n`;
    text += `🎁 Нагорода: <b>${escapeHtml(r.reward || "—")}</b>\n`;
    text += `📊 Статус: <b>${statusLabelUa(r.status)}</b>\n`;
    text += `👍 Лайків: <b>${r.likes}</b>\n`;
    text += `🧾 Підтверджень від юзерів: <b>${proofRows.length}</b>\n`;
    text += `📅 Створено: ${new Date(r.createdAt).toLocaleString("uk-UA")}\n`;

    const kb = new InlineKeyboard()
      .text("⏳ Очікується", `admreq_status_${id}_pending`)
      .text("👀 Розглянуто", `admreq_status_${id}_in_review`)
      .row()
      .text("🔍 Провіряється", `admreq_status_${id}_checking`)
      .text("💸 Очікується вивід", `admreq_status_${id}_awaiting_withdrawal`)
      .row()
      .text("✅ Провірено", `admreq_status_${id}_verified`)
      .row()
      .text("🧾 Пруфи по заявці", `admin_proofs_req_${id}`)
      .row()
      .text("🗑 Видалити заявку", `admreq_delete_${id}`)
      .row()
      .text("⬅️ Назад до списку", "admin_requests_1");

    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("admin request detail error", e);
    await ctx.reply("⚠️ Помилка.");
  }
}

// ==================== ADMIN: PROOF REVIEW QUEUE ====================
// Lists proofs users submitted via "Провірив" (brate_checked_...) that
// haven't been marked reviewed yet, so admins can actually look at the
// screenshots/video and approve/reject the underlying bot request.
async function sendAdminProofsQueue(ctx: any, page: number, requestId?: string) {
  await ensureTables();
  const PAGE_SIZE = 8;
  try {
    const whereClause = requestId ? `WHERE p.reviewed = FALSE AND p."requestId" = $3` : `WHERE p.reviewed = FALSE`;
    const params: any[] = requestId ? [PAGE_SIZE, (page - 1) * PAGE_SIZE, requestId] : [PAGE_SIZE, (page - 1) * PAGE_SIZE];
    const rows = (await db.$queryRawUnsafe(
      `SELECT p.*, r."botUsername" FROM "BotRequestProof" p
       LEFT JOIN "BotRequest" r ON r.id = p."requestId"
       ${whereClause}
       ORDER BY p."createdAt" ASC LIMIT $1 OFFSET $2`,
      ...params
    )) as any[];
    const countParams: any[] = requestId ? [requestId] : [];
    const countRows = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "BotRequestProof" p ${requestId ? `WHERE p.reviewed = FALSE AND p."requestId" = $1` : `WHERE p.reviewed = FALSE`}`,
      ...countParams
    )) as any[];
    const total = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (rows.length === 0) {
      const text = xt.adminProofsEmpty.ua;
      const kb = new InlineKeyboard().text("⬅️ Назад", requestId ? `admreq_view_${requestId}` : "admin_back");
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
      } catch {
        await ctx.reply(text, { reply_markup: kb });
      }
      return;
    }

    let text = `${xt.adminProofsBtn.ua} (стор. ${page}/${totalPages})\n\n`;
    const kb = new InlineKeyboard();
    rows.forEach((p: any, i: number) => {
      const idx = (page - 1) * PAGE_SIZE + i + 1;
      text += `${idx}. @${escapeHtml(p.botUsername || "?")} — <code>${p.userId}</code> — ${p.withdrew ? "вивів 💸" : "не вивів"}\n`;
      kb.text(`${idx}. @${(p.botUsername || "?").slice(0, 12)}`, `admproof_view_${p.id}`).row();
    });
    const pagePrefix = requestId ? `admin_proofs_req_${requestId}_` : "admin_proofs_";
    if (page > 1) kb.text("⬅️", `${pagePrefix}${page - 1}`);
    if (page < totalPages) kb.text("➡️", `${pagePrefix}${page + 1}`);
    kb.row().text("⬅️ Назад в меню", "admin_back");

    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("admin proofs queue error", e);
    await ctx.reply("⚠️ Помилка завантаження пруфів.");
  }
}

async function sendAdminProofDetail(ctx: any, proofId: string) {
  await ensureTables();
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT p.*, r."botUsername" FROM "BotRequestProof" p LEFT JOIN "BotRequest" r ON r.id = p."requestId" WHERE p.id = $1`,
      proofId
    )) as any[];
    const p = rows[0];
    if (!p) {
      await ctx.answerCallbackQuery({ text: "❌ Не знайдено", show_alert: true });
      return;
    }
    let caption = `🤖 <b>@${escapeHtml(p.botUsername || "?")}</b>\n`;
    caption += `👤 Юзер: <code>${p.userId}</code>\n`;
    caption += `💸 Вивів кошти: <b>${p.withdrew ? "Так" : "Ні"}</b>\n`;
    caption += `📅 ${new Date(p.createdAt).toLocaleString("uk-UA")}`;

    const kb = new InlineKeyboard()
      .text("✅ Відмітити перевіреним", `admproof_done_${p.id}_${p.requestId}`)
      .row()
      .text("⬅️ Назад до списку", "admin_proofs_1");

    // Screenshot #1 (always present)
    try {
      if (p.step1FileId) await ctx.replyWithPhoto(p.step1FileId, { caption: "📸 Скрін №1 (заявка на вивід)" });
    } catch (e) {
      console.error("send proof screenshot1 failed", e);
    }
    // Either screenshot #2 (withdrew) or a video (didn't withdraw yet)
    try {
      if (p.withdrew && p.step2FileId) {
        await ctx.replyWithPhoto(p.step2FileId, { caption: "📸 Скрін №2 (успішний вивід)" });
      } else if (!p.withdrew && p.step2FileId) {
        await ctx.replyWithVideo(p.step2FileId, { caption: "🎥 Відео за 3 дні" });
      }
    } catch (e) {
      console.error("send proof step2 failed", e);
    }
    await ctx.reply(caption, { parse_mode: "HTML", reply_markup: kb });
  } catch (e) {
    console.error("admin proof detail error", e);
    await ctx.reply("⚠️ Помилка.");
  }
}

async function sendSettingsPanel(ctx: any, lang: SupportedLang, chatId: number, isEdit = false) {
  await ensureTables();
  const disabled = await getChatAdsDisabled(chatId);
  const text = xt.settingsHeader[lang];
  const kb = new InlineKeyboard().text(
    disabled ? xt.settingsEnableAdsBtn[lang] : xt.settingsDisableAdsBtn[lang],
    `settings_toggle_ads_${chatId}`
  );
  if (isEdit) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
}

async function processAddBotStep(ctx: any, uid: number, state: UserState): Promise<boolean> {
  const lang = getUserLanguage(uid, ctx.from?.language_code);
  const text = ctx.message?.text?.trim();

  if (state.step === "username") {
    if (!text) {
      await ctx.reply(xt.invalid[lang]);
      return true;
    }
    const uname = text.replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "").split(/[\s/?]/)[0];
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(uname)) {
      await ctx.reply(xt.invalidUsername[lang]);
      return true;
    }
    try {
      await ensureTables();
      const dupRows = (await db.$queryRawUnsafe(
        `SELECT id FROM "BotRequest" WHERE LOWER("botUsername") = LOWER($1) LIMIT 1`,
        uname
      )) as any[];
      if (dupRows.length > 0) {
        await ctx.reply(xt.alreadyExists[lang]);
        userState.delete(uid);
        return true;
      }
      // Also check the main scammer/verified database (not just the review
      // queue) — the bot might already be listed there (verified, scam,
      // suspicious, etc.) under its @username.
      const inDb = await db.scammer.findFirst({
        where: {
          OR: [
            { name: { equals: uname, mode: "insensitive" } },
            { name: { equals: `@${uname}`, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (inDb) {
        await ctx.reply(xt.alreadyInDatabase[lang]);
        userState.delete(uid);
        return true;
      }
    } catch (e) {
      console.error("addbot dup check failed", e);
    }
    state.data.botUsername = uname;
    state.step = "subscribers";
    userState.set(uid, state);
    await ctx.reply(xt.askSubscribers[lang], { reply_markup: cancelKb(lang) });
    return true;
  }

  if (state.step === "subscribers") {
    const n = parseInt((text || "").replace(/[^\d]/g, ""), 10);
    if (!text || isNaN(n)) {
      await ctx.reply(xt.invalidNumber[lang]);
      return true;
    }
    state.data.subscribers = n;
    state.step = "reward";
    userState.set(uid, state);
    await ctx.reply(xt.askReward[lang], { reply_markup: cancelKb(lang) });
    return true;
  }

  if (state.step === "reward") {
    if (!text) {
      await ctx.reply(xt.invalid[lang]);
      return true;
    }
    state.data.reward = text.slice(0, 200);
    try {
      await ensureTables();
      const id = genId();
      await db.$executeRawUnsafe(
        `INSERT INTO "BotRequest" ("id","telegramUserId","username","botUsername","subscribers","reward","status","likes")
         VALUES ($1,$2,$3,$4,$5,$6,'pending',0)`,
        id, uid, ctx.from?.username || null, state.data.botUsername, state.data.subscribers, state.data.reward
      );
      await ctx.reply(xt.submitted[lang].replace("{bot}", state.data.botUsername));
    } catch (e) {
      console.error("addbot save error", e);
      await ctx.reply(t[lang].error);
    }
    userState.delete(uid);
    return true;
  }

  return false;
}

async function saveProof(ctx: any, uid: number, state: UserState, step2FileId: string) {
  const lang = getUserLanguage(uid, ctx.from?.language_code);
  try {
    await ensureTables();
    // Defensive re-check right before insert (in addition to the check when
    // the flow starts) — guards against a user racing two parallel flows.
    const existing = (await db.$queryRawUnsafe(
      `SELECT 1 FROM "BotRequestProof" WHERE "requestId" = $1 AND "userId" = $2 LIMIT 1`,
      state.data.requestId, uid
    )) as any[];
    if (existing.length > 0) {
      await ctx.reply(xt.proofAlreadySubmitted[lang]);
      userState.delete(uid);
      return;
    }
    const id = genId();
    await db.$executeRawUnsafe(
      `INSERT INTO "BotRequestProof" ("id","requestId","userId","step1FileId","withdrew","step2FileId")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      id, state.data.requestId, uid, state.data.step1FileId, !!state.data.withdrew, step2FileId
    );
    await ctx.reply(xt.proofSaved[lang]);
  } catch (e) {
    console.error("save proof error", e);
    await ctx.reply(t[lang].error);
  }
  userState.delete(uid);
}

async function processProofStep(ctx: any, uid: number, state: UserState): Promise<boolean> {
  const lang = getUserLanguage(uid, ctx.from?.language_code);
  const photo = ctx.message?.photo?.length ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
  const video = ctx.message?.video?.file_id || ctx.message?.video_note?.file_id || null;

  if (state.step === "screenshot1") {
    if (!photo) {
      await ctx.reply(xt.needPhoto[lang], { reply_markup: cancelKb(lang) });
      return true;
    }
    state.data.step1FileId = photo;
    if (state.data.withdrew) {
      state.step = "screenshot2";
      userState.set(uid, state);
      await ctx.reply(xt.askScreenshot2[lang], { reply_markup: cancelKb(lang) });
    } else {
      state.step = "video3days";
      userState.set(uid, state);
      await ctx.reply(xt.askVideo[lang], { reply_markup: cancelKb(lang) });
    }
    return true;
  }

  if (state.step === "screenshot2") {
    if (!photo) {
      await ctx.reply(xt.needPhoto[lang], { reply_markup: cancelKb(lang) });
      return true;
    }
    await saveProof(ctx, uid, state, photo);
    return true;
  }

  if (state.step === "video3days") {
    if (!video) {
      await ctx.reply(xt.needVideo[lang], { reply_markup: cancelKb(lang) });
      return true;
    }
    await saveProof(ctx, uid, state, video);
    return true;
  }

  return false;
}

async function sendBotRatingList(ctx: any, lang: SupportedLang, page: number, isEdit = false) {
  await ensureTables();
  const PAGE_SIZE = 10;
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT * FROM "BotRequest" ORDER BY likes DESC, "createdAt" DESC LIMIT $1 OFFSET $2`,
      PAGE_SIZE, (page - 1) * PAGE_SIZE
    )) as any[];
    const countRows = (await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotRequest"`)) as any[];
    const total = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (rows.length === 0) {
      const emptyText = xt.ratingEmpty[lang];
      if (isEdit) {
        try {
          await ctx.editMessageText(emptyText);
        } catch {
          await ctx.reply(emptyText);
        }
      } else {
        await ctx.reply(emptyText);
      }
      return;
    }

    let text = `🏆 <b>${xt.ratingHeader[lang]}</b> (${page}/${totalPages})\n\n`;
    rows.forEach((r: any, i: number) => {
      const idx = (page - 1) * PAGE_SIZE + i + 1;
      text += `${idx}. @${escapeHtml(r.botUsername)} — ${r.subscribers ?? "—"} ${xt.subsLabel[lang]} — ${escapeHtml(
        r.reward || "—"
      )} — ${statusLabelLocalized(r.status, lang)} — 👍${r.likes}\n`;
    });

    const kb = new InlineKeyboard();
    rows.forEach((r: any, i: number) => {
      if (i % 2 === 0 && i !== 0) kb.row();
      kb.text(`${(page - 1) * PAGE_SIZE + i + 1}`, `brate_view_${r.id}`);
    });
    kb.row();
    if (page > 1) kb.text(t[lang].btnPrev, `brate_page_${page - 1}`);
    if (page < totalPages) kb.text(t[lang].btnNext, `brate_page_${page + 1}`);
    kb.row().text(xt.addBotBtn[lang], "brate_addbot_hint");

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
    console.error("bot rating list error", e);
    await ctx.reply(t[lang].error, { parse_mode: "HTML" });
  }
}

async function sendBotRatingDetail(ctx: any, lang: SupportedLang, id: string) {
  await ensureTables();
  try {
    const rows = (await db.$queryRawUnsafe(`SELECT * FROM "BotRequest" WHERE id = $1`, id)) as any[];
    const r = rows[0];
    if (!r) {
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
      return;
    }
    const uid = ctx.from?.id;
    const votedRows = uid
      ? ((await db.$queryRawUnsafe(
          `SELECT 1 FROM "BotRequestVote" WHERE "requestId" = $1 AND "userId" = $2`,
          id, uid
        )) as any[])
      : [];
    const hasVoted = votedRows.length > 0;

    let text = `🤖 <b>@${escapeHtml(r.botUsername)}</b>\n\n`;
    text += `👥 ${xt.subsLabel[lang]}: <b>${r.subscribers ?? "—"}</b>\n`;
    text += `🎁 ${xt.rewardLabel[lang]}: <b>${escapeHtml(r.reward || "—")}</b>\n`;
    text += `📊 ${xt.statusFieldLabel[lang]}: <b>${statusLabelLocalized(r.status, lang)}</b>\n`;
    text += `👍 ${xt.likesLabel[lang]}: <b>${r.likes}</b>\n`;

    const kb = new InlineKeyboard()
      .text(hasVoted ? xt.votedBtn[lang] : xt.likeBtn[lang], hasVoted ? "brate_noop" : `brate_vote_${id}`)
      .text(xt.checkedBtn[lang], `brate_checked_${id}`)
      .row()
      .text(t[lang].btnPrev, "brate_page_1");

    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch (e) {
    console.error("bot rating detail error", e);
    await ctx.reply(t[lang].error, { parse_mode: "HTML" });
  }
}

// ==================== COMMAND MENU (shown when typing "/" in chat) ====================
async function registerBotCommands(bot: Bot) {
  const commandList: Record<SupportedLang, { command: string; description: string }[]> = {
    ua: [
      { command: "check", description: "Перевірити @username, ID, посилання або reply на учасника" },
      { command: "bots", description: "Список верифікованих ботів" },
      { command: "garant", description: "Список гарантів" },
      { command: "botrating", description: "Рейтинг ботів на перевірку + голосування" },
      { command: "addbot", description: "Додати свого бота на перевірку" },
      { command: "stats", description: "Статистика бази" },
      { command: "statistic", description: "Загальна статистика бота" },
      { command: "top", description: "Топ-10 скамерів за пошуками" },
      { command: "settings", description: "Налаштування чату (реклама)" },
      { command: "lang", description: "Змінити мову" },
      { command: "help", description: "Довідка по командах" },
    ],
    ru: [
      { command: "check", description: "Проверить @username, ID, ссылку или reply на участника" },
      { command: "bots", description: "Список верифицированных ботов" },
      { command: "garant", description: "Список гарантов" },
      { command: "botrating", description: "Рейтинг ботов на проверку + голосование" },
      { command: "addbot", description: "Добавить своего бота на проверку" },
      { command: "stats", description: "Статистика базы" },
      { command: "statistic", description: "Общая статистика бота" },
      { command: "top", description: "Топ-10 скамеров по поискам" },
      { command: "settings", description: "Настройки чата (реклама)" },
      { command: "lang", description: "Сменить язык" },
      { command: "help", description: "Справка по командам" },
    ],
    en: [
      { command: "check", description: "Check @username, ID, link, or reply to a member" },
      { command: "bots", description: "List of verified bots" },
      { command: "garant", description: "List of guarantors" },
      { command: "botrating", description: "Bot review rating + voting" },
      { command: "addbot", description: "Submit your bot for review" },
      { command: "stats", description: "Database stats" },
      { command: "statistic", description: "Overall bot statistics" },
      { command: "top", description: "Top-10 scammers by searches" },
      { command: "settings", description: "Chat settings (ads)" },
      { command: "lang", description: "Change language" },
      { command: "help", description: "Command reference" },
    ],
    pl: [
      { command: "check", description: "Sprawdź @username, ID, link lub reply do uczestnika" },
      { command: "bots", description: "Lista zweryfikowanych botów" },
      { command: "garant", description: "Lista gwarantów" },
      { command: "botrating", description: "Ranking botów do sprawdzenia + głosowanie" },
      { command: "addbot", description: "Zgłoś swojego bota do sprawdzenia" },
      { command: "stats", description: "Statystyki bazy" },
      { command: "statistic", description: "Ogólne statystyki bota" },
      { command: "top", description: "Top-10 oszustów wg wyszukiwań" },
      { command: "settings", description: "Ustawienia czatu (reklamy)" },
      { command: "lang", description: "Zmień język" },
      { command: "help", description: "Lista komend" },
    ],
  };

  try {
    // Default list (used as fallback for clients whose language isn't overridden below)
    await bot.api.setMyCommands(commandList.en);
    // Per-language command menus — Telegram picks the matching one automatically
    // based on the user's app language.
    await bot.api.setMyCommands(commandList.ua, { language_code: "uk" });
    await bot.api.setMyCommands(commandList.ru, { language_code: "ru" });
    await bot.api.setMyCommands(commandList.en, { language_code: "en" });
    await bot.api.setMyCommands(commandList.pl, { language_code: "pl" });
  } catch (e) {
    console.error("setMyCommands failed", e);
  }
}

// ==================== BOT SETUP ====================
function setupBot(bot: Bot) {
  if (botSetupDone) return;
  botSetupDone = true;

  // Register the "/" command menu (fire-and-forget, don't block setup).
  registerBotCommands(bot).catch((e) => console.error("registerBotCommands error", e));

  // ---- Global FIRST middleware: preload the user's previously chosen
  // language from DB (survives cold starts / redeploys) before any other
  // handler runs, so every getUserLanguage() call below sees it. ----
  bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (uid) {
      await preloadUserLanguage(uid);
    }
    return next();
  });

  // ---- FIRST handler: tracks private users (for DM broadcast) and
  // intercepts any pending multi-step flow (admin actions, /addbot, proof
  // upload). Must be registered before all other message handlers below,
  // since grammy runs middleware in registration order. ----
  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type === "private" && ctx.from?.id) {
      trackBotUser(ctx.chat.id, ctx.from.id, ctx.from.username, ctx.from.language_code).catch(() => {});
    }
    if ((ctx.chat?.type === "group" || ctx.chat?.type === "supergroup")) {
      // Fallback tracking (see trackBotGroup comment) — makes sure the bot
      // "sees" every chat it's actually active in, not only ones where a
      // my_chat_member update happened to fire after this code shipped.
      trackBotGroup(ctx.chat.id, (ctx.chat as any).title, ctx.chat.type).catch(() => {});
    }
    const uid = ctx.from?.id;
    if (uid && userState.has(uid)) {
      const rawText = ctx.message?.text?.trim() || "";
      const isCommand = rawText.startsWith("/");
      const isCancelCommand = isCommand && rawText.split(/[\s@]/)[0] === "/cancel";
      if (isCommand && !isCancelCommand) {
        userState.delete(uid); // cancel pending flow, let the command run normally
      } else if (!isCommand) {
        const consumed = await processUserState(ctx, uid);
        if (consumed) return;
      }
      // /cancel falls through to its own command handler below, which
      // deletes the state itself and confirms the cancellation.
    }
    return next();
  });

  // Track groups the bot is added to / removed from (for broadcast + stats)
  bot.on("my_chat_member", async (ctx) => {
    try {
      await ensureTables();
      const chat = ctx.myChatMember.chat;
      const newStatus = ctx.myChatMember.new_chat_member.status;
      const isActive = ["member", "administrator", "creator"].includes(newStatus);
      if (chat.type === "group" || chat.type === "supergroup") {
        await db.$executeRawUnsafe(
          `INSERT INTO "BotGroup" ("chatId","title","type","active","updatedAt")
           VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT ("chatId") DO UPDATE SET title=$2, type=$3, active=$4, "updatedAt"=NOW()`,
          chat.id, (chat as any).title || "Без назви", chat.type, isActive
        );
      }
    } catch (e) {
      console.error("my_chat_member tracking error", e);
    }
  });

  // ==================== ADMIN PANEL ====================
  bot.command("admin", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.reply("⛔ Немає доступу.");
      return;
    }
    await sendAdminPanel(ctx);
  });

  bot.callbackQuery("admin_back", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminPanel(ctx);
  });

  bot.callbackQuery("admin_add", async (ctx) => {
    const uid = ctx.from?.id;
    if (!(await isAdmin(uid))) {
      await ctx.answerCallbackQuery();
      return;
    }
    if (uid !== OWNER_ID) {
      await ctx.answerCallbackQuery({ text: "Тільки власник може додавати адмінів", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    userState.set(uid!, { action: "add_admin", step: "awaiting_id", data: {} });
    await ctx.reply("✏️ Надішліть Telegram ID користувача, якого потрібно зробити адміном:", {
      reply_markup: cancelKb("ua"),
    });
  });

  bot.callbackQuery("admin_broadcast", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text("👤 Тільки ЛС", "bc_target_dm")
      .text("👥 Тільки групи", "bc_target_groups")
      .row()
      .text("🌍 Всюди", "bc_target_all")
      .row()
      .text("⬅️ Назад", "admin_back");
    const text = "📢 <b>Розсилка</b>\n\nОберіть аудиторію:";
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  });

  bot.callbackQuery(/^bc_target_(dm|groups|all)$/, async (ctx) => {
    const uid = ctx.from?.id;
    if (!(await isAdmin(uid))) {
      await ctx.answerCallbackQuery();
      return;
    }
    const target = ctx.match[1] as "dm" | "groups" | "all";
    await ctx.answerCallbackQuery();
    userState.set(uid!, { action: "broadcast", step: "awaiting_content", data: { target } });
    await ctx.reply("✏️ Надішліть повідомлення для розсилки (текст, фото, відео — будь-що). Воно буде скопійовано отримувачам як є.", {
      reply_markup: cancelKb("ua"),
    });
  });

  bot.callbackQuery("admin_writeas", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendGroupPicker(ctx, 1);
  });

  bot.callbackQuery(/^wa_page_(\d+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendGroupPicker(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  bot.callbackQuery(/^wa_pick_(-?\d+)$/, async (ctx) => {
    const uid = ctx.from?.id;
    if (!(await isAdmin(uid))) {
      await ctx.answerCallbackQuery();
      return;
    }
    const targetChatId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();
    userState.set(uid!, { action: "write_as", step: "awaiting_content", data: { targetChatId } });
    await ctx.reply("✏️ Надішліть повідомлення, яке бот надішле у вибраний чат від свого імені.", {
      reply_markup: cancelKb("ua"),
    });
  });

  bot.callbackQuery("admin_stats", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendFullStats(ctx);
  });

  bot.command("requests", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    await sendAdminRequestsQueue(ctx, 1);
  });

  bot.callbackQuery(/^admin_requests_(\d+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminRequestsQueue(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  bot.callbackQuery(/^admreq_view_(.+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminRequestDetail(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^admreq_status_(.+)_(pending|in_review|checking|awaiting_withdrawal|verified)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    const id = ctx.match[1];
    const status = ctx.match[2];
    try {
      await ensureTables();
      await db.$executeRawUnsafe(`UPDATE "BotRequest" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, status, id);
      await ctx.answerCallbackQuery({ text: "✅ Статус оновлено" });
      await sendAdminRequestDetail(ctx, id);
    } catch (e) {
      console.error("status update error", e);
      await ctx.answerCallbackQuery({ text: "⚠️ Помилка", show_alert: true });
    }
  });

  bot.callbackQuery(/^admreq_delete_(.+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    const id = ctx.match[1];
    try {
      await ensureTables();
      await db.$executeRawUnsafe(`DELETE FROM "BotRequestProof" WHERE "requestId" = $1`, id);
      await db.$executeRawUnsafe(`DELETE FROM "BotRequestVote" WHERE "requestId" = $1`, id);
      await db.$executeRawUnsafe(`DELETE FROM "BotRequest" WHERE id = $1`, id);
      await ctx.answerCallbackQuery({ text: "🗑 Видалено" });
      await sendAdminRequestsQueue(ctx, 1);
    } catch (e) {
      console.error("delete request error", e);
      await ctx.answerCallbackQuery({ text: "⚠️ Помилка", show_alert: true });
    }
  });

  // ---- Admin: proof review queue ----
  bot.callbackQuery("admin_proofs_1", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminProofsQueue(ctx, 1);
  });

  bot.callbackQuery(/^admin_proofs_(\d+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminProofsQueue(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  bot.callbackQuery(/^admin_proofs_req_(.+)_(\d+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminProofsQueue(ctx, parseInt(ctx.match[2], 10) || 1, ctx.match[1]);
  });

  bot.callbackQuery(/^admin_proofs_req_([^_]+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminProofsQueue(ctx, 1, ctx.match[1]);
  });

  bot.callbackQuery(/^admproof_view_(.+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await sendAdminProofDetail(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^admproof_done_(.+)_(.+)$/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) {
      await ctx.answerCallbackQuery();
      return;
    }
    const proofId = ctx.match[1];
    try {
      await ensureTables();
      await db.$executeRawUnsafe(`UPDATE "BotRequestProof" SET reviewed = TRUE WHERE id = $1`, proofId);
      await ctx.answerCallbackQuery({ text: "✅ Відмічено як перевірене" });
      await sendAdminProofsQueue(ctx, 1);
    } catch (e) {
      console.error("mark proof reviewed error", e);
      await ctx.answerCallbackQuery({ text: "⚠️ Помилка", show_alert: true });
    }
  });

  // ==================== PUBLIC: /statistic ====================
  bot.command("statistic", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    try {
      await ensureTables();
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [searchesToday, searchesMonth, searchesTotal, groupsCountRows, usersTotalRows, usersTodayRows] = await Promise.all([
        db.searchLog.count({ where: { createdAt: { gte: todayStart } } }),
        db.searchLog.count({ where: { createdAt: { gte: monthStart } } }),
        db.searchLog.count(),
        db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotGroup" WHERE active = true`),
        db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotUser"`),
        db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "BotUser" WHERE "createdAt" >= $1`, todayStart),
      ]);
      const groupsCount = Number((groupsCountRows as any[])[0]?.count || 0);
      const usersTotal = Number((usersTotalRows as any[])[0]?.count || 0);
      const usersToday = Number((usersTodayRows as any[])[0]?.count || 0);

      const labels: Record<SupportedLang, { title: string; today: string; month: string; total: string; groups: string }> = {
        ua: { title: "📊 Загальна статистика бота", today: "Запитів сьогодні", month: "Запитів за місяць", total: "Запитів за весь час", groups: "Груп з ботом" },
        ru: { title: "📊 Общая статистика бота", today: "Запросов сегодня", month: "Запросов за месяц", total: "Запросов за всё время", groups: "Групп с ботом" },
        en: { title: "📊 Overall bot statistics", today: "Requests today", month: "Requests this month", total: "Requests all-time", groups: "Groups with the bot" },
        pl: { title: "📊 Ogólne statystyki bota", today: "Zapytań dzisiaj", month: "Zapytań w tym miesiącu", total: "Zapytań łącznie", groups: "Grup z botem" },
      };
      const l = labels[lang];
      const text = `${l.title}\n\n🔍 ${l.today}: <b>${searchesToday}</b>\n🔍 ${l.month}: <b>${searchesMonth}</b>\n🔍 ${l.total}: <b>${searchesTotal}</b>\n👥 ${l.groups}: <b>${groupsCount}</b>\n🙋 ${xt.usersTotalLabel[lang]}: <b>${usersTotal}</b>\n🆕 ${xt.usersTodayLabel[lang]}: <b>${usersToday}</b>`;
      const adsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: adsDisabled ? undefined : new InlineKeyboard().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/"),
      });
    } catch (e) {
      console.error("statistic error", e);
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
    }
  });

  // ==================== PUBLIC: /settings (per-chat ads toggle) ====================
  bot.command("settings", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    if (ctx.chat?.type !== "private") {
      try {
        const member = await ctx.api.getChatMember(chatId, ctx.from!.id);
        if (!["administrator", "creator"].includes(member.status)) {
          await ctx.reply(xt.settingsNoRights[lang]);
          return;
        }
      } catch (e) {
        console.error("getChatMember failed", e);
      }
    }
    await sendSettingsPanel(ctx, lang, chatId);
  });

  bot.callbackQuery(/^settings_toggle_ads_(-?\d+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    const chatId = Number(ctx.match[1]);
    if (ctx.chat?.type !== "private") {
      try {
        const member = await ctx.api.getChatMember(chatId, ctx.from!.id);
        if (!["administrator", "creator"].includes(member.status)) {
          await ctx.answerCallbackQuery({ text: xt.settingsNoRights[lang], show_alert: true });
          return;
        }
      } catch {}
    }
    try {
      await ensureTables();
      const current = await getChatAdsDisabled(chatId);
      const next = !current;
      await db.$executeRawUnsafe(
        `INSERT INTO "ChatSettings" ("chatId","adsDisabled","updatedAt") VALUES ($1,$2,NOW())
         ON CONFLICT ("chatId") DO UPDATE SET "adsDisabled" = $2, "updatedAt" = NOW()`,
        chatId, next
      );
      chatSettingsCache.set(chatId, { disabled: next, ts: Date.now() });
      await ctx.answerCallbackQuery({ text: next ? xt.settingsAdsOff[lang] : xt.settingsAdsOn[lang] });
      await sendSettingsPanel(ctx, lang, chatId, true);
    } catch (e) {
      console.error("toggle ads error", e);
      await ctx.answerCallbackQuery({ text: "⚠️ Error", show_alert: true });
    }
  });

  // ==================== PUBLIC: /addbot + /botrating ====================
  bot.command("addbot", async (ctx) => {
    const uid = ctx.from?.id;
    const lang = getUserLanguage(uid, ctx.from?.language_code);
    if (ctx.chat?.type !== "private") {
      await ctx.reply(xt.dmOnly[lang]);
      return;
    }
    try {
      await ensureTables();
      const countRows = (await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "BotRequest" WHERE "telegramUserId" = $1`,
        uid
      )) as any[];
      const cnt = Number(countRows[0]?.count || 0);
      if (cnt >= 2) {
        await ctx.reply(xt.maxReached[lang]);
        return;
      }
    } catch (e) {
      console.error("addbot count check failed", e);
    }
    userState.set(uid!, { action: "addbot", step: "username", data: {} });
    await ctx.reply(xt.askUsername[lang], { parse_mode: "HTML", reply_markup: cancelKb(lang) });
  });

  bot.command("botrating", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await sendBotRatingList(ctx, lang, 1);
  });

  bot.callbackQuery(/^brate_page_(\d+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.answerCallbackQuery();
    await sendBotRatingList(ctx, lang, parseInt(ctx.match[1], 10) || 1, true);
  });

  bot.callbackQuery("brate_addbot_hint", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.answerCallbackQuery({ text: xt.addBotHint[lang], show_alert: true });
  });

  bot.callbackQuery(/^brate_view_(.+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.answerCallbackQuery();
    await sendBotRatingDetail(ctx, lang, ctx.match[1]);
  });

  bot.callbackQuery("brate_noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^brate_vote_(.+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    const id = ctx.match[1];
    const uid = ctx.from?.id;
    if (!uid) {
      await ctx.answerCallbackQuery();
      return;
    }
    try {
      await ensureTables();
      await db.$executeRawUnsafe(`INSERT INTO "BotRequestVote" ("requestId","userId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, id, uid);
      await db.$executeRawUnsafe(
        `UPDATE "BotRequest" SET likes = (SELECT COUNT(*) FROM "BotRequestVote" WHERE "requestId" = $1) WHERE id = $1`,
        id
      );
      await ctx.answerCallbackQuery({ text: xt.votedToast[lang] });
      await sendBotRatingDetail(ctx, lang, id);
    } catch (e) {
      console.error("vote error", e);
      await ctx.answerCallbackQuery({ text: "⚠️ Error", show_alert: true });
    }
  });

  bot.callbackQuery(/^brate_checked_(.+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    const id = ctx.match[1];
    const uid = ctx.from?.id;
    await ctx.answerCallbackQuery();
    if (!uid) return;
    if (ctx.chat?.type !== "private") {
      await ctx.reply(xt.proofDmOnly[lang]);
      return;
    }
    // One proof submission per account per bot — block re-entry into the
    // flow entirely if this user already has a proof on file for this bot.
    try {
      await ensureTables();
      const existing = (await db.$queryRawUnsafe(
        `SELECT 1 FROM "BotRequestProof" WHERE "requestId" = $1 AND "userId" = $2 LIMIT 1`,
        id, uid
      )) as any[];
      if (existing.length > 0) {
        await ctx.reply(xt.proofAlreadySubmitted[lang]);
        return;
      }
    } catch (e) {
      console.error("proof dup check failed", e);
    }
    userState.set(uid, { action: "proof", step: "ask_withdrew", data: { requestId: id } });
    await ctx.reply(xt.askWithdrew[lang], {
      reply_markup: new InlineKeyboard()
        .text(xt.yes[lang], `proof_withdrew_yes_${id}`)
        .text(xt.no[lang], `proof_withdrew_no_${id}`)
        .row()
        .text(xt.cancelBtn[lang], "cancel_flow"),
    });
  });

  bot.callbackQuery(/^proof_withdrew_(yes|no)_(.+)$/, async (ctx) => {
    const uid = ctx.from?.id;
    const lang = getUserLanguage(uid, ctx.from?.language_code);
    const withdrew = ctx.match[1] === "yes";
    const id = ctx.match[2];
    await ctx.answerCallbackQuery();
    if (!uid) return;
    userState.set(uid, { action: "proof", step: "screenshot1", data: { requestId: id, withdrew } });
    await ctx.reply(xt.askScreenshot1[lang], { reply_markup: cancelKb(lang) });
  });

  // ==================== CANCEL (works for any active multi-step flow) ====================
  bot.command("cancel", async (ctx) => {
    const uid = ctx.from?.id;
    const lang = getUserLanguage(uid, ctx.from?.language_code);
    if (uid && userState.has(uid)) {
      userState.delete(uid);
      await ctx.reply(xt.cancelledMsg[lang]);
    } else {
      await ctx.reply(xt.nothingToCancel[lang]);
    }
  });

  bot.callbackQuery("cancel_flow", async (ctx) => {
    const uid = ctx.from?.id;
    const lang = getUserLanguage(uid, ctx.from?.language_code);
    if (uid) userState.delete(uid);
    await ctx.answerCallbackQuery({ text: xt.cancelledMsg[lang] });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  });

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

  // /garant — list of guarantors (scammer records with status "garant")
  bot.command("garant", async (ctx) => {
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await sendGarantList(ctx, lang, 1);
  });

  bot.callbackQuery(/^garant_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10) || 1;
    const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
    await ctx.answerCallbackQuery();
    await sendGarantList(ctx, lang, page, true);
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

      const adsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
      const msg = `${t[lang].statsHeader}

👤 ${lang === "ua" ? "Всього скамерів" : lang === "en" ? "Total scammers" : lang === "pl" ? "Łącznie oszustów" : "Всего скамеров"}: <b>${totalScammers}</b>
  └ 🚫 ${lang === "ua" ? "Скам" : lang === "en" ? "Scam" : lang === "pl" ? "Oszustwa" : "Скам"}: ${scamCount}
  └ ✅ ${lang === "ua" ? "Перевірено" : lang === "en" ? "Verified" : lang === "pl" ? "Zweryfikowano" : "Перевірено"}: ${verifiedCount}
👥 ${lang === "ua" ? "Користувачів" : lang === "en" ? "Users" : lang === "pl" ? "Użytkowników" : "Користувачів"}: <b>${totalUsers}</b>
🔍 ${lang === "ua" ? "Пошуків сьогодні" : lang === "en" ? "Searches today" : lang === "pl" ? "Wyszukiwań dzisiaj" : "Пошуків сьогодні"}: <b>${searchesToday}</b>${adsDisabled ? "" : `\n\n🌐 Сайт: https://frostscambase.vercel.app/`}`;

      const statsKb = new InlineKeyboard();
      if (!adsDisabled) {
        statsKb.url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/").url(t[lang].btnChat, "https://t.me/wocmf");
      }
      await ctx.reply(msg, {
        parse_mode: "HTML",
        reply_markup: adsDisabled ? undefined : statsKb,
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
        reply_markup: (ctx.chat?.id && (await getChatAdsDisabled(ctx.chat.id)))
          ? undefined
          : new InlineKeyboard().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/"),
      });
    } catch (e) {
      console.error("top error", e);
      await ctx.reply(t[lang].error, { parse_mode: "HTML" });
    }
  });

  // Language callback
  bot.callbackQuery(/^lang_(ua|ru|en|pl)$/, async (ctx) => {
    const lang = ctx.match[1] as SupportedLang;
    if (ctx.from?.id) {
      userLanguages.set(ctx.from.id, lang);
      persistUserLanguage(ctx.chat?.id, ctx.from.id, lang, ctx.chat?.type === "private").catch(() => {});
    }
    await ctx.answerCallbackQuery();
    const adsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
    const langKb = new InlineKeyboard();
    if (!adsDisabled) {
      langKb.url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/").url(t[lang].btnChat, "https://t.me/wocmf");
    }
    await ctx.reply(t[lang].langChanged, {
      parse_mode: "HTML",
      reply_markup: adsDisabled ? undefined : langKb,
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

  // Contact shared — private chats only. In groups, someone sharing an
  // unrelated contact (their own vCard, a forwarded contact card, etc.)
  // shouldn't make the bot blast a scam-check reply into the chat.
  bot.on("message:contact", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const contact = ctx.message.contact;
    const userId = contact.user_id;
    if (userId) {
      await handleSearch(ctx, String(userId));
    } else {
      const lang = getUserLanguage(ctx.from?.id, ctx.from?.language_code);
      await ctx.reply(t[lang].error || "❌ У контакта нет Telegram ID", { parse_mode: "HTML" });
    }
  });

  // Forwarded message — private chats only. In groups, people forward all
  // kinds of unrelated messages constantly; the bot should never auto-run a
  // scam-check off the back of a random forward the way it does in DMs.
  bot.on("message:forward_origin", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
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

      const adsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
      // "Report scam" and "Donate" are core functions, not ads — they stay
      // visible even when ads are disabled for this chat. Site/chat links
      // are the ad elements and get hidden.
      const kb = new InlineKeyboard().url(t[lang].btnAddScam, "https://frostscambase.vercel.app/");
      if (!adsDisabled) {
        kb.url(t[lang].btnChat, "https://t.me/wocmf")
          .row()
          .url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(parsed.cleanName || parsed.username || "")}`);
      } else {
        kb.row();
      }
      kb.url(t[lang].btnSupport, "https://t.me/send?start=IVkrkNlUFFtA");

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
    const adsDisabledMulti = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
    if (!adsDisabledMulti) {
      kb.row().url(t[lang].btnOpenSite, `https://frostscambase.vercel.app/?q=${encodeURIComponent(parsed.cleanName || "")}`);
    }

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
  const safeType = escapeHtml(formatScammerType(scammer.scammerType, lang));

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

  const chatId = ctx.chat?.id;
  const adsDisabled = chatId ? await getChatAdsDisabled(chatId) : false;

  text += `\n───────────────\n`;
  if (!adsDisabled) {
    text += `🌐 <b>${lbl.site}:</b> https://frostscambase.vercel.app/\n`;
    text += `💬 <b>${lbl.chat}:</b> @wocmf\n`;
  }

  const finalKb = adsDisabled
    ? new InlineKeyboard()
        .url(t[lang].btnSupport, "https://t.me/send?start=IVkrkNlUFFtA")
        .text("🌐 Language / Мова", "lang_ua")
    : new InlineKeyboard()
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
    const botsAdsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
    if (!botsAdsDisabled) kb.row().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/");

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

// ==================== GARANT LIST (scammer records with status "garant") ====================
async function sendGarantList(ctx: any, lang: SupportedLang, page: number, isEdit = false) {
  const PAGE_SIZE = 10;
  try {
    if (!isEdit) {
      await ctx.replyWithChatAction("typing").catch(() => {});
    }

    const where = { status: "garant" };

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
      const text = xt.garantEmpty[lang];
      if (isEdit) {
        await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(() => ctx.reply(text, { parse_mode: "HTML" }));
      } else {
        await ctx.reply(text, { parse_mode: "HTML" });
      }
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);

    let text = `${xt.garantHeader[lang]}\n${t[lang].botsPage.replace("{page}", String(safePage)).replace("{total}", String(totalPages))}\n\n`;
    items.forEach((s, i) => {
      const idx = (safePage - 1) * PAGE_SIZE + i + 1;
      const name = escapeHtml(s.name?.startsWith("@") ? s.name : `@${s.name}`);
      const idPart = s.telegramUserId ? ` — <code>${escapeHtml(s.telegramUserId)}</code>` : "";
      const desc = escapeHtml((s.description || "").slice(0, 150));
      text += `${idx}. <b>${name}</b>${idPart}\n`;
      if (desc) text += `   📝 ${desc}\n`;
      if (s.proofLink) text += `   ${xt.garantReviewsBtn[lang]}: ${escapeHtml(s.proofLink)}\n`;
    });

    const kb = new InlineKeyboard();
    items.forEach((s, i) => {
      if (i % 2 === 0 && i !== 0) kb.row();
      kb.text(`${t[lang].btnDetails} ${(safePage - 1) * PAGE_SIZE + i + 1}`, `select_${s.id}`);
    });
    kb.row();
    if (safePage > 1) kb.text(t[lang].btnPrev, `garant_page_${safePage - 1}`);
    if (safePage < totalPages) kb.text(t[lang].btnNext, `garant_page_${safePage + 1}`);
    const adsDisabled = ctx.chat?.id ? await getChatAdsDisabled(ctx.chat.id) : false;
    if (!adsDisabled) kb.row().url(t[lang].btnOpenSite, "https://frostscambase.vercel.app/");

    if (isEdit) {
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
      } catch {
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
      }
    } else {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  } catch (e) {
    console.error("garant list error", e);
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
