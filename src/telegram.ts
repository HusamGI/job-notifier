const TELEGRAM_API = "https://api.telegram.org";

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env file"
    );
  }
  return { token, chatId };
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const { token, chatId } = getConfig();
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error: ${err}`);
  }
}

export async function sendNewJobAlert(
  title: string,
  company: string
): Promise<void> {
  const message = `🆕 <b>New Job Opening!</b>\n\n💼 <b>${title}</b>\n🏢 ${company}`;
  await sendTelegramMessage(message);
}

export async function sendSummary(count: number): Promise<void> {
  if (count === 0) return;
  const message =
    count === 1
      ? `✅ 1 new job opening was found and sent to you.`
      : `✅ ${count} new job openings were found and sent to you.`;
  // Summary is optional — individual alerts are already sent per job
  // Uncomment the line below if you want a summary message too:
  // await sendTelegramMessage(message);
}

export async function sendErrorAlert(source: string, error: string): Promise<void> {
  const message = `⚠️ <b>Job Monitor Error</b>\n\nSource: ${source}\nError: ${error}`;
  await sendTelegramMessage(message);
}

export async function sendStartupMessage(): Promise<void> {
  const message = `🤖 <b>Job Monitor Started</b>\n\nChecking for new jobs every 10 minutes.\nSources:\n• LinkedIn (Recommended Jobs)\n• Malomatia`;
  await sendTelegramMessage(message);
}
