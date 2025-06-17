/* eslint-disable no-console */
/* eslint-disable sort-keys */
import { Kuzzle, WebSocket } from "kuzzle-sdk";
import { v4 as uuidv4 } from "uuid";

interface Station {
  _id: string;
  body: {
    name: string;
    location: { lat: number; lon: number };
    status: "active" | "inactive";
    type: "fixed" | "mobile";
    installedAt: string;
  };
}

interface Reading {
  _id: string;
  body: {
    stationId: string;
    timestamp: string;
    temperature: number;
    humidity: number;
    airQuality: number;
    co2: number;
  };
}

interface Alert {
  _id: string;
  body: {
    stationId: string;
    type: string;
    level: "warning" | "critical";
    message: string;
    timestamp: string;
  };
}

interface User {
  _id: string;
  body: {
    name: string;
    email: string;
    role: string;
    createdAt: string;
  };
}

interface Event {
  _id: string;
  body: {
    type: string;
    message: string;
    timestamp: string;
  };
}

const kuzzle = new Kuzzle(new WebSocket("localhost"));

const regions = [
  "Dakar",
  "Thiès",
  "Saint-Louis",
  "Ziguinchor",
  "Kaolack",
  "Louga",
  "Tambacounda",
  "Kolda",
  "Matam",
  "Fatick",
];

const regionCoords: Record<string, [number, number]> = {
  Dakar: [14.6928, -17.4467],
  Thiès: [14.7914, -16.9256],
  "Saint-Louis": [16.0179, -16.4896],
  Ziguinchor: [12.5833, -16.2667],
  Kaolack: [14.146, -16.0726],
  Louga: [15.6144, -16.2286],
  Tambacounda: [13.7699, -13.6673],
  Kolda: [12.8833, -14.95],
  Matam: [15.6559, -13.2559],
  Fatick: [14.3396, -16.4117],
};

async function createMappings() {
  const mappings: Record<string, any> = {
    stations: {
      mappings: {
        properties: {
          name: { type: "text" },
          location: { type: "geo_point" },
          status: { type: "keyword" },
          type: { type: "keyword" },
          installedAt: { type: "date" },
        },
      },
    },
    readings: {
      mappings: {
        properties: {
          stationId: { type: "keyword" },
          timestamp: { type: "date" },
          temperature: { type: "float" },
          humidity: { type: "float" },
          airQuality: { type: "float" },
          co2: { type: "float" },
        },
      },
    },
    alerts: {
      mappings: {
        properties: {
          stationId: { type: "keyword" },
          type: { type: "keyword" },
          message: { type: "text" },
          level: { type: "keyword" },
          timestamp: { type: "date" },
        },
      },
    },
    users: {
      mappings: {
        properties: {
          name: { type: "text" },
          email: { type: "keyword" },
          role: { type: "keyword" },
          createdAt: { type: "date" },
        },
      },
    },
    events: {
      mappings: {
        properties: {
          type: { type: "keyword" },
          message: { type: "text" },
          timestamp: { type: "date" },
        },
      },
    },
  };

  await kuzzle.index.create("iot");

  for (const [collection, def] of Object.entries(mappings)) {
    await kuzzle.collection.create("iot", collection, def);
    console.log(`✅ Collection '${collection}' créée.`);
  }
}

function createData() {
  const now = new Date();

  const stations: Station[] = regions.map((region, i) => {
    const [lat, lon] = regionCoords[region];
    return {
      _id: `station-${region.toLowerCase()}-${i}`,
      body: {
        name: `Station ${region} ${i}`,
        location: { lat, lon },
        status: Math.random() > 0.5 ? "active" : "inactive",
        type: Math.random() > 0.5 ? "fixed" : "mobile",
        installedAt: now.toISOString(),
      },
    };
  });

  const readings: Reading[] = stations.flatMap((station) =>
    Array.from({ length: 5 }).map((_, i) => {
      const date = new Date(now.getTime() - i * 15 * 60000);
      return {
        _id: uuidv4(),
        body: {
          stationId: station._id,
          timestamp: date.toISOString(),
          temperature: Number((Math.random() * 20 + 20).toFixed(2)),
          humidity: Number((Math.random() * 60 + 30).toFixed(2)),
          airQuality: Number((Math.random() * 500).toFixed(2)),
          co2: Number((Math.random() * 700 + 300).toFixed(2)),
        },
      };
    }),
  );

  const alerts: Alert[] = stations.flatMap((station) =>
    Array.from({ length: 2 }).map((_, i) => {
      const date = new Date(now.getTime() - i * 3600000);
      return {
        _id: uuidv4(),
        body: {
          stationId: station._id,
          type: "threshold_exceeded",
          level: Math.random() > 0.5 ? "warning" : "critical",
          message: "Valeur anormale détectée.",
          timestamp: date.toISOString(),
        },
      };
    }),
  );

  const users: User[] = Array.from({ length: 3 }).map((_, i) => ({
    _id: `user-${i + 1}`,
    body: {
      name: `Agent ${i + 1}`,
      email: `agent${i + 1}@ecostations.sn`,
      role: "agent",
      createdAt: now.toISOString(),
    },
  }));

  const events: Event[] = Array.from({ length: 5 }).map((_, i) => {
    const date = new Date(now.getTime() - i * 3600000);
    return {
      _id: uuidv4(),
      body: {
        type: ["system_start", "maintenance", "data_backup"][i % 3],
        message: "Événement système généré automatiquement.",
        timestamp: date.toISOString(),
      },
    };
  });

  return { stations, readings, alerts, users, events };
}

async function seed() {
  try {
    await kuzzle.connect();
    console.log("🔌 Connecté à Kuzzle");

    await createMappings();

    const { stations, readings, alerts, users, events } = createData();

    const bulkInsert = async (collection: string, docs: any[]) => {
      await kuzzle.document.mCreate("iot", collection, docs);
      console.log(`📦 ${docs.length} documents insérés dans '${collection}'`);
    };

    await bulkInsert("stations", stations);
    await bulkInsert("readings", readings);
    await bulkInsert("alerts", alerts);
    await bulkInsert("users", users);
    await bulkInsert("events", events);

    console.log("✅ Données injectées avec succès !");
    kuzzle.disconnect();
  } catch (error) {
    console.error("❌ Erreur:", error);
    kuzzle.disconnect();
  }
}

seed();
