// // import express from "express";
// // import cors from "cors";

// // const app = express();
// // const PORT = process.env.PORT || 5000;

// // app.use(cors());

// // let cachedData = null;
// // let cacheTime = null;
// // const CACHE_DURATION = 10 * 60 * 1000;

// // async function fetchQ8Prices() {
// //   const response = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");

// //   if (!response.ok) {
// //     throw new Error("Failed to fetch Q8 prices");
// //   }

// //   return response.json();
// // }

// // function normalizeQ8Data(rawData) {
// //   const stations = rawData?.data?.stationsPrices || [];

// //   return stations.flatMap((station) =>
// //     station.products.map((product) => ({
// //       stationId: station.stationId,
// //       brand: "Q8/F24",
// //       stationName: station.stationName || "Q8 Station",
// //       address: station.address || "Address not available",
// //       fuelType: product.productName,
// //       price: product.price,
// //       unit: product.unit,
// //       updatedAt: product.priceChangeDate,
// //     })),
// //   );
// // }

// // app.get("/", (req, res) => {
// //   res.json({
// //     message: "Fuel proxy running",
// //   });
// // });

// // app.get("/prices", async (req, res) => {
// //   try {
// //     const now = Date.now();

// //     if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
// //       return res.json({
// //         cached: true,
// //         updatedAt: new Date(cacheTime).toISOString(),
// //         source: "Q8/F24",
// //         data: cachedData,
// //       });
// //     }

// //     const q8Raw = await fetchQ8Prices();
// //     const normalized = normalizeQ8Data(q8Raw);

// //     cachedData = normalized;
// //     cacheTime = now;

// //     res.json({
// //       cached: false,
// //       updatedAt: new Date().toISOString(),
// //       source: "Q8/F24",
// //       data: normalized,
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       error: "Could not fetch fuel prices",
// //       message: error.message,
// //     });
// //   }
// // });

// // app.listen(PORT, () => {
// //   console.log(`Server running on port ${PORT}`);
// // });

// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());

// // ─── Cache ─────────────────────────────────────────────────────────────────
// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000;

// async function fetchQ8Prices() {
//   const response = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
//   if (!response.ok) throw new Error("Failed to fetch Q8 prices");
//   return response.json();
// }

// function mapFuelType(name = "") {
//   const n = name.toLowerCase();
//   if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
//   if (n.includes("95") || n.includes("e10")) return "benzin95";
//   if (n.includes("diesel extra")) return "dieselExtra";
//   if (n.includes("diesel")) return "diesel";
//   if (n.includes("el") || n.includes("electric")) return "el";
//   return "other";
// }

// function groupByStation(flatRows) {
//   const map = {};
//   for (const row of flatRows) {
//     const id = row.stationId;
//     if (!map[id]) {
//       const parts = (row.address || "").split(" ");
//       const city = parts.length >= 3 ? parts[parts.length - 3] : "Danmark";
//       map[id] = {
//         stationId: id,
//         brand: row.brand || "Q8/F24",
//         name: row.stationName || "Q8 Station",
//         address: row.address || "",
//         city,
//         lat: row.lat || null,
//         lng: row.lng || null,
//         prices: {},
//         updatedAt: row.updatedAt,
//       };
//     }
//     const key = mapFuelType(row.fuelType);
//     map[id].prices[key] = {
//       label: row.fuelType,
//       price: row.price,
//       unit: row.unit,
//     };
//   }
//   return Object.values(map);
// }

// function normalizeQ8Data(rawData) {
//   let rows = [];
//   if (Array.isArray(rawData)) {
//     rows = rawData;
//   } else if (rawData?.data?.stationsPrices) {
//     rows = rawData.data.stationsPrices.flatMap((station) =>
//       station.products.map((product) => ({
//         stationId: station.stationId,
//         brand: "Q8/F24",
//         stationName: station.stationName,
//         address: station.address,
//         fuelType: product.productName,
//         price: product.price,
//         unit: product.unit,
//         updatedAt: product.priceChangeDate,
//         lat: station.latitude,
//         lng: station.longitude,
//       })),
//     );
//   }
//   return groupByStation(rows);
// }

// function distanceKm(lat1, lng1, lat2, lng2) {
//   const R = 6371;
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// async function getStations() {
//   const now = Date.now();
//   if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//     return { stations: cachedData, fromCache: true };
//   }
//   const raw = await fetchQ8Prices();
//   const stations = normalizeQ8Data(raw);
//   cachedData = stations;
//   cacheTime = Date.now();
//   return { stations, fromCache: false };
// }

// app.get("/", (req, res) => res.json({ message: "Fuel proxy running" }));

// app.get("/prices", async (req, res) => {
//   try {
//     const { stations, fromCache } = await getStations();
//     res.json({
//       cached: fromCache,
//       updatedAt: new Date(cacheTime).toISOString(),
//       source: "Q8/F24",
//       count: stations.length,
//       stations,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch prices", message: err.message });
//   }
// });

// app.get("/prices/nearby", async (req, res) => {
//   const { lat, lng, radius = 5 } = req.query;
//   if (!lat || !lng) {
//     return res.status(400).json({ error: "lat and lng are required" });
//   }
//   try {
//     const { stations } = await getStations();
//     const userLat = parseFloat(lat);
//     const userLng = parseFloat(lng);
//     const maxKm = parseFloat(radius);

//     const nearby = stations
//       .filter((s) => s.lat && s.lng)
//       .map((s) => ({
//         ...s,
//         distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)),
//       }))
//       .filter((s) => s.distanceKm <= maxKm)
//       .sort((a, b) => a.distanceKm - b.distanceKm)
//       .slice(0, 20);

//     res.json({
//       updatedAt: new Date(cacheTime).toISOString(),
//       userLocation: { lat: userLat, lng: userLng },
//       radiusKm: maxKm,
//       count: nearby.length,
//       stations: nearby,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch nearby", message: err.message });
//   }
// });

// app.get("/health", (req, res) => {
//   res.json({
//     status: "ok",
//     cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
//     stationCount: cachedData?.length || 0,
//   });
// });

// app.listen(PORT, () => {
//   console.log(`Fuel proxy running on port ${PORT}`);
// });

// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());

// // ─── Cache ──────────────────────────────────────────────────────────────────
// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000; // 10 min

// // ─── Fetch raw Q8 flat list ──────────────────────────────────────────────────
// async function fetchQ8Prices() {
//   const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
//   if (!res.ok) throw new Error(`Q8 API error: ${res.status}`);
//   return res.json();
// }

// // ─── Map Q8 fuelType label → our standard key ────────────────────────────────
// function mapFuelType(name = "") {
//   const n = name.toLowerCase();
//   if (n.includes("hvo") || n.includes("neste")) return "other";
//   if (n.includes("hpc")) return "el"; // HPC = fast charger
//   if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
//   if (n.includes("95") || n.includes("e10")) return "benzin95";
//   if (n.includes("diesel extra")) return "dieselExtra";
//   if (n.includes("diesel")) return "diesel";
//   if (n.includes("el") || n.includes("electric") || n.includes("kwh")) return "el";
//   return "other";
// }

// // ─── Parse city from address string ──────────────────────────────────────────
// // Address format: "Frederikssundsvej 349 Brønshøj 2700 Danmark"
// // City is the word before the postal code (4 digits)
// function parseCity(address) {
//   if (!address || typeof address !== "string") return "Danmark";
//   const parts = address.trim().split(" ");
//   const postalIndex = parts.findIndex((p) => /^\d{4}$/.test(p));
//   if (postalIndex > 0) return parts[postalIndex - 1];
//   // Fallback: 3rd from end before "Danmark"
//   if (parts.length >= 3) return parts[parts.length - 3];
//   return "Danmark";
// }

// // ─── Group flat rows → one object per station ─────────────────────────────────
// // The Q8 API returns one row per fuel type per station — we group them
// function groupByStation(flatRows) {
//   const map = {};

//   for (const row of flatRows) {
//     const id = String(row.stationId);

//     if (!map[id]) {
//       map[id] = {
//         stationId: id,
//         brand: row.brand || "Q8/F24",
//         name: row.stationName || row.name || "Q8 Station",
//         address: row.address || row.streetAddress || "",
//         city: parseCity(row.address || row.streetAddress),
//         lat: row.latitude != null ? parseFloat(row.latitude) : null,
//         lng: row.longitude != null ? parseFloat(row.longitude) : null,
//         prices: {},
//         updatedAt: row.updatedAt,
//       };
//     }

//     const key = mapFuelType(row.fuelType);
//     // Only store if we don't have this key yet, or overwrite "other"
//     if (!map[id].prices[key] || key !== "other") {
//       map[id].prices[key] = {
//         label: row.fuelType,
//         price: parseFloat(row.price),
//         unit: row.unit || "L",
//       };
//     }
//   }

//   return Object.values(map);
// }

// // ─── Normalise raw response (handles flat array OR nested shape) ──────────────
// function normalizeQ8Data(rawData) {
//   let rows = [];

//   if (Array.isArray(rawData)) {
//     // Flat array — each element is one fuel-type row
//     rows = rawData;
//   } else if (rawData?.data?.stationsPrices) {
//     // Nested shape — flatten it
//     rows = rawData.data.stationsPrices.flatMap((station) =>
//       (station.products || []).map((product) => ({
//         stationId: station.stationId,
//         brand: "Q8/F24",
//         stationName: station.stationName,
//         address: station.address,
//         fuelType: product.productName,
//         price: product.price,
//         unit: product.unit,
//         updatedAt: product.priceChangeDate,
//         latitude: station.latitude,
//         longitude: station.longitude,
//       })),
//     );
//   }

//   return groupByStation(rows);
// }

// // ─── Haversine distance ───────────────────────────────────────────────────────
// function distanceKm(lat1, lng1, lat2, lng2) {
//   const R = 6371,
//     d2r = Math.PI / 180;
//   const dLat = (lat2 - lat1) * d2r;
//   const dLng = (lng2 - lng1) * d2r;
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// // ─── Shared: get stations from cache or fresh ─────────────────────────────────
// async function getStations() {
//   const now = Date.now();
//   if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//     return { stations: cachedData, fromCache: true };
//   }
//   const raw = await fetchQ8Prices();
//   const stations = normalizeQ8Data(raw);
//   cachedData = stations;
//   cacheTime = Date.now();
//   return { stations, fromCache: false };
// }

// // ─── Routes ───────────────────────────────────────────────────────────────────
// app.get("/", (req, res) => res.json({ message: "⛽ Fuel proxy running" }));

// // GET /prices — all stations grouped with all fuel prices
// app.get("/prices", async (req, res) => {
//   try {
//     const { stations, fromCache } = await getStations();
//     res.json({
//       cached: fromCache,
//       updatedAt: new Date(cacheTime).toISOString(),
//       source: "Q8/F24",
//       count: stations.length,
//       stations,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch prices", message: err.message });
//   }
// });

// // GET /prices/nearby?lat=55.67&lng=12.56&radius=5
// app.get("/prices/nearby", async (req, res) => {
//   const { lat, lng, radius = 10 } = req.query;
//   if (!lat || !lng) {
//     return res.status(400).json({ error: "lat and lng are required" });
//   }
//   try {
//     const { stations } = await getStations();
//     const userLat = parseFloat(lat);
//     const userLng = parseFloat(lng);
//     const maxKm = parseFloat(radius);

//     const nearby = stations
//       .filter((s) => s.lat && s.lng)
//       .map((s) => ({
//         ...s,
//         distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)),
//       }))
//       .filter((s) => s.distanceKm <= maxKm)
//       .sort((a, b) => a.distanceKm - b.distanceKm)
//       .slice(0, 20);

//     res.json({
//       updatedAt: new Date(cacheTime).toISOString(),
//       userLocation: { lat: userLat, lng: userLng },
//       radiusKm: maxKm,
//       count: nearby.length,
//       stations: nearby,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch nearby", message: err.message });
//   }
// });

// // GET /health
// app.get("/health", (req, res) => {
//   res.json({
//     status: "ok",
//     cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
//     stationCount: cachedData?.length || 0,
//   });
// });

// app.listen(PORT, () => {
//   console.log(`⛽ Fuel proxy running on port ${PORT}`);
// });

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchQ8Prices() {
  const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
  if (!res.ok) throw new Error(`Q8 API error: ${res.status}`);
  return res.json();
}

function mapFuelType(name = "") {
  const n = name.toLowerCase();
  if (n.includes("hvo") || n.includes("neste")) return "other";
  if (n.includes("hpc")) return "el";
  if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
  if (n.includes("95") || n.includes("e10")) return "benzin95";
  if (n.includes("diesel extra")) return "dieselExtra";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("el") || n.includes("electric") || n.includes("kwh")) return "el";
  return "other";
}

function parseCity(address) {
  if (!address || typeof address !== "string") return "Danmark";
  const parts = address.trim().split(" ");
  const postalIndex = parts.findIndex((p) => /^\d{4}$/.test(p));
  if (postalIndex > 0) return parts[postalIndex - 1];
  if (parts.length >= 3) return parts[parts.length - 3];
  return "Danmark";
}

// Handles ALL possible shapes the Q8 API might return
function normalizeToFlatRows(rawData) {
  // Shape 1: flat array of fuel-type rows
  // [{ stationId, stationName, address, fuelType, price, ... }]
  if (Array.isArray(rawData)) {
    return rawData;
  }

  // Shape 2: { data: { stationsPrices: [{ stationId, products: [...] }] } }
  if (rawData?.data?.stationsPrices) {
    return rawData.data.stationsPrices.flatMap((station) =>
      (station.products || []).map((product) => ({
        stationId: station.stationId,
        stationName: station.stationName || station.name,
        address: station.address || station.streetAddress,
        latitude: station.latitude || station.lat,
        longitude: station.longitude || station.lng,
        brand: "Q8/F24",
        fuelType: product.productName || product.fuelType || product.name,
        price: product.price,
        unit: product.unit,
        updatedAt: product.priceChangeDate || product.updatedAt,
      })),
    );
  }

  // Shape 3: top-level stationsPrices array
  if (rawData?.stationsPrices) {
    return rawData.stationsPrices.flatMap((station) =>
      (station.products || []).map((product) => ({
        stationId: station.stationId,
        stationName: station.stationName || station.name,
        address: station.address || station.streetAddress,
        latitude: station.latitude || station.lat,
        longitude: station.longitude || station.lng,
        brand: "Q8/F24",
        fuelType: product.productName || product.fuelType,
        price: product.price,
        unit: product.unit,
        updatedAt: product.priceChangeDate || product.updatedAt,
      })),
    );
  }

  // Unknown shape — return empty so we don't crash
  console.error("Unknown Q8 API shape:", JSON.stringify(rawData).slice(0, 300));
  return [];
}

function groupByStation(flatRows) {
  const map = {};
  for (const row of flatRows) {
    const id = String(row.stationId);
    if (!map[id]) {
      const addr = row.address || row.streetAddress || "";
      map[id] = {
        stationId: id,
        brand: row.brand || "Q8/F24",
        name: row.stationName || row.name || "Q8 Station",
        address: addr,
        city: parseCity(addr),
        lat: row.latitude != null ? parseFloat(row.latitude) : null,
        lng: row.longitude != null ? parseFloat(row.longitude) : null,
        prices: {},
        updatedAt: row.updatedAt,
      };
    }
    const key = mapFuelType(row.fuelType || "");
    if (!map[id].prices[key] || key !== "other") {
      map[id].prices[key] = {
        label: row.fuelType,
        price: parseFloat(row.price),
        unit: row.unit || "L",
      };
    }
  }
  return Object.values(map);
}

async function getStations() {
  const now = Date.now();
  if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
    return { stations: cachedData, fromCache: true };
  }
  const raw = await fetchQ8Prices();
  const rows = normalizeToFlatRows(raw);
  const stations = groupByStation(rows);
  cachedData = stations;
  cacheTime = Date.now();
  return { stations, fromCache: false };
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371,
    d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r;
  const dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ message: "⛽ Fuel proxy running" }));

// DEBUG: shows raw API shape + first 2 rows — remove after fixing
app.get("/debug", async (req, res) => {
  try {
    const raw = await fetchQ8Prices();
    const rows = normalizeToFlatRows(raw);
    res.json({
      rawType: Array.isArray(raw) ? "flat_array" : typeof raw,
      rawKeys: Array.isArray(raw) ? Object.keys(raw[0] || {}) : Object.keys(raw || {}),
      firstRawRow: Array.isArray(raw) ? raw[0] : raw,
      totalRows: rows.length,
      firstNormalizedRows: rows.slice(0, 2),
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
      source: "Q8/F24",
      count: stations.length,
      stations,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch prices", message: err.message });
  }
});

app.get("/prices/nearby", async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });
  try {
    const { stations } = await getStations();
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxKm = parseFloat(radius);
    const nearby = stations
      .filter((s) => s.lat && s.lng)
      .map((s) => ({ ...s, distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)) }))
      .filter((s) => s.distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);
    res.json({ updatedAt: new Date(cacheTime).toISOString(), count: nearby.length, stations: nearby });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch nearby", message: err.message });
  }
});

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
    stationCount: cachedData?.length || 0,
  }),
);

app.listen(PORT, () => console.log(`⛽ Fuel proxy running on port ${PORT}`));
