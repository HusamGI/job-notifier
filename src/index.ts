import { config } from "dotenv";
import { loadSeenJobs, saveSeenJobs, markAsSeen } from "./store";
import { companySources, type Job } from "./companies";
import { fetchLinkedInJobs } from "./linkedin";
import {
  sendNewJobAlert,
  sendErrorAlert,
  sendStartupMessage,
} from "./telegram";

// Load .env
const env = await import("dotenv");
env.config();

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// ── Process a batch of jobs from any source ────────────────────────────────
async function processJobs(
  jobs: Job[],
  store: ReturnType<typeof loadSeenJobs>,
): Promise<number> {
  let newCount = 0;

  for (const job of jobs) {
    if (!store.has(job.id)) {
      console.log(`  🆕 New: [${job.company}] ${job.title}`);
      try {
        await sendNewJobAlert(job.title, job.company);
        markAsSeen(store, job.id, job.title, job.company);
        newCount++;
        // Small delay between Telegram messages to avoid rate limiting
        await sleep(500);
      } catch (err: any) {
        console.error(`  ❌ Failed to send Telegram alert: ${err.message}`);
      }
    }
  }

  return newCount;
}

// ── Single check cycle ─────────────────────────────────────────────────────
async function runCheck(): Promise<void> {
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`\n[${now}] Running job check...`);

  const store = loadSeenJobs();
  let totalNew = 0;

  // ── 1. Company career pages ─────────────────────────────────────────────
  for (const source of companySources) {
    console.log(`  Checking ${source.name}...`);
    try {
      const jobs = await source.fetchJobs();
      console.log(`  Found ${jobs.length} listings`);
      const newCount = await processJobs(jobs, store);
      totalNew += newCount;
    } catch (err: any) {
      console.error(`  ❌ Error checking ${source.name}: ${err.message}`);
      try {
        await sendErrorAlert(source.name, err.message);
      } catch {
        // Don't crash if Telegram also fails
      }
    }
  }

  // ── 2. LinkedIn ─────────────────────────────────────────────────────────
  console.log(`  Checking LinkedIn...`);
  try {
    const linkedInJobs = await fetchLinkedInJobs();
    console.log(`  Found ${linkedInJobs.length} LinkedIn listings`);
    const newCount = await processJobs(linkedInJobs, store);
    totalNew += newCount;
  } catch (err: any) {
    console.error(`  ❌ Error checking LinkedIn: ${err.message}`);
    // If session expired, send a specific alert
    if (err.message.includes("SESSION_EXPIRED")) {
      try {
        await sendErrorAlert(
          "LinkedIn",
          "Session expired! Run the program manually to re-login.",
        );
      } catch {
        // ignore
      }
    }
  }

  // ── Save updated store ───────────────────────────────────────────────────
  saveSeenJobs(store);

  if (totalNew === 0) {
    console.log(`  ✅ No new jobs found.`);
  } else {
    console.log(`  ✅ Sent ${totalNew} new job alert(s) to Telegram.`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("🤖 Job Monitor starting...");
  console.log(`📡 Checking every ${INTERVAL_MS / 60000} minutes\n`);

  // Validate env vars
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.error(
      "❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env file",
    );
    console.error("   Copy .env.example to .env and fill in your credentials");
    process.exit(1);
  }

  // Send startup notification
  try {
    await sendStartupMessage();
    console.log("✅ Telegram connection verified\n");
  } catch (err: any) {
    console.error(`❌ Telegram connection failed: ${err.message}`);
    console.error(
      "   Check your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env",
    );
    process.exit(1);
  }

  // Run immediately on start, then on interval
  await runCheck();

  setInterval(async () => {
    await runCheck();
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
