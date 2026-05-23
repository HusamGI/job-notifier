import puppeteer, { type Browser } from "puppeteer-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { Job } from "./companies";

const SESSION_DIR = "./data/linkedin-session";
const SESSION_FILE = `${SESSION_DIR}/cookies.json`;
const LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/";
const SEARCH_QUERY = "Recommended jobs for me in the past 24 hours";

const BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findBrowser(): string {
  for (const p of BROWSER_PATHS) {
    if (existsSync(p)) {
      console.log(`  🌐 Found browser: ${p}`);
      return p;
    }
  }
  throw new Error("Could not find Chrome or Edge. Please install Google Chrome.");
}

function loadCookies(): object[] {
  try { return JSON.parse(readFileSync(SESSION_FILE, "utf-8")); }
  catch { return []; }
}

function saveCookies(cookies: object[]): void {
  writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2), "utf-8");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchLinkedInJobs(): Promise<Job[]> {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });

  const executablePath = findBrowser();
  const isFirstRun = !existsSync(SESSION_FILE);

  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
    defaultViewport: null,
    timeout: 30000,
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const jobs: Job[] = [];

  try {
    // ── Login flow (first run only) ──────────────────────────────────────────
    if (isFirstRun) {
      console.log("\n🔐 FIRST RUN: LinkedIn Login Required");
      console.log("────────────────────────────────────────");
      console.log("A browser window has opened.");
      console.log("1. Log in to your LinkedIn account");
      console.log("2. Wait until you see your feed");
      console.log("3. Come back here and press ENTER\n");

      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => resolve());
        console.log("Press ENTER after you have logged in to LinkedIn...");
      });

      saveCookies(await page.cookies());
      console.log("✅ Session saved! Future runs will be fully automatic.\n");
    } else {
      await page.setCookie(...(loadCookies() as any[]));
    }

    // ── Navigate to Jobs page ────────────────────────────────────────────────
    await page.goto(LINKEDIN_JOBS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (page.url().includes("/login") || page.url().includes("/checkpoint")) {
      writeFileSync(SESSION_FILE, "[]", "utf-8");
      throw new Error("SESSION_EXPIRED: Restart the app to log in again.");
    }

    // ── Find the search box and type the query ───────────────────────────────
    console.log("  🔍 Searching for recommended jobs...");

    // Wait for the jobs search input to appear
    const searchSelector =
      'input[componentkey*="jobSearchBox"],' +
      'input[placeholder*="Describe the job you want"]';

    await page.waitForSelector(searchSelector, { timeout: 15000 });

    // Clear existing text and type the query
    await page.click(searchSelector);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await sleep(300);
    await page.type(searchSelector, SEARCH_QUERY, { delay: 40 });
    await sleep(500);
    await page.keyboard.press("Enter");

    // ── Wait for search results to load ─────────────────────────────────────
    console.log("  ⏳ Waiting for results...");

    // Wait for the main results container
    await page.waitForSelector(
      '[componentkey="SearchResultsMainContent"]',
      { timeout: 20000 }
    ).catch(() => {
      console.log("  ⚠️  Could not find results list container — will try extracting anyway");
    });

    // Wait for at least one job card to appear (cards use componentkey="job-card-component-ref-*")
    await page.waitForSelector(
      '[componentkey^="job-card-component-ref-"]',
      { timeout: 15000 }
    ).catch(() => {
      console.log("  ⚠️  Job cards not found in results");
    });

    await sleep(3000); // let lazy-loaded content settle

    // ── Diagnostics: count how many card elements Puppeteer can see ───────────
    const cardCount = await page.$$eval(
      '[componentkey^="job-card-component-ref-"]',
      (els) => els.length
    ).catch(() => 0);
    console.log(`  🔎 Found ${cardCount} raw card elements in DOM`);

    if (cardCount === 0) {
      // Fallback: log a snippet of the page HTML so we can debug the selector
      const snippet = await page.evaluate(() =>
        document.querySelector('[componentkey="SearchResultsMainContent"]')?.innerHTML?.slice(0, 500) ?? "CONTAINER NOT FOUND"
      ).catch(() => "evaluate failed");
      console.log("  🔎 Container HTML snippet:", snippet);
    }

    // ── Extract job cards from the results panel ─────────────────────────────
    const extracted = await page.evaluate(() => {
      const results: Array<{ id: string; title: string; company: string }> = [];
      const seen = new Set<string>();

      const cards = document.querySelectorAll('[componentkey^="job-card-component-ref-"]');

      cards.forEach((card) => {
        const ckeyValue = card.getAttribute("componentkey") ?? "";
        const jobId = ckeyValue.replace("job-card-component-ref-", "");
        if (!jobId || seen.has(jobId)) return;
        seen.add(jobId);

        // Title: from the Dismiss button's aria-label (stable accessibility attribute)
        // e.g. aria-label="Dismiss Safety Engineer job" → "Safety Engineer"
        const dismissBtn = card.querySelector("button[aria-label^='Dismiss']");
        const ariaLabel = dismissBtn?.getAttribute("aria-label") ?? "";
        const titleFromAria = ariaLabel.replace(/^Dismiss\s+/, "").replace(/\s+job$/, "").trim();

        // Company: scan direct text nodes of <p> and <span> elements,
        // skip anything that looks like a location, date, or badge
        const allParas = Array.from(card.querySelectorAll("p, span"))
          .map((el) => {
            const text = Array.from(el.childNodes)
              .filter((n) => n.nodeType === 3)
              .map((n) => n.textContent?.trim() ?? "")
              .join("")
              .trim();
            return text;
          })
          .filter((t) => t.length > 2);

        const skipPatterns = /posted|hour|day|ago|applicant|apply|reviewing|on-site|remote|hybrid|doha|qatar/i;
        const company = allParas.find(
          (t) => t !== titleFromAria && !skipPatterns.test(t)
        ) ?? "Unknown Company";

        if (titleFromAria) {
          results.push({ id: `linkedin-${jobId}`, title: titleFromAria, company });
        }
      });

      return results;
    });

    console.log(`  📋 Extracted ${extracted.length} job cards from page`);
    jobs.push(...extracted);

    saveCookies(await page.cookies());
  } finally {
    await browser.close();
  }

  return jobs;
}
