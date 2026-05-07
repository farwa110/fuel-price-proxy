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

// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());

// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000;

// async function fetchQ8Prices() {
//   const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
//   if (!res.ok) throw new Error(`Q8 API error: ${res.status}`);
//   return res.json();
// }

// function mapFuelType(name = "") {
//   const n = name.toLowerCase();
//   if (n.includes("hvo") || n.includes("neste")) return "other";
//   if (n.includes("hpc")) return "el";
//   if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
//   if (n.includes("95") || n.includes("e10")) return "benzin95";
//   if (n.includes("diesel extra")) return "dieselExtra";
//   if (n.includes("diesel")) return "diesel";
//   if (n.includes("el") || n.includes("electric") || n.includes("kwh")) return "el";
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

// // Handles ALL possible shapes the Q8 API might return
// function normalizeToFlatRows(rawData) {
//   // Shape 1: flat array of fuel-type rows
//   // [{ stationId, stationName, address, fuelType, price, ... }]
//   if (Array.isArray(rawData)) {
//     return rawData;
//   }

//   // Shape 2: { data: { stationsPrices: [{ stationId, products: [...] }] } }
//   if (rawData?.data?.stationsPrices) {
//     return rawData.data.stationsPrices.flatMap((station) =>
//       (station.products || []).map((product) => ({
//         stationId: station.stationId,
//         stationName: station.stationName || station.name,
//         address: station.address || station.streetAddress,
//         latitude: station.latitude || station.lat,
//         longitude: station.longitude || station.lng,
//         brand: "Q8/F24",
//         fuelType: product.productName || product.fuelType || product.name,
//         price: product.price,
//         unit: product.unit,
//         updatedAt: product.priceChangeDate || product.updatedAt,
//       })),
//     );
//   }

//   // Shape 3: top-level stationsPrices array
//   if (rawData?.stationsPrices) {
//     return rawData.stationsPrices.flatMap((station) =>
//       (station.products || []).map((product) => ({
//         stationId: station.stationId,
//         stationName: station.stationName || station.name,
//         address: station.address || station.streetAddress,
//         latitude: station.latitude || station.lat,
//         longitude: station.longitude || station.lng,
//         brand: "Q8/F24",
//         fuelType: product.productName || product.fuelType,
//         price: product.price,
//         unit: product.unit,
//         updatedAt: product.priceChangeDate || product.updatedAt,
//       })),
//     );
//   }

//   // Unknown shape — return empty so we don't crash
//   console.error("Unknown Q8 API shape:", JSON.stringify(rawData).slice(0, 300));
//   return [];
// }

// function groupByStation(flatRows) {
//   const map = {};
//   for (const row of flatRows) {
//     const id = String(row.stationId);
//     if (!map[id]) {
//       const addr = row.address || row.streetAddress || "";
//       map[id] = {
//         stationId: id,
//         brand: row.brand || "Q8/F24",
//         name: row.stationName || row.name || "Q8 Station",
//         address: addr,
//         city: parseCity(addr),
//         lat: row.latitude != null ? parseFloat(row.latitude) : null,
//         lng: row.longitude != null ? parseFloat(row.longitude) : null,
//         prices: {},
//         updatedAt: row.updatedAt,
//       };
//     }
//     const key = mapFuelType(row.fuelType || "");
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

// async function getStations() {
//   const now = Date.now();
//   if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//     return { stations: cachedData, fromCache: true };
//   }
//   const raw = await fetchQ8Prices();
//   const rows = normalizeToFlatRows(raw);
//   const stations = groupByStation(rows);
//   cachedData = stations;
//   cacheTime = Date.now();
//   return { stations, fromCache: false };
// }

// function distanceKm(lat1, lng1, lat2, lng2) {
//   const R = 6371,
//     d2r = Math.PI / 180;
//   const dLat = (lat2 - lat1) * d2r;
//   const dLng = (lng2 - lng1) * d2r;
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// // ── Routes ────────────────────────────────────────────────────────────────────

// app.get("/", (req, res) => res.json({ message: "⛽ Fuel proxy running" }));

// // DEBUG: shows raw API shape + first 2 rows — remove after fixing
// app.get("/debug", async (req, res) => {
//   try {
//     const raw = await fetchQ8Prices();
//     const rows = normalizeToFlatRows(raw);
//     res.json({
//       rawType: Array.isArray(raw) ? "flat_array" : typeof raw,
//       rawKeys: Array.isArray(raw) ? Object.keys(raw[0] || {}) : Object.keys(raw || {}),
//       firstRawRow: Array.isArray(raw) ? raw[0] : raw,
//       totalRows: rows.length,
//       firstNormalizedRows: rows.slice(0, 2),
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
//       source: "Q8/F24",
//       count: stations.length,
//       stations,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch prices", message: err.message });
//   }
// });

// app.get("/prices/nearby", async (req, res) => {
//   const { lat, lng, radius = 10 } = req.query;
//   if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });
//   try {
//     const { stations } = await getStations();
//     const userLat = parseFloat(lat);
//     const userLng = parseFloat(lng);
//     const maxKm = parseFloat(radius);
//     const nearby = stations
//       .filter((s) => s.lat && s.lng)
//       .map((s) => ({ ...s, distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)) }))
//       .filter((s) => s.distanceKm <= maxKm)
//       .sort((a, b) => a.distanceKm - b.distanceKm)
//       .slice(0, 20);
//     res.json({ updatedAt: new Date(cacheTime).toISOString(), count: nearby.length, stations: nearby });
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

// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;
// app.use(cors());

// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000;

// // ─── Fetch prices (has products but name/address null for most) ───────────────
// async function fetchQ8Prices() {
//   const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
//   if (!res.ok) throw new Error(`Q8 prices error: ${res.status}`);
//   return res.json();
// }

// // ─── Fetch station details (has name, address, lat, lng) ─────────────────────
// async function fetchQ8Stations() {
//   try {
//     const res = await fetch("https://beta.q8.dk/Station/GetStations?page=1&pageSize=2000");
//     if (!res.ok) return null;
//     return res.json();
//   } catch {
//     return null; // non-fatal — prices still work without details
//   }
// }

// // ─── Map Q8 fuelType label → standard key ────────────────────────────────────
// function mapFuelType(name = "") {
//   const n = name.toLowerCase();
//   if (n.includes("hvo") || n.includes("neste") || n.includes("adblue")) return "other";
//   if (n.includes("hpc")) return "el";
//   if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
//   if (n.includes("95") || n.includes("e10")) return "benzin95";
//   if (n.includes("diesel extra")) return "dieselExtra";
//   if (n.includes("diesel")) return "diesel";
//   if (n.includes("kwh") || n.includes("el") || n.includes("electric")) return "el";
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

// // ─── Build station details map from GetStations response ─────────────────────
// function buildDetailsMap(stationsRaw) {
//   if (!stationsRaw) return {};
//   const map = {};

//   // Try common shapes
//   const list = stationsRaw?.data?.stations || stationsRaw?.stations || (Array.isArray(stationsRaw) ? stationsRaw : []);

//   for (const s of list) {
//     const id = String(s.stationId || s.id);
//     map[id] = {
//       name: s.stationName || s.name || null,
//       address: s.address || s.streetAddress || null,
//       lat: s.latitude != null ? parseFloat(s.latitude) : null,
//       lng: s.longitude != null ? parseFloat(s.longitude) : null,
//     };
//   }
//   return map;
// }

// // ─── Main normalization ───────────────────────────────────────────────────────
// function normalizeData(pricesRaw, detailsMap) {
//   const stationsPrices = pricesRaw?.data?.stationsPrices || pricesRaw?.stationsPrices || (Array.isArray(pricesRaw) ? pricesRaw : []);

//   const map = {};

//   for (const station of stationsPrices) {
//     const id = String(station.stationId);
//     const details = detailsMap[id] || {};

//     // Prefer details endpoint for name/address/coords,
//     // fall back to what prices endpoint gives us
//     const name = details.name || station.stationName || null;
//     const address = details.address || station.address || null;
//     const lat = details.lat ?? (station.latitude != null ? parseFloat(station.latitude) : null);
//     const lng = details.lng ?? (station.longitude != null ? parseFloat(station.longitude) : null);

//     map[id] = {
//       stationId: id,
//       brand: "Q8/F24",
//       name: name || `Q8 #${id}`, // fallback: "Q8 #3081"
//       address: address || "",
//       city: parseCity(address),
//       lat,
//       lng,
//       prices: {},
//       updatedAt: null,
//     };

//     for (const product of station.products || []) {
//       const key = mapFuelType(product.productName || "");
//       if (key === "other") continue; // skip AdBlue, HVO etc
//       map[id].prices[key] = {
//         label: product.productName,
//         price: parseFloat(product.price),
//         unit: product.unit || "L",
//       };
//       if (!map[id].updatedAt) map[id].updatedAt = product.priceChangeDate;
//     }
//   }

//   return Object.values(map).filter((s) => Object.keys(s.prices).length > 0);
// }

// function distanceKm(lat1, lng1, lat2, lng2) {
//   const R = 6371,
//     d2r = Math.PI / 180;
//   const dLat = (lat2 - lat1) * d2r;
//   const dLng = (lng2 - lng1) * d2r;
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// async function getStations() {
//   const now = Date.now();
//   if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//     return { stations: cachedData, fromCache: true };
//   }

//   // Fetch both in parallel — details failure is non-fatal
//   const [pricesRaw, stationsRaw] = await Promise.all([fetchQ8Prices(), fetchQ8Stations()]);

//   const detailsMap = buildDetailsMap(stationsRaw);
//   const stations = normalizeData(pricesRaw, detailsMap);

//   cachedData = stations;
//   cacheTime = Date.now();
//   return { stations, fromCache: false };
// }

// // ── Routes ────────────────────────────────────────────────────────────────────

// app.get("/", (req, res) => res.json({ message: "⛽ Fuel proxy running" }));

// // Debug: check raw API shapes
// app.get("/debug", async (req, res) => {
//   try {
//     const [pricesRaw, stationsRaw] = await Promise.all([fetchQ8Prices(), fetchQ8Stations()]);
//     const detailsMap = buildDetailsMap(stationsRaw);
//     res.json({
//       pricesShape: Object.keys(pricesRaw || {}),
//       stationsShape: stationsRaw ? Object.keys(stationsRaw) : "endpoint not available",
//       detailsMapSize: Object.keys(detailsMap).length,
//       samplePrice: pricesRaw?.data?.stationsPrices?.[0],
//       sampleDetails: Object.values(detailsMap)[0] || null,
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
//       source: "Q8/F24",
//       count: stations.length,
//       stations,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Could not fetch prices", message: err.message });
//   }
// });

// app.get("/prices/nearby", async (req, res) => {
//   const { lat, lng, radius = 10 } = req.query;
//   if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });
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
//     res.json({ updatedAt: new Date(cacheTime).toISOString(), count: nearby.length, stations: nearby });
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

// ─── Circle K + INGO bulk fetch (one call, all stations + prices) ─────────────
async function fetchCircleK() {
  const res = await fetch("https://api.circlek.com/eu/prices/v1/fuel/countries/DK", {
    headers: { "X-App-Name": "PRICES", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Circle K error: ${res.status}`);
  const data = await res.json();
  return data?.sites || [];
}

// ─── Q8 / F24 bulk fetch ──────────────────────────────────────────────────────
async function fetchQ8() {
  const res = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
  if (!res.ok) throw new Error(`Q8 error: ${res.status}`);
  return res.json();
}

// ─── Fuel type mapping ────────────────────────────────────────────────────────
function mapFuelType(name = "") {
  const n = name.toLowerCase();
  // Circle K "miles" branding
  if (n === "miles 95" || n.includes("miles 95")) return "benzin95";
  if (n === "miles+ 95" || n.includes("miles+ 95")) return "benzin95extra";
  if (n === "miles diesel" || (n.includes("miles diesel") && !n.includes("+"))) return "diesel";
  if (n === "miles+ diesel" || n.includes("miles+ diesel")) return "dieselExtra";
  // Q8 branding
  if (n.includes("hvo") || n.includes("neste") || n.includes("adblue")) return "other";
  if (n.includes("hpc")) return "el";
  if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
  if (n.includes("95") || n.includes("e10")) return "benzin95";
  if (n.includes("diesel extra")) return "dieselExtra";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("kwh") || n.includes("electric")) return "el";
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

// ─── Normalize Circle K site → standard station object ───────────────────────
function normalizeCircleKSite(site) {
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

  return {
    stationId: `ck-${site.id}`,
    brand,
    name: site.name || `${brand} Station`,
    address: [site.address?.street, site.address?.postalCode, site.address?.city].filter(Boolean).join(", "),
    city: site.address?.city || "Danmark",
    lat: site.address?.latitude != null ? parseFloat(site.address.latitude) : null,
    lng: site.address?.longitude != null ? parseFloat(site.address.longitude) : null,
    prices,
    updatedAt: site.fuelPrices?.[0]?.lastUpdated || null,
  };
}

// ─── Normalize Q8 response → standard station objects ────────────────────────
function normalizeQ8(raw) {
  const list = raw?.data?.stationsPrices || raw?.stationsPrices || (Array.isArray(raw) ? raw : []);

  return list
    .map((station) => {
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
      if (!Object.keys(prices).length) return null;

      const address = station.address || "";
      return {
        stationId: `q8-${station.stationId}`,
        brand: "Q8/F24",
        name: station.stationName || `Q8 #${station.stationId}`,
        address,
        city: parseCity(address),
        lat: station.latitude != null ? parseFloat(station.latitude) : null,
        lng: station.longitude != null ? parseFloat(station.longitude) : null,
        prices,
        updatedAt: station.products?.[0]?.priceChangeDate || null,
      };
    })
    .filter(Boolean);
}

// ─── Main: fetch all sources in parallel ─────────────────────────────────────
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

  const ckStations = ckSites.map(normalizeCircleKSite).filter(Boolean);
  const q8Stations = normalizeQ8(q8Raw);
  const all = [...ckStations, ...q8Stations];

  console.log(`✅ ${ckStations.length} Circle K/INGO + ${q8Stations.length} Q8 = ${all.length} total`);

  cachedData = all;
  cacheTime = Date.now();
  return { stations: all, fromCache: false };
}

// ─── Haversine ────────────────────────────────────────────────────────────────
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371,
    d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r;
  const dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ message: "⛽ Q8 + Circle K + INGO" }));

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
    res.status(500).json({ error: "Could not fetch prices", message: err.message });
  }
});

app.get("/prices/nearby", async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  try {
    const { stations } = await getStations();
    const userLat = parseFloat(lat),
      userLng = parseFloat(lng),
      maxKm = parseFloat(radius);
    const nearby = stations
      .filter((s) => s.lat && s.lng)
      .map((s) => ({ ...s, distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)) }))
      .filter((s) => s.distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);
    res.json({
      updatedAt: new Date(cacheTime).toISOString(),
      count: nearby.length,
      stations: nearby,
    });
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
