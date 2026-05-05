import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchQ8Prices() {
  const response = await fetch("https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000");

  if (!response.ok) {
    throw new Error("Failed to fetch Q8 prices");
  }

  return response.json();
}

function normalizeQ8Data(rawData) {
  const stations = rawData?.data?.stationsPrices || [];

  return stations.flatMap((station) =>
    station.products.map((product) => ({
      stationId: station.stationId,
      brand: "Q8/F24",
      stationName: station.stationName || "Q8 Station",
      address: station.address || "Address not available",
      fuelType: product.productName,
      price: product.price,
      unit: product.unit,
      updatedAt: product.priceChangeDate,
    })),
  );
}

app.get("/", (req, res) => {
  res.json({
    message: "Fuel proxy running",
  });
});

app.get("/prices", async (req, res) => {
  try {
    const now = Date.now();

    if (cachedData && cacheTime && now - cacheTime < CACHE_DURATION) {
      return res.json({
        cached: true,
        updatedAt: new Date(cacheTime).toISOString(),
        source: "Q8/F24",
        data: cachedData,
      });
    }

    const q8Raw = await fetchQ8Prices();
    const normalized = normalizeQ8Data(q8Raw);

    cachedData = normalized;
    cacheTime = now;

    res.json({
      cached: false,
      updatedAt: new Date().toISOString(),
      source: "Q8/F24",
      data: normalized,
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not fetch fuel prices",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
