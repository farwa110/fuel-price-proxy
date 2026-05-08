// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;
// app.use(cors());

// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000; // 10 min

// const geocodeCache = new Map();

// function sleep(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// async function geocodeAddress(address) {
//   if (!address) return { lat: null, lng: null };

//   if (geocodeCache.has(address)) {
//     return geocodeCache.get(address);
//   }

//   try {
//     const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=dk&q=${encodeURIComponent(address)}`;

//     const res = await fetch(url, {
//       headers: {
//         "User-Agent": "fuel-price-app-farwa/1.0",
//       },
//     });

//     const data = await res.json();

//     const coords = data?.[0]
//       ? {
//           lat: parseFloat(data[0].lat),
//           lng: parseFloat(data[0].lon),
//         }
//       : { lat: null, lng: null };

//     geocodeCache.set(address, coords);

//     // polite delay for free OpenStreetMap service
//     await sleep(1000);

//     return coords;
//   } catch (err) {
//     console.error("Geocoding failed:", address, err.message);
//     return { lat: null, lng: null };
//   }
// }

// // ─── Circle K + INGO bulk fetch (one call, all stations + prices) ─────────────
// async function fetchCircleK() {
//   const res = await fetch("https://api.circlek.com/eu/prices/v1/fuel/countries/DK", {
//     headers: { "X-App-Name": "PRICES", Accept: "application/json" },
//   });
//   if (!res.ok) throw new Error(`Circle K error: ${res.status}`);
//   const data = await res.json();
//   return data?.sites || [];
// }

// // ─── Q8 / F24 bulk fetch ──────────────────────────────────────────────────────
// async function fetchQ8() {
//   const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
//   if (!res.ok) throw new Error(`Q8 error: ${res.status}`);
//   return res.json();
// }

// // ─── Fuel type mapping ────────────────────────────────────────────────────────
// function mapFuelType(name = "") {
//   const n = name.toLowerCase();
//   // Circle K "miles" branding
//   if (n === "miles 95" || n.includes("miles 95")) return "benzin95";
//   if (n === "miles+ 95" || n.includes("miles+ 95")) return "benzin95extra";
//   if (n === "miles diesel" || (n.includes("miles diesel") && !n.includes("+"))) return "diesel";
//   if (n === "miles+ diesel" || n.includes("miles+ diesel")) return "dieselExtra";
//   // Q8 branding
//   if (n.includes("hvo") || n.includes("neste") || n.includes("adblue")) return "other";
//   if (n.includes("hpc")) return "el";
//   if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
//   if (n.includes("95") || n.includes("e10")) return "benzin95";
//   if (n.includes("diesel extra")) return "dieselExtra";
//   if (n.includes("diesel")) return "diesel";
//   if (n.includes("kwh") || n.includes("electric")) return "el";
//   return "other";
// }

// function parseCity(address) {
//   if (!address || typeof address !== "string") return "Danmark";
//   const parts = address.trim().split(" ");
//   const postalIndex = parts.findIndex((p) => /^\d{4}$/.test(p));
//   if (postalIndex > 0) return parts[postalIndex - 1];
//   if (parts.length >= 3) return parts[parts.length - 3];
//   return "Danmark";
// }

// // ─── Normalize Circle K site → standard station object ───────────────────────
// async function normalizeCircleKSite(site) {
//   const prices = {};
//   for (const fp of site.fuelPrices || []) {
//     const key = mapFuelType(fp.displayName || "");
//     if (key === "other") continue;
//     prices[key] = {
//       label: fp.displayName,
//       price: parseFloat(fp.price),
//       unit: "L",
//     };
//   }
//   if (!Object.keys(prices).length) return null;

//   const nameUpper = (site.name || "").toUpperCase();
//   const brand = nameUpper.includes("INGO") ? "INGO" : "Circle K";

//   return {
//     stationId: `ck-${site.id}`,
//     brand,
//     name: site.name || `${brand} Station`,
//     address: [site.address?.street, site.address?.postalCode, site.address?.city].filter(Boolean).join(", "),
//     city: site.address?.city || "Danmark",
//     lat: site.address?.latitude != null ? parseFloat(site.address.latitude) : null,
//     lng: site.address?.longitude != null ? parseFloat(site.address.longitude) : null,
//     prices,
//     updatedAt: site.fuelPrices?.[0]?.lastUpdated || null,
//   };
// }

// // ─── Normalize Q8 response → standard station objects ────────────────────────
// async function normalizeQ8(raw) {
//   const list = raw?.data?.stationsPrices || raw?.stationsPrices || (Array.isArray(raw) ? raw : []);

//   // return list
//   //   .map((station) => {
//     const stations = await Promise.all(
//   list.map(async (station) => {
//       const prices = {};
//       for (const product of station.products || []) {
//         const key = mapFuelType(product.productName || "");
//         if (key === "other") continue;
//         prices[key] = {
//           label: product.productName,
//           price: parseFloat(product.price),
//           unit: product.unit || "L",
//         };
//       }
//       if (!Object.keys(prices).length) return null;

//       const address = station.address || "";
//       return {
//         stationId: `q8-${station.stationId}`,
//         brand: "Q8/F24",
//         name: station.stationName || `Q8 #${station.stationId}`,
//         address,
//         city: parseCity(address),
//         lat: station.latitude != null ? parseFloat(station.latitude) : null,
//         lng: station.longitude != null ? parseFloat(station.longitude) : null,
//         prices,
//         updatedAt: station.products?.[0]?.priceChangeDate || null,
//       };
//     })
//     .filter(Boolean);
// }

// // ─── Main: fetch all sources in parallel ─────────────────────────────────────
// async function getStations() {
//   const now = Date.now();
//   if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//     return { stations: cachedData, fromCache: true };
//   }

//   const [ckSites, q8Raw] = await Promise.all([
//     fetchCircleK().catch((e) => {
//       console.error("CK failed:", e.message);
//       return [];
//     }),
//     fetchQ8().catch((e) => {
//       console.error("Q8 failed:", e.message);
//       return {};
//     }),
//   ]);

//   const ckStations = (await Promise.all(ckSites.map(normalizeCircleKSite))).filter(Boolean);
//   const q8Stations = normalizeQ8(q8Raw);
//   const all = [...ckStations, ...q8Stations];

//   console.log(` ${ckStations.length} Circle K/INGO + ${q8Stations.length} Q8 = ${all.length} total`);

//   cachedData = all;
//   cacheTime = Date.now();
//   return { stations: all, fromCache: false };
// }

// // ─── Haversine ────────────────────────────────────────────────────────────────
// function distanceKm(lat1, lng1, lat2, lng2) {
//   const R = 6371,
//     d2r = Math.PI / 180;
//   const dLat = (lat2 - lat1) * d2r;
//   const dLng = (lng2 - lng1) * d2r;
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// // ── Routes ────────────────────────────────────────────────────────────────────
// app.get("/", (req, res) => res.json({ message: "⛽ Q8 + Circle K + INGO" }));

// app.get("/debug", async (req, res) => {
//   try {
//     const ckSites = await fetchCircleK();
//     res.json({
//       totalCircleK: ckSites.length,
//       sample: ckSites.slice(0, 2),
//       brandSplit: {
//         circlek: ckSites.filter((s) => !s.name?.toUpperCase().includes("INGO")).length,
//         ingo: ckSites.filter((s) => s.name?.toUpperCase().includes("INGO")).length,
//       },
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get("/prices", async (req, res) => {
//   try {
//     const { stations, fromCache } = await getStations();
//     res.json({
//       cached: fromCache,
//       updatedAt: new Date(cacheTime).toISOString(),
//       source: "Circle K + INGO + Q8",
//       count: stations.length,
//       brandCounts: {
//         circlek: stations.filter((s) => s.brand === "Circle K").length,
//         ingo: stations.filter((s) => s.brand === "INGO").length,
//         q8: stations.filter((s) => s.brand === "Q8/F24").length,
//       },
//       stations,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch prices", message: err.message });
//   }
// });

// app.get("/prices/nearby", async (req, res) => {
//   const { lat, lng, radius = 10 } = req.query;
//   if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
//   try {
//     const { stations } = await getStations();
//     const userLat = parseFloat(lat),
//       userLng = parseFloat(lng),
//       maxKm = parseFloat(radius);
//     const nearby = stations
//       .filter((s) => s.lat && s.lng)
//       .map((s) => ({ ...s, distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)) }))
//       .filter((s) => s.distanceKm <= maxKm)
//       .sort((a, b) => a.distanceKm - b.distanceKm)
//       .slice(0, 20);
//     res.json({
//       updatedAt: new Date(cacheTime).toISOString(),
//       count: nearby.length,
//       stations: nearby,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch nearby", message: err.message });
//   }
// });

// app.get("/health", (req, res) =>
//   res.json({
//     status: "ok",
//     cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
//     stationCount: cachedData?.length || 0,
//   }),
// );

// app.listen(PORT, () => console.log(`⛽ Fuel proxy running on port ${PORT}`));
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 min

const geocodeCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeAddress(address) {
  if (!address) return { lat: null, lng: null };

  if (geocodeCache.has(address)) {
    return geocodeCache.get(address);
  }

  try {
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

    const coords = data?.[0]
      ? {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        }
      : { lat: null, lng: null };

    geocodeCache.set(address, coords);

    await sleep(1000);

    return coords;
  } catch (err) {
    console.error("Geocoding failed:", address, err.message);
    return { lat: null, lng: null };
  }
}

// ─── Circle K + INGO bulk fetch ───────────────────────────────────────────────
async function fetchCircleK() {
  const res = await fetch("https://api.circlek.com/eu/prices/v1/fuel/countries/DK", {
    headers: { "X-App-Name": "PRICES", Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Circle K error: ${res.status}`);

  const data = await res.json();
  return data?.sites || [];
}

// ─── Q8 / F24 bulk fetch ─────────────────────────────────────────────────────
async function fetchQ8() {
  const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");

  if (!res.ok) throw new Error(`Q8 error: ${res.status}`);

  return res.json();
}

// ─── Fuel type mapping ───────────────────────────────────────────────────────
function mapFuelType(name = "") {
  const n = name.toLowerCase();

  if (n === "miles 95" || n.includes("miles 95")) return "benzin95";
  if (n === "miles+ 95" || n.includes("miles+ 95")) return "benzin95extra";
  if (n === "miles diesel" || (n.includes("miles diesel") && !n.includes("+"))) return "diesel";
  if (n === "miles+ diesel" || n.includes("miles+ diesel")) return "dieselExtra";

  if (n.includes("hvo") || n.includes("neste") || n.includes("adblue")) return "other";
  if (n.includes("hpc")) return "el";
  if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
  if (n.includes("95") || n.includes("e10")) return "benzin95";
  if (n.includes("diesel extra")) return "dieselExtra";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("kwh") || n.includes("electric")) return "el";

  return "other";
}

// Better city parsing for Q8 addresses
function parseCity(address) {
  if (!address || typeof address !== "string") return "Unknown";

  const parts = address.trim().split(/\s+/);
  const postalIndex = parts.findIndex((p) => /^\d{4}$/.test(p));

  if (postalIndex > 0) {
    return parts.slice(postalIndex - 1, postalIndex).join(" ");
  }

  if (parts.length >= 3) return parts[parts.length - 3];

  return "Unknown";
}

// ─── Normalize Circle K site ─────────────────────────────────────────────────
async function normalizeCircleKSite(site) {
  const prices = {};

  for (const fp of site.fuelPrices || []) {
    const key = mapFuelType(fp.displayName || "");

    if (key === "other") continue;

    prices[key] = {
      label: fp.displayName,
      price: parseFloat(fp.price),
      unit: "L",
    };
  }

  if (!Object.keys(prices).length) return null;

  const nameUpper = (site.name || "").toUpperCase();
  const brand = nameUpper.includes("INGO") ? "INGO" : "Circle K";

  const fullAddress = [site.address?.street, site.address?.postalCode, site.address?.city, "Danmark"].filter(Boolean).join(", ");

  const coords = await geocodeAddress(fullAddress);

  return {
    stationId: `ck-${site.id}`,
    brand,
    name: site.name || `${brand} Station`,
    address: [site.address?.street, site.address?.postalCode, site.address?.city].filter(Boolean).join(", "),
    city: site.address?.city || "Danmark",
    municipality: site.address?.state || null,
    lat: site.address?.latitude != null ? parseFloat(site.address.latitude) : coords.lat,
    lng: site.address?.longitude != null ? parseFloat(site.address.longitude) : coords.lng,
    prices,
    updatedAt: site.fuelPrices?.[0]?.lastUpdated || null,
  };
}

// ─── Normalize Q8 response ───────────────────────────────────────────────────
async function normalizeQ8(raw) {
  const list = raw?.data?.stationsPrices || raw?.stationsPrices || (Array.isArray(raw) ? raw : []);

  const stations = [];

  for (const station of list) {
    const prices = {};

    for (const product of station.products || []) {
      const key = mapFuelType(product.productName || "");

      if (key === "other") continue;

      prices[key] = {
        label: product.productName,
        price: parseFloat(product.price),
        unit: product.unit || "L",
      };
    }

    if (!Object.keys(prices).length) continue;

    const address = station.address || "";

    const coords = address ? await geocodeAddress(`${address}`) : { lat: null, lng: null };

    stations.push({
      stationId: `q8-${station.stationId}`,
      brand: "Q8/F24",
      name: station.stationName || `Q8 #${station.stationId}`,
      address: address || "Address unavailable",
      city: parseCity(address),
      lat: station.latitude != null ? parseFloat(station.latitude) : coords.lat,
      lng: station.longitude != null ? parseFloat(station.longitude) : coords.lng,
      prices,
      updatedAt: station.products?.[0]?.priceChangeDate || null,
      hasAddress: Boolean(address),
      hasCoordinates: Boolean(coords.lat && coords.lng),
    });
  }

  return stations;
}

// ─── Main: fetch all sources ─────────────────────────────────────────────────
async function getStations() {
  const now = Date.now();

  if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
    return { stations: cachedData, fromCache: true };
  }

  const [ckSites, q8Raw] = await Promise.all([
    fetchCircleK().catch((e) => {
      console.error("CK failed:", e.message);
      return [];
    }),
    fetchQ8().catch((e) => {
      console.error("Q8 failed:", e.message);
      return {};
    }),
  ]);

  const ckStations = [];

  for (const site of ckSites) {
    const normalized = await normalizeCircleKSite(site);
    if (normalized) ckStations.push(normalized);
  }

  const q8Stations = await normalizeQ8(q8Raw);

  const all = [...ckStations, ...q8Stations];

  console.log(`${ckStations.length} Circle K/INGO + ${q8Stations.length} Q8 = ${all.length} total`);

  cachedData = all;
  cacheTime = Date.now();

  return { stations: all, fromCache: false };
}

// ─── Haversine distance ──────────────────────────────────────────────────────
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const d2r = Math.PI / 180;

  const dLat = (lat2 - lat1) * d2r;
  const dLng = (lng2 - lng1) * d2r;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "⛽ Q8 + Circle K + INGO Fuel Proxy" });
});

app.get("/debug", async (req, res) => {
  try {
    const ckSites = await fetchCircleK();

    res.json({
      totalCircleK: ckSites.length,
      sample: ckSites.slice(0, 2),
      brandSplit: {
        circlek: ckSites.filter((s) => !s.name?.toUpperCase().includes("INGO")).length,
        ingo: ckSites.filter((s) => s.name?.toUpperCase().includes("INGO")).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/prices", async (req, res) => {
  try {
    const { stations, fromCache } = await getStations();

    res.json({
      cached: fromCache,
      updatedAt: new Date(cacheTime).toISOString(),
      source: "Circle K + INGO + Q8",
      count: stations.length,
      brandCounts: {
        circlek: stations.filter((s) => s.brand === "Circle K").length,
        ingo: stations.filter((s) => s.brand === "INGO").length,
        q8: stations.filter((s) => s.brand === "Q8/F24").length,
      },
      stations,
    });
  } catch (err) {
    res.status(500).json({
      error: "Could not fetch prices",
      message: err.message,
    });
  }
});

app.get("/prices/nearby", async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng required" });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxKm = parseFloat(radius);

  if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
    return res.status(400).json({ error: "Invalid lat or lng" });
  }

  try {
    const { stations } = await getStations();

    const nearby = stations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        ...s,
        distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)),
      }))
      .filter((s) => s.distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);

    res.json({
      updatedAt: new Date(cacheTime).toISOString(),
      count: nearby.length,
      stations: nearby,
    });
  } catch (err) {
    res.status(500).json({
      error: "Could not fetch nearby",
      message: err.message,
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
    stationCount: cachedData?.length || 0,
    geocodeCacheSize: geocodeCache.size,
  });
});

app.listen(PORT, () => {
  console.log(`⛽ Fuel proxy running on port ${PORT}`);
});
