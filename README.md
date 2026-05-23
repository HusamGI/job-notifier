# Job Monitor 🤖

Automatically checks for new job openings every 10 minutes and sends alerts to your Telegram.

**Sources monitored:**
- LinkedIn Recommended Jobs (your personalized feed)
- Malomatia careers page

---

## 1. Prerequisites

- [Bun](https://bun.sh) installed on your PC
- A Telegram account

---

## 2. Telegram Bot Setup

You need to create a Telegram bot and get two things: a **Bot Token** and your **Chat ID**.

### Step 1 — Create a bot

1. Open Telegram and search for **@BotFather**
2. Start a chat with it and send: `/newbot`
3. Follow the prompts:
   - Enter a **name** for your bot (e.g. `My Job Monitor`)
   - Enter a **username** for it — must end in `bot` (e.g. `myjobmonitor_bot`)
4. BotFather will reply with your **Bot Token** — it looks like:
   ```
   7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Copy this and keep it safe.

### Step 2 — Get your Chat ID

1. Search for your new bot in Telegram and **start a chat** with it (send `/start` or any message)
2. Open this URL in your browser, replacing `YOUR_BOT_TOKEN` with your actual token:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. In the JSON response, look for `"chat":{"id":` — the number after it is your **Chat ID**:
   ```json
   "chat": { "id": 123456789, ... }
   ```
   Copy that number.

### Step 3 — Fill in your .env file

In the project folder, copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Then open `.env` and fill it in:
```
TELEGRAM_BOT_TOKEN=7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
```

---

## 3. Install Dependencies

```bash
cd job-monitor
bun install
bunx playwright install chromium
```

---

## 4. Run the Monitor

```bash
bun run start
```

**First run only:** A browser window will open for you to log in to LinkedIn manually. After that, your session is saved and all future runs are fully headless (no window).

---

## 5. Run in the Background (Windows Task Scheduler)

To have it start automatically and run in the background:

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name it: `Job Monitor`
4. Trigger: **When the computer starts**
5. Action: **Start a program**
   - Program: `bun`
   - Arguments: `run start`
   - Start in: `C:\path\to\job-monitor` (your actual path)
6. Finish

To run it minimized, after creating the task:
- Right-click → Properties → check **"Run whether user is logged on or not"**

---

## 6. Adding More Career Pages

Open `src/companies.ts` — there are commented-out templates at the bottom showing how to add:
- A **JSON API** source (like Malomatia)
- A **DOM scraping** source (HTML page with CSS selectors)

---

## 7. Re-logging into LinkedIn

If LinkedIn logs you out, delete the saved session and restart:
```bash
rm data/linkedin-session/state.json
bun run start
```

The browser window will appear again for manual login.
