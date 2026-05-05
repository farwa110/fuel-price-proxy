// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());

// let cachedData = null;
// let cacheTime = null;
// const CACHE_DURATION = 10 * 60 * 1000;

// async function fetchQ8Prices() {
//   const response = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");

//   if (!response.ok) {
//     throw new Error("Failed to fetch Q8 prices");
//   }

//   return response.json();
// }

// function normalizeQ8Data(rawData) {
//   const stations = rawData?.data?.stationsPrices || [];

//   return stations.flatMap((station) =>
//     station.products.map((product) => ({
//       stationId: station.stationId,
//       brand: "Q8/F24",
//       stationName: station.stationName || "Q8 Station",
//       address: station.address || "Address not available",
//       fuelType: product.productName,
//       price: product.price,
//       unit: product.unit,
//       updatedAt: product.priceChangeDate,
//     })),
//   );
// }

// app.get("/", (req, res) => {
//   res.json({
//     message: "Fuel proxy running",
//   });
// });

// app.get("/prices", async (req, res) => {
//   try {
//     const now = Date.now();

//     if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
//       return res.json({
//         cached: true,
//         updatedAt: new Date(cacheTime).toISOString(),
//         source: "Q8/F24",
//         data: cachedData,
//       });
//     }

//     const q8Raw = await fetchQ8Prices();
//     const normalized = normalizeQ8Data(q8Raw);

//     cachedData = normalized;
//     cacheTime = now;

//     res.json({
//       cached: false,
//       updatedAt: new Date().toISOString(),
//       source: "Q8/F24",
//       data: normalized,
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: "Could not fetch fuel prices",
//       message: error.message,
//     });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// ─── Cache ─────────────────────────────────────────────────────────────────
let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchQ8Prices() {
  const response = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");
  if (!response.ok) throw new Error("Failed to fetch Q8 prices");
  return response.json();
}

function mapFuelType(name = "") {
  const n = name.toLowerCase();
  if (n.includes("95 extra") || n.includes("e5")) return "benzin95extra";
  if (n.includes("95") || n.includes("e10")) return "benzin95";
  if (n.includes("diesel extra")) return "dieselExtra";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("el") || n.includes("electric")) return "el";
  return "other";
}

function groupByStation(flatRows) {
  const map = {};
  for (const row of flatRows) {
    const id = row.stationId;
    if (!map[id]) {
      const parts = (row.address || "").split(" ");
      const city = parts.length >= 3 ? parts[parts.length - 3] : "Danmark";
      map[id] = {
        stationId: id,
        brand: row.brand || "Q8/F24",
        name: row.stationName || "Q8 Station",
        address: row.address || "",
        city,
        lat: row.lat || null,
        lng: row.lng || null,
        prices: {},
        updatedAt: row.updatedAt,
      };
    }
    const key = mapFuelType(row.fuelType);
    map[id].prices[key] = {
      label: row.fuelType,
      price: row.price,
      unit: row.unit,
    };
  }
  return Object.values(map);
}

function normalizeQ8Data(rawData) {
  let rows = [];
  if (Array.isArray(rawData)) {
    rows = rawData;
  } else if (rawData?.data?.stationsPrices) {
    rows = rawData.data.stationsPrices.flatMap((station) =>
      station.products.map((product) => ({
        stationId: station.stationId,
        brand: "Q8/F24",
        stationName: station.stationName,
        address: station.address,
        fuelType: product.productName,
        price: product.price,
        unit: product.unit,
        updatedAt: product.priceChangeDate,
        lat: station.latitude,
        lng: station.longitude,
      })),
    );
  }
  return groupByStation(rows);
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getStations() {
  const now = Date.now();
  if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
    return { stations: cachedData, fromCache: true };
  }
  const raw = await fetchQ8Prices();
  const stations = normalizeQ8Data(raw);
  cachedData = stations;
  cacheTime = Date.now();
  return { stations, fromCache: false };
}

app.get("/", (req, res) => res.json({ message: "Fuel proxy running" }));

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
  const { lat, lng, radius = 5 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }
  try {
    const { stations } = await getStations();
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxKm = parseFloat(radius);

    const nearby = stations
      .filter((s) => s.lat && s.lng)
      .map((s) => ({
        ...s,
        distanceKm: parseFloat(distanceKm(userLat, userLng, s.lat, s.lng).toFixed(2)),
      }))
      .filter((s) => s.distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);

    res.json({
      updatedAt: new Date(cacheTime).toISOString(),
      userLocation: { lat: userLat, lng: userLng },
      radiusKm: maxKm,
      count: nearby.length,
      stations: nearby,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch nearby", message: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + "s ago" : "not loaded",
    stationCount: cachedData?.length || 0,
  });
});

app.listen(PORT, () => {
  console.log(`Fuel proxy running on port ${PORT}`);
});
