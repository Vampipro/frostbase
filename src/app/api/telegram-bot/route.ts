import { Bot, webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
// Імпортуй свою базу даних (наприклад, з Neon DB / Prisma / Drizzle)
// import { db } from "@/lib/db"; 

// 1. Ініціалізація бота
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

// 2. Обробка команди /start
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привіт! Надішли мені **Telegram ID** або **юзернейм**, щоб перевірити його в базі."
  );
});

// 3. Обробка текстових повідомлень (пошук)
bot.on("message:text", async (ctx) => {
  const query = ctx.message.text.trim();

  await ctx.reply(`Шукаю інформацію по: ${query}...`);

  try {
    // 💡 ТУТ ТВІЙ ПОШУК У БАЗІ NEON:
    // Наприклад:
    // const result = await db.scammer.findFirst({ where: { tgId: query } });

    // Тимчасова імітація знаходження:
    const found = false; // заміни на реальну перевірку

    if (found) {
      await ctx.reply(`⚠️ **УВАГА! Знайдено в базі!**\n\nДеталі про скамера...`);
    } else {
      await ctx.reply(`✅ Запиту "${query}" у базі не знайдено.`);
    }
  } catch (error) {
    console.error("Bot error:", error);
    await ctx.reply("Сталася помилка під час пошуку в базі.");
  }
});

// 4. Експорт Webhook-хендлера для Next.js & Vercel
const handleWebhook = webhookCallback(bot, "std/http");

export async function POST(req: NextRequest) {
  try {
    return await handleWebhook(req);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
