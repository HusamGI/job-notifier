import { existsSync, readFileSync, writeFileSync } from "fs";

const STORE_PATH = "./data/seen-jobs.json";

export interface SeenJob {
  id: string;
  title: string;
  company: string;
  seenAt: string;
}

export function loadSeenJobs(): Map<string, SeenJob> {
  if (!existsSync(STORE_PATH)) {
    return new Map();
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const arr: SeenJob[] = JSON.parse(raw);
    return new Map(arr.map((j) => [j.id, j]));
  } catch {
    return new Map();
  }
}

export function saveSeenJobs(jobs: Map<string, SeenJob>): void {
  const arr = Array.from(jobs.values());
  writeFileSync(STORE_PATH, JSON.stringify(arr, null, 2), "utf-8");
}

export function markAsSeen(
  store: Map<string, SeenJob>,
  id: string,
  title: string,
  company: string
): void {
  store.set(id, { id, title, company, seenAt: new Date().toISOString() });
}
