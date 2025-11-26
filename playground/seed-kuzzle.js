/* eslint-disable no-console */
/* eslint-disable sort-keys */
import { Kuzzle, WebSocket } from "kuzzle-sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

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

interface WaterQualityReading {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre: string;
    id_filtre: string;
    ph: number;
    potentiel_redox_mv: number;
    dbo5_mg_l: number;
    dco_mg_l: number;
    mes_mg_l: number;
    nitrates_mg_l: number;
    ammonium_mg_l: number;
    azote_total_mg_l: number;
    phosphates_mg_l: number;
    coliformes_fecaux_cfu_100ml: number;
    nom_feuille: string;
    contient_valeurs_estimees: boolean;
  };
}

interface Alert {
  _id: string;
  body: {
    stationId: string;
    type: "seuil dépassé" | "défaillance d'équipement" | "maintenance_requise";
    level: "info" | "warning" | "critical";
    message: string;
    parameter?: string; 
    value?: number;     
    threshold?: number;
    timestamp: string;
    resolved?: boolean; 
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
  "Dakar": [14.6928, -17.4467],
  "Thiès": [14.7914, -16.9256],
  "Saint-Louis": [16.0179, -16.4896],
  "Ziguinchor": [12.5833, -16.2667],
  "Kaolack": [14.146, -16.0726],
  "Louga": [15.6144, -16.2286],
  "Tambacounda": [13.7699, -13.6673],
  "Kolda": [12.8833, -14.95],
  "Matam": [15.6559, -13.2559],
  "Fatick": [14.3396, -16.4117],
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
    water_quality: {
      mappings: {
        properties: {
          id_station: { type: "keyword" },
          phase: { type: "keyword" },
          type_filtre: { type: "keyword" },
          id_filtre: { type: "keyword" },
          ph: { type: "float" },
          potentiel_redox_mv: { type: "float" },
          dbo5_mg_l: { type: "float" },
          dco_mg_l: { type: "float" },
          mes_mg_l: { type: "float" },
          nitrates_mg_l: { type: "float" },
          ammonium_mg_l: { type: "float" },
          azote_total_mg_l: { type: "float" },
          phosphates_mg_l: { type: "float" },
          coliformes_fecaux_cfu_100ml: { type: "float" },
          nom_feuille: { type: "keyword" },
          contient_valeurs_estimees: { type: "boolean" },
        },
      },
    },
  };

  try {
    const indexExists = await kuzzle.index.exists("iot");
    if (!indexExists) {
      await kuzzle.index.create("iot");
      console.log("✅ Index 'iot' créé.");
    } else {
      console.log("▶️ L'index 'iot' existe déjà.");
    }

    for (const [collection, def] of Object.entries(mappings)) {
      const collectionExists = await kuzzle.collection.exists("iot", collection);
      if (!collectionExists) {
        await kuzzle.collection.create("iot", collection, def);
        console.log(`✅ Collection '${collection}' créée.`);
      } else {
        console.log(`▶️ La collection '${collection}' existe déjà.`);
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création des mappings:", error);
    throw error;
  }
}

async function readAndInsertCSV(filePath: string) {
  const readings: WaterQualityReading[] = [];
  return new Promise<WaterQualityReading[]>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' }))
      .on('data', (data) => {
        // 🔹 SUPPRIMER les champs indésirables
        const { tel, telephone, tél, ...cleanData } = data;

        // TRANSFORMER les données selon le schéma WaterQualityReading
        const reading: WaterQualityReading = {
          _id: uuidv4(),
          body: {
            // Métadonnées
            id_station: cleanData.id_station,
            phase: cleanData.phase,
            type_filtre: cleanData.type_filtre,
            id_filtre: cleanData.id_filtre,
            nom_feuille: cleanData.nom_feuille,
            contient_valeurs_estimees: cleanData.contient_valeurs_estimees === "True",
            
            // Paramètres physico-chimiques
            ph: cleanData.ph ? parseFloat(cleanData.ph) : null,
            potentiel_redox_mv: cleanData.potentiel_redox_mv ? parseFloat(cleanData.potentiel_redox_mv) : null,
            dbo5_mg_l: cleanData.dbo5_mg_l ? parseFloat(cleanData.dbo5_mg_l) : null,
            dco_mg_l: cleanData.dco_mg_l ? parseFloat(cleanData.dco_mg_l) : null,
            mes_mg_l: cleanData.mes_mg_l ? parseFloat(cleanData.mes_mg_l) : null,
            
            // Paramètres azotés et phosphorés
            nitrates_mg_l: cleanData.nitrates_mg_l ? parseFloat(cleanData.nitrates_mg_l) : null,
            ammonium_mg_l: cleanData.ammonium_mg_l ? parseFloat(cleanData.ammonium_mg_l) : null,
            azote_total_mg_l: cleanData.azote_total_mg_l ? parseFloat(cleanData.azote_total_mg_l) : null,
            phosphates_mg_l: cleanData.phosphates_mg_l ? parseFloat(cleanData.phosphates_mg_l) : null,
            
            // Paramètre microbiologique
            coliformes_fecaux_cfu_100ml: cleanData.coliformes_fecaux_cfu_100ml ? parseFloat(cleanData.coliformes_fecaux_cfu_100ml) : null,
          },
        };
        
        readings.push(reading);
      })
      .on('end', () => {
        console.log(`✅ ${readings.length} documents préparés (sans champ 'tel')`);
        resolve(readings);
      })
      .on('error', (error) => {
        console.error('❌ Erreur lecture CSV:', error);
        reject(error);
      });
  });
}

function createData() {
  const now = new Date();

  const stations: Station[] = regions.map((region, i) => {
    const coords = regionCoords[region];
    if (!coords) {
      console.error(`❌ Coordonnées manquantes pour la région: ${region}`);
      throw new Error(`Coordonnées manquantes pour: ${region}`);
    }
    const [lat, lon] = coords;
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
          type: "seuil dépassé",
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
    
    const csvFilePath = path.join(__dirname, "..", "cleaning_water", "UGB_Sanar_Station_Final.csv");
    const waterQualityData = await readAndInsertCSV(csvFilePath);

    const bulkInsert = async (collection: string, docs: any[]) => {
      await kuzzle.document.mCreate("iot", collection, docs);
      console.log(`📦 ${docs.length} documents insérés dans '${collection}'`);
    };

    await bulkInsert("stations", stations);
    await bulkInsert("readings", readings);
    await bulkInsert("alerts", alerts);
    await bulkInsert("users", users);
    await bulkInsert("events", events);
    
    // Insérez vos données de qualité de l'eau ici
    await bulkInsert("water_quality", waterQualityData);

    console.log("✅ Données injectées avec succès !");
    kuzzle.disconnect();
  } catch (error) {
    console.error("❌ Erreur:", error);
    kuzzle.disconnect();
  }
}

seed();