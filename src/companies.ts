export interface Job {
  id: string;
  title: string;
  company: string;
}

export interface CompanySource {
  name: string;
  fetchJobs: () => Promise<Job[]>;
}

// ─── Malomatia ────────────────────────────────────────────────────────────────
// Uses Oracle HCM REST API — clean JSON response, no browser needed
async function fetchMalomatiaJobs(): Promise<Job[]> {
  const url =
    "https://fa-eyhb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions" +
    "?onlyData=true" +
    "&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields" +
    "&finder=findReqs;siteNumber=CX_1,facetsList=LOCATIONS%3BWORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS,limit=25,sortBy=POSTING_DATES_DESC";

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; JobMonitor/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  // Response shape: data.items[0].requisitionList[]
  const items = data?.items?.[0]?.requisitionList;
  if (!Array.isArray(items)) {
    throw new Error("Unexpected API response shape from Malomatia");
  }

  return items.map((item: any) => ({
    id: `malomatia-${item.Id ?? item.requisitionId ?? item.Title}`,
    title: item.Title,
    company: "Malomatia",
  }));
}

// ─── QatarEnergy ──────────────────────────────────────────────────────────────
async function fetchQatarEnergyJobs(): Promise<Job[]> {
  const url =
    "https://careerportal.qatarenergy.qa/api/jobs?page=1&sortBy=relevance&descending=false&internal=false&deviceId=undefined&domain=qatarenergy.jibeapply.com";

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; JobMonitor/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error("Unexpected API response shape from QatarEnergy");
  }

  return jobs.map((item: any) => ({
    id: `qatarenergy-${item.data?.id ?? item.data?.title}`,
    title: item.data?.title ?? "Unknown Title",
    company: "QatarEnergy",
  }));
}

// ─── Registry of all company sources ─────────────────────────────────────────
// To add a new company, just add another entry here following the same pattern.
export const companySources: CompanySource[] = [
  {
    name: "Malomatia",
    fetchJobs: fetchMalomatiaJobs,
  },
  {
    name: "QatarEnergy",
    fetchJobs: fetchQatarEnergyJobs,
  },

  // ── Template for a future DOM-based scraper ──
  // {
  //   name: "CompanyName",
  //   fetchJobs: async () => {
  //     const res = await fetch("https://careers.example.com/jobs");
  //     const html = await res.text();
  //     const root = parse(html);
  //     const cards = root.querySelectorAll(".job-card");
  //     return cards.map((card) => ({
  //       id: `companyname-${card.querySelector("a")?.getAttribute("href")}`,
  //       title: card.querySelector(".job-title")?.text.trim() ?? "Unknown",
  //       company: "CompanyName",
  //     }));
  //   },
  // },

  // ── Template for a future JSON API scraper ──
  // {
  //   name: "AnotherCompany",
  //   fetchJobs: async () => {
  //     const res = await fetch("https://api.example.com/jobs");
  //     const data = await res.json();
  //     return data.jobs.map((j: any) => ({
  //       id: `anothercompany-${j.id}`,
  //       title: j.title,
  //       company: "AnotherCompany",
  //     }));
  //   },
  // },
];
