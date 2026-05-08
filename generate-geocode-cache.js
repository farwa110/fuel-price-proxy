import fs from "fs";
import path from "path";

const GEO_CACHE_FILE = path.join(process.cwd(), "geocode-cache.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache() {
  if (!fs.existsSync(GEO_CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(GEO_CACHE_FILE, "utf-8"));
}

function saveCache(cache) {
  fs.writeFileSync(GEO_CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function fetchCircleK() {
  const res = await fetch("https://api.circlek.com/eu/prices/v1/fuel/countries/DK", {
    headers: { "X-App-Name": "PRICES", Accept: "application/json" },
  });

  const data = await res.json();
  return data?.sites || [];
}

async function fetchQ8() {
  const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
  return res.json();
}

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=dk&q=${encodeURIComponent(address)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "fuel-price-app-farwa/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding error: ${res.status}`);
  }

  const data = await res.json();

  if (!data?.[0]) {
    return { lat: null, lng: null };
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}

async function main() {
  const cache = loadCache();

  const ckSites = await fetchCircleK();
  const q8Raw = await fetchQ8();

  const q8Stations = q8Raw?.data?.stationsPrices || [];

  const addresses = [];

  for (const site of ckSites) {
    const address = [site.address?.street, site.address?.postalCode, site.address?.city, "Danmark"].filter(Boolean).join(", ");

    if (address) addresses.push(address);
  }

  for (const station of q8Stations) {
    if (station.address) {
      addresses.push(station.address);
    }
  }

  const uniqueAddresses = [...new Set(addresses)];

  console.log(`Found ${uniqueAddresses.length} unique addresses`);
  console.log(`Already cached: ${Object.keys(cache).length}`);

  for (const address of uniqueAddresses) {
    if (cache[address]) {
      console.log(`✅ Cached: ${address}`);
      continue;
    }

    try {
      console.log(`🌍 Geocoding: ${address}`);

      const coords = await geocodeAddress(address);

      cache[address] = coords;
      saveCache(cache);

      console.log(`📍 Saved: ${address}`, coords);

      await sleep(1500);
    } catch (err) {
      console.error(`❌ Failed: ${address}`, err.message);

      if (err.message.includes("429")) {
        console.log("Rate limited. Stop now and run again later.");
        break;
      }

      await sleep(3000);
    }
  }

  console.log("Done.");
}

main();
