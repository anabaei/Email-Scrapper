const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const API_KEY = process.env.API_KEY;
const TARGET_COUNT = process.env.TARGET_COUNT;

// Service types to search (broad coverage)
const SERVICE_KEYWORDS = [
  "physiotherapist",
  "chiropractor",
  "acupuncture",
  "massage therapist",
  "osteopath",
  "physical therapy",
  "sports medicine clinic",
  "rehabilitation clinic",
  "naturopath",
  "podiatrist",
  "RMT massage",
  "kinesiologist",
  "physiotherapy clinic",
  "chiropractic clinic",
  "acupuncture clinic",
  "massage clinic",
  "osteopathy clinic",
  "sports physiotherapy",
  "pelvic floor physiotherapy",
  "hand therapy clinic",
];

const LOCATIONS = ["Ontario", "Greater Toronto Area", "Toronto", "Mississauga", "Brampton", "Vaughan", "Hamilton"];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const AXIOS_TIMEOUT_MS = 15000;
const axiosConfig = { timeout: AXIOS_TIMEOUT_MS };

function extractEmailFromHtml(html) {
  if (!html) return null;
  const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailtoMatch) return mailtoMatch[1].trim();
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0].trim() : null;
}

async function getPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,business_status,website&key=${API_KEY}`;
    const { data } = await axios.get(url, axiosConfig);
    if (data.status !== "OK") return null;
    return data.result;
  } catch (err) {
    console.warn("Place details failed:", err.message || err.code);
    return null;
  }
}

async function fetchEmailFromWebsite(websiteUrl) {
  try {
    const { data } = await axios.get(websiteUrl, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Scraper/1.0)" },
      maxRedirects: 3,
      validateStatus: () => true,
    });
    return extractEmailFromHtml(typeof data === "string" ? data : JSON.stringify(data));
  } catch {
    return null;
  }
}

function escapeCsvField(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Fetch one page of text search; returns { results, next_page_token } */
async function textSearchPage(query, pageToken = null) {
  const params = new URLSearchParams({
    query: `${query.keyword} in ${query.location}`,
    key: API_KEY,
  });
  if (pageToken) params.set("pagetoken", pageToken);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  let data;
  try {
    const res = await axios.get(url, axiosConfig);
    data = res.data;
  } catch (err) {
    console.warn("Text search failed:", err.message || err.code);
    return { results: [], next_page_token: null };
  }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Search error:", data.status, data.error_message || "");
    return { results: [], next_page_token: null };
  }
  return {
    results: data.results || [],
    next_page_token: data.next_page_token || null,
  };
}

/** Collect up to 3 pages (60 results) per query; returns place_ids */
async function collectPlaceIdsForQuery(keyword, location) {
  const placeIds = new Set();
  let pageToken = null;
  for (let page = 0; page < 3; page++) {
    if (page > 0) await delay(2200);
    const { results, next_page_token } = await textSearchPage({ keyword, location }, pageToken);
    results.forEach((r) => placeIds.add(r.place_id));
    pageToken = next_page_token;
    if (!pageToken) break;
  }
  return placeIds;
}

/** Gather unique place_ids from all keyword+location combos */
async function gatherAllPlaceIds() {
  const allIds = new Set();
  let totalQueries = 0;
  const totalCombos = SERVICE_KEYWORDS.length * LOCATIONS.length;
  for (const keyword of SERVICE_KEYWORDS) {
    for (const location of LOCATIONS) {
      totalQueries++;
      process.stdout.write(`\rGathering place IDs... query ${totalQueries}/${totalCombos} (${allIds.size} unique)`);
      const ids = await collectPlaceIdsForQuery(keyword, location);
      ids.forEach((id) => allIds.add(id));
      await delay(300);
      if (allIds.size >= TARGET_COUNT * 4) break;
    }
    if (allIds.size >= TARGET_COUNT * 4) break;
  }
  console.log("\nGathered", allIds.size, "unique place IDs from", totalQueries, "queries");
  return Array.from(allIds);
}

async function run() {
  const placeIds = await gatherAllPlaceIds();
  const rows = [{ name: "name", email: "email", address: "address" }];
  let processed = 0;

  let checked = 0;
  for (const placeId of placeIds) {
    if (rows.length - 1 >= TARGET_COUNT) break;

    try {
      const details = await getPlaceDetails(placeId);
      await delay(100);
      if (!details) continue;
      if (details.business_status !== "OPERATIONAL") continue;

      let email = null;
      if (details.website) {
        email = await fetchEmailFromWebsite(details.website);
        await delay(200);
      }
      if (!email) continue;

      rows.push({
        name: details.name || "",
        email,
        address: details.formatted_address || "",
      });
      processed++;
      console.log(`[${rows.length - 1}/${TARGET_COUNT}] ${details.name} | ${email}`);
    } catch (err) {
      console.warn("Skipping place after error:", err.message || err.code);
    }
    checked++;
    if (checked % 50 === 0) process.stdout.write(`\rChecked ${checked}/${placeIds.length} places, ${rows.length - 1} with email so far`);
  }

  const csv = rows.map((r) => [r.name, r.email, r.address].map(escapeCsvField).join(",")).join("\n");
  const outPath = "businesses.csv";
  fs.writeFileSync(outPath, csv, "utf8");
  console.log("\nSaved", rows.length - 1, "businesses to", outPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
