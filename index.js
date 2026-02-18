const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const API_KEY = process.env.API_KEY;
const TARGET_COUNT = parseInt(process.env.TARGET_COUNT, 10) || 1000;

// Service types to search (broad coverage)
const SERVICE_KEYWORDS = [
  "physiotherapist", "chiropractor", "acupuncture", "massage therapist", "osteopath", 
  "physical therapy", "sports medicine clinic", "rehabilitation clinic", "naturopath", 
  "podiatrist", "RMT massage", "kinesiologist", "physiotherapy clinic", "chiropractic clinic", 
  "acupuncture clinic", "massage clinic", "osteopathy clinic", "sports physiotherapy", 
  "pelvic floor physiotherapy", "hand therapy clinic",

  // New Clinical Additions
  "occupational therapy", "athletic therapist", "vestibular rehab", "concussion clinic", 
  "shockwave therapy", "custom orthotics", "manual therapy", "laser therapy clinic",

  // Holistic & Wellness
  "nutritionist", "psychotherapy", "cupping clinic", "reflexology", "homeopathy", 
  "counselling", "craniosacral therapy",

  // Outcome-Based
  "injury rehab", "pain management", "wellness center", "MVA rehabilitation", 
  "WSIB clinic", "post-op recovery"
];



const LOCATIONS = [  "Markham", "Richmond Hill", "Oakville", "Burlington", "Oshawa", "Whitby", // GTA Expansion
  "Ottawa", "London", "Kitchener", "Waterloo", "Windsor", "Barrie", "Kingston" ];// Province-wide"Ontario", "Greater Toronto Area", "Toronto", "Mississauga", "Brampton", "Vaughan", "Hamilton"];

// const LOCATIONS = [
//   "British Columbia", 
//   "Metro Vancouver", "Lower Mainland", "Fraser Valley", // Broad Regions
//   "Vancouver", "Surrey", "Burnaby", "Richmond", "Coquitlam", "Langley", // Core Metro Cities
//   "Abbotsford", "Chilliwack", "Maple Ridge", "New Westminster", "Delta", "North Vancouver", // Greater Vancouver/Fraser Valley Expansion
//   "Victoria", "Nanaimo", "Saanich", "Courtenay", // Vancouver Island
//   "Kelowna", "Kamloops", "Penticton", "Vernon", // Thompson-Okanagan (The Interior)
//   "Prince George", "Fort St. John", "Nanaimo", "White Rock" // Other Major Hubs
// ];


// const LOCATIONS = [
//   "Alberta",
//   "Calgary Metropolitan Region", 
//   "Calgary", "Airdrie", "Cochrane", "Chestermere", "Okotoks", // Core Metro Area
//   "Northwest Calgary", "Northeast Calgary", "Southwest Calgary", "Southeast Calgary", // Quadrants
//   "Beltline", "Downtown Calgary", "Bridgeland", "Kensington", // Key Inner-City Hubs
//   "High River", "Strathmore", "Canmore", "Banff", // Satellite & Resort Towns
//   "Rocky View County", "Foothills County", "Langdon", "Crossfield" // Surrounding Municipalities
// ];


// const LOCATIONS = [
//   "Alberta",
//   "Edmonton Metropolitan Region", 
//   "Edmonton", "St. Albert", "Sherwood Park", "Strathcona County", "Leduc", "Spruce Grove", // Core Metro
//   "Fort Saskatchewan", "Beaumont", "Stony Plain", "Devon", "Morinville", // Surrounding Hubs
//   "Northwest Edmonton", "Southwest Edmonton", "Northeast Edmonton", "Southeast Edmonton", // City Quadrants
//   "Downtown Edmonton", "Oliver", "Whyte Ave", "Strathcona", "Glenora", // High-Traffic Neighborhoods
//   "Mill Woods", "Terwillegar", "Windermere", "Clareview", "Griesbach", // Major Residential Hubs
//   "Nisku", "Enoch", "Acheson" // Key Industrial & Business Hubs
// ];

// const LOCATIONS = [
//   "Saskatchewan",
//   "Regina", "White City", "Emerald Park", "Pilot Butte", "Balgonie", // Core & Metro
//   "Lumsden", "Regina Beach", "Pense", "Grand Coulee", "Belle Plaine", // Commuter Towns
//   "East Regina", "West Regina", "North Regina", "South Regina", "Central Regina", // Major Zones
//   "Downtown Regina", "Cathedral", "The Crescents", "Warehouse District", "Heritage", // Historic/Central
//   "Harbour Landing", "Westerra", "The Creeks", "The Towns", "Greens on Gardiner", // New Developments
//   "Albert Park", "Whitmore Park", "Lakeview", "Hillsdale", "University Park", // Established South/East
//   "Argyle Park", "Uplands", "Walsh Acres", "Lakeridge", "Rochdale", // North Hubs
//   "Normanview", "Rosemont", "Dieppe", "Mount Royal", "Sherwood Estates" // West Hubs
// ];

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
    const fields = "name,formatted_address,business_status,website,formatted_phone_number,international_phone_number,types";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
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

/** Parse business name into first word and rest (for firstName/lastName columns). */
function parseBusinessName(fullName) {
  const s = (fullName || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const i = s.indexOf(" ");
  if (i <= 0) return { firstName: s, lastName: "" };
  return { firstName: s.slice(0, i), lastName: s.slice(i + 1).trim() };
}

// Disambiguate province/region names so "Ontario" doesn't match "Ontario Street, Vancouver"
const LOCATION_SUFFIX = {
  "Ontario": ", Canada",
  "British Columbia": ", Canada",
  "Alberta": ", Canada",
  "Saskatchewan": ", Canada",
};
function locationQuery(location) {
  const suffix = LOCATION_SUFFIX[location] || "";
  return `${location}${suffix}`;
}

/** Fetch one page of text search; returns { results, next_page_token } */
async function textSearchPage(query, pageToken = null) {
  const location = locationQuery(query.location);
  const params = new URLSearchParams({
    query: `${query.keyword} in ${location}`,
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

/** Collect up to 3 pages (60 results) per query; returns { placeId, serviceType }[] */
async function collectPlaceIdsForQuery(keyword, location) {
  const entries = [];
  let pageToken = null;
  for (let page = 0; page < 3; page++) {
    if (page > 0) await delay(2200);
    const { results, next_page_token } = await textSearchPage({ keyword, location }, pageToken);
    results.forEach((r) => entries.push({ placeId: r.place_id, serviceType: keyword }));
    pageToken = next_page_token;
    if (!pageToken) break;
  }
  return entries;
}

/** Gather unique place_ids with service type; returns { placeId, serviceType }[] */
async function gatherAllPlaceIds() {
  const seen = new Set();
  const list = [];
  let totalQueries = 0;
  const totalCombos = SERVICE_KEYWORDS.length * LOCATIONS.length;
  for (const keyword of SERVICE_KEYWORDS) {
    for (const location of LOCATIONS) {
      totalQueries++;
      process.stdout.write(`\rGathering place IDs... query ${totalQueries}/${totalCombos} (${list.length} unique)`);
      const entries = await collectPlaceIdsForQuery(keyword, location);
      entries.forEach(({ placeId, serviceType }) => {
        if (!seen.has(placeId)) {
          seen.add(placeId);
          list.push({ placeId, serviceType });
        }
      });
      await delay(300);
      if (list.length >= TARGET_COUNT * 4) break;
    }
    if (list.length >= TARGET_COUNT * 4) break;
  }
  console.log("\nGathered", list.length, "unique place IDs from", totalQueries, "queries");
  return list;
}

const CSV_HEADERS = ["firstName", "lastName", "name", "email", "address", "website", "phone", "serviceType"];

async function run() {
  const placeList = await gatherAllPlaceIds();
  const rows = [CSV_HEADERS.reduce((acc, h) => ({ ...acc, [h]: h }), {})];
  let checked = 0;

  for (const { placeId, serviceType } of placeList) {
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

      const name = details.name || "";
      const { firstName, lastName } = parseBusinessName(name);
      const phone = details.formatted_phone_number || details.international_phone_number || "";
      const website = details.website || "";

      rows.push({
        firstName,
        lastName,
        email,
        address: details.formatted_address || "",
        website,
        phone,
        serviceType,
        name,
      });
      console.log(`[${rows.length - 1}/${TARGET_COUNT}] ${name} | ${email}`);
    } catch (err) {
      console.warn("Skipping place after error:", err.message || err.code);
    }
    checked++;
    if (checked % 50 === 0) process.stdout.write(`\rChecked ${checked}/${placeList.length} places, ${rows.length - 1} with email so far`);
  }

  const csv = rows.map((r) => CSV_HEADERS.map((h) => escapeCsvField(r[h])).join(",")).join("\n");
  const outPath = "businesses.csv";
  fs.writeFileSync(outPath, csv, "utf8");
  console.log("\nSaved", rows.length - 1, "businesses to", outPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
