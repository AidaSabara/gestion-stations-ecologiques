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
interface MaintenanceIntervention {
  _id: string;
  body: {
    id_filtre: string;
    date_intervention: string;
    type_intervention: string;
    description: string;
    operateur: string;
    duree_minutes: number;
    cout_estimatif: number;
    impact_attendu: string;
    notes: string;
    statut: string;
    pieces_changees: string[];
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
    date: string | null;
    mois: string | null;
    temperature_c: number | null;
    ph: number | null;
    conductivite_us_cm: number | null;
    potentiel_redox_mv: number | null;
    dbo5_mg_l: number | null;
    dco_mg_l: number | null;
    mes_mg_l: number | null;
    mvs_pct: number | null;
    nitrates_mg_l: number | null;
    ammonium_mg_l: number | null;
    azote_total_mg_l: number | null;
    phosphates_mg_l: number | null;
    coliformes_fecaux_cfu_100ml: number | null;
    oeufs_helminthes: number | null;
    huiles_graisses: number | null;
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
    password: string;
    role: string;
    station_id: string;
    station_name: string;
    permissions: {
      canAccessAlerts: boolean;
      canAccessGraphs: boolean;
      canAccessFilters: boolean;
      canAccessData: boolean;
      canManageUsers: boolean;
    };
    phone: string;
    active: boolean;
    department: string;
    position: string;
    avatar?: string;
    createdAt: string;
    lastLogin: string | null;
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
interface CycleVie {
  _id: string;
  body: {
    id_filtre: string;
    id_station: string;
    etat_actuel: string;
    date_changement_etat: string;
    pourcentage_usure: number;
    heures_utilisation: number;
    volume_traite_m3: number;
    historique_etats: Array<{
      etat: string;
      date_debut: string;
      date_fin?: string;
      duree_jours: number;
      volume_traite: number;
      heures_utilisation: number;
    }>;
    metriques: {
      taux_usure_moyen: number;
      volume_moyen_par_jour: number;
      heures_moyennes_par_jour: number;
      efficacite_moyenne: number;
    };
    jalons: {
      mise_en_service: string;
      prochaine_maintenance: string;
      fin_vie_estimee: string;
      remplacement_prevu: string;
    };
  };
}
interface Filtre {
  _id: string;
  body: {
    idFiltre: string;
    idStation: string;
    nom: string;
    type: string;
    caracteristiques: {
      dureeVieMaxHeures: number;
      volumeMaxM3: number;
      dateInstallation: string;
      fabricant: string;
      modele: string;
    };
    suivi: {
      heuresActuelles: number;
      volumeActuelM3: number;
      dateDerniereMaintenance: string;
      nombreMaintenances: number;
    };
    etat: {
      pourcentageUsure: number;
      joursRestants: number;
      condition: string;
    };
    historiqueMaintenances: Array<{
      date: string;
      typeIntervention: string;
      technicien: string;
      notes: string;
    }>;
    actif: boolean;
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
    filtres: {
      mappings: {
        properties: {
          idFiltre: {
            type: "keyword"
          },
          idStation: {
            type: "keyword"
          },
          nom: {
            type: "text"
          },
          type: {
            type: "keyword"
          },
          caracteristiques: {
            properties: {
              dureeVieMaxHeures: {
                type: "integer"
              },
              volumeMaxM3: {
                type: "float"
              },
              dateInstallation: {
                type: "date",
                format: "yyyy-MM-dd"
              },
              fabricant: {
                type: "keyword"
              },
              modele: {
                type: "keyword"
              }
            }
          },
          suivi: {
            properties: {
              heuresActuelles: {
                type: "integer"
              },
              volumeActuelM3: {
                type: "float"
              },
              dateDerniereMaintenance: {
                type: "date",
                format: "yyyy-MM-dd"
              },
              nombreMaintenances: {
                type: "integer"
              }
            }
          },
          etat: {
            properties: {
              pourcentageUsure: {
                type: "float"
              },
              joursRestants: {
                type: "integer"
              },
              condition: {
                type: "keyword"
              }
            }
          },
          historiqueMaintenances: {
            type: "nested",
            properties: {
              date: {
                type: "date",
                format: "yyyy-MM-dd"
              },
              typeIntervention: {
                type: "keyword"
              },
              technicien: {
                type: "keyword"
              },
              notes: {
                type: "text"
              }
            }
          },
          actif: {
            type: "boolean"
          }
        }
      }
    },
     "cycle-vie": {  // Note: le nom de collection avec tiret
      mappings: {
        properties: {
          id_filtre: { "type": "keyword" },
          id_station: { "type": "keyword" },
          etat_actuel: { "type": "keyword" },
          date_changement_etat: { "type": "date" },
          pourcentage_usure: { "type": "float" },
          heures_utilisation: { "type": "integer" },
          volume_traite_m3: { "type": "float" },
          historique_etats: {
            "type": "nested",
            "properties": {
              etat: { "type": "keyword" },
              date_debut: { "type": "date" },
              date_fin: { "type": "date" },
              duree_jours: { "type": "integer" },
              volume_traite: { "type": "float" },
              heures_utilisation: { "type": "integer" }
            }
          },
          metriques: {
            "properties": {
              taux_usure_moyen: { "type": "float" },
              volume_moyen_par_jour: { "type": "float" },
              heures_moyennes_par_jour: { "type": "float" },
              efficacite_moyenne: { "type": "float" }
            }
          },
          jalons: {
            "properties": {
              mise_en_service: { "type": "date" },
              prochaine_maintenance: { "type": "date" },
              fin_vie_estimee: { "type": "date" },
              remplacement_prevu: { "type": "date" }
            }
          }
        }
      }
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
     maintenance_interventions: {
      mappings: {
        properties: {
          id_filtre: {
            type: "keyword"
          },
          date_intervention: {
            type: "date",
            format: "strict_date_optional_time||epoch_millis"
          },
          type_intervention: {
            type: "keyword"
          },
          description: {
            type: "text"
          },
          operateur: {
            type: "keyword"
          },
          duree_minutes: {
            type: "integer"
          },
          cout_estimatif: {
            type: "float"
          },
          impact_attendu: {
            type: "text"
          },
          notes: {
            type: "text"
          },
          statut: {
            type: "keyword"
          },
          pieces_changees: {
            type: "keyword"
          }
        }
      }
    },

     users: {
      mappings: {
        properties: {
          name: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword"
              }
            }
          },
          email: {
            type: "keyword"
          },
          password: {
            type: "keyword"
          },
          role: {
            type: "keyword"
          },
          station_id: {
            type: "keyword"
          },
          station_name: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword"
              }
            }
          },
          permissions: {
            type: "object",
            properties: {
              canAccessAlerts: {
                type: "boolean"
              },
              canAccessGraphs: {
                type: "boolean"
              },
              canAccessFilters: {
                type: "boolean"
              },
              canAccessData: {
                type: "boolean"
              },
              canManageUsers: {
                type: "boolean"
              }
            }
          },
          phone: {
            type: "keyword"
          },
          active: {
            type: "boolean"
          },
          createdAt: {
            type: "date",
            format: "strict_date_optional_time||epoch_millis||dd/MM/yyyy, HH:mm:ss"
          },
          lastLogin: {
            type: "date",
            format: "strict_date_optional_time||epoch_millis||dd/MM/yyyy, HH:mm:ss"
          },
          department: {
            type: "keyword"
          },
          position: {
            type: "text"
          },
          avatar: {
            type: "keyword"
          }
        }
      }
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
          date: { type: "date" },
          mois: { type: "keyword" },
          temperature_c: { type: "float" },
          ph: { type: "float" },
          conductivite_us_cm: { type: "float" },
          potentiel_redox_mv: { type: "float" },
          dbo5_mg_l: { type: "float" },
          dco_mg_l: { type: "float" },
          mes_mg_l: { type: "float" },
          mvs_pct: { type: "float" },
          nitrates_mg_l: { type: "float" },
          ammonium_mg_l: { type: "float" },
          azote_total_mg_l: { type: "float" },
          phosphates_mg_l: { type: "float" },
          coliformes_fecaux_cfu_100ml: { type: "float" },
          oeufs_helminthes: { type: "float" },
          huiles_graisses: { type: "float" },
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

function parseFloatOrNull(value: string): number | null {
  if (!value || value.trim() === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1';
}

async function readAndInsertCSV(filePath: string) {
  const readings: WaterQualityReading[] = [];
  
  return new Promise<WaterQualityReading[]>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' }))
      .on('data', (data) => {
        try {
          const rawDate = data.Date || data.date;
          const rawMois = data.Mois || data.mois;
          
          const reading: WaterQualityReading = {
            _id: uuidv4(),
            body: {
              id_station: data.ID_Station || data.id_station || 'Sanar_Station',
              phase: data.Phase || data.phase || '',
              type_filtre: data.Type_Filtre || data.type_filtre || '',
              id_filtre: data.ID_Filtre || data.id_filtre || '',
              
              date: rawDate || null,
              mois: rawMois || null,
              
              temperature_c: parseFloatOrNull(data.Temperature_C || data.temperature_c),
              ph: parseFloatOrNull(data.pH || data.ph),
              conductivite_us_cm: parseFloatOrNull(data.Conductivite_uS_cm || data.conductivite_us_cm),
              potentiel_redox_mv: parseFloatOrNull(data.Potentiel_Redox_mV || data.potentiel_redox_mv),
              
              dbo5_mg_l: parseFloatOrNull(data.DBO5_mg_L || data.dbo5_mg_l),
              dco_mg_l: parseFloatOrNull(data.DCO_mg_L || data.dco_mg_l),
              mes_mg_l: parseFloatOrNull(data.MES_mg_L || data.mes_mg_l),
              mvs_pct: parseFloatOrNull(data.MVS_pct || data.mvs_pct),
              
              nitrates_mg_l: parseFloatOrNull(data.Nitrates_mg_L || data.nitrates_mg_l),
              ammonium_mg_l: parseFloatOrNull(data.Ammonium_mg_L || data.ammonium_mg_l),
              azote_total_mg_l: parseFloatOrNull(data.Azote_Total_mg_L || data.azote_total_mg_l),
              phosphates_mg_l: parseFloatOrNull(data.Phosphates_mg_L || data.phosphates_mg_l),
              
              coliformes_fecaux_cfu_100ml: parseFloatOrNull(data.Coliformes_Fecaux_CFU_100ml || data.coliformes_fecaux_cfu_100ml),
              oeufs_helminthes: parseFloatOrNull(data.Oeufs_Helminthes || data.oeufs_helminthes),
              huiles_graisses: parseFloatOrNull(data.Huiles_Graisses || data.huiles_graisses),
              
              nom_feuille: data.Nom_Feuille || data.nom_feuille || '',
              contient_valeurs_estimees: parseBoolean(data.Contient_Valeurs_Estimees || data.contient_valeurs_estimees),
            },
          };
          
          readings.push(reading);
        } catch (error) {
          console.error('❌ Erreur lors du parsing d\'une ligne:', error, data);
        }
      })
      .on('end', () => {
        // Statistiques sur les dates
        const withDates = readings.filter(r => r.body.date !== null).length;
        const withoutDates = readings.filter(r => r.body.date === null).length;
        
        console.log(`✅ ${readings.length} documents de qualité d'eau préparés`);
        console.log(`📅 ${withDates} avec dates, ${withoutDates} sans dates`);
        
        if (withDates > 0) {
          const dates = readings.filter(r => r.body.date).map(r => r.body.date);
          const uniqueDates = [...new Set(dates)].sort();
          console.log(`📊 Période couverte: ${uniqueDates[0]} à ${uniqueDates[uniqueDates.length - 1]}`);
        }
        
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
  const filtres: Filtre[] = [
    {
      _id: "filtre-flt-roseau-001",
      body: {
        idFiltre: "FLT-ROSEAU-001",
        idStation: "station-saint-louis-1764092258261",
        nom: "Filtre à roseau principal - Zone A",
        type: "roseau",
        caracteristiques: {
          dureeVieMaxHeures: 87600,
          volumeMaxM3: 50000,
          dateInstallation: "2020-03-15",
          fabricant: "EcoFilter Systems",
          modele: "Reed-Bed-300"
        },
        suivi: {
          heuresActuelles: 35040,
          volumeActuelM3: 21500.5,
          dateDerniereMaintenance: "2025-10-15",
          nombreMaintenances: 8
        },
        etat: {
          pourcentageUsure: 40,
          joursRestants: 912,
          condition: "bon"
        },
        historiqueMaintenances: [
          {
            date: "2025-10-15",
            typeIntervention: "nettoyage",
            technicien: "Penda Diop",
            notes: "Nettoyage des roseaux, élimination des débris accumulés"
          },
          {
            date: "2025-07-20",
            typeIntervention: "inspection",
            technicien: "Khalifa LO",
            notes: "Inspection visuelle, remplacement de 5% des plants de roseaux"
          }
        ],
        actif: true
      }
    },
    {
      _id: "filtre-flt-vetiver-002",
      body: {
        idFiltre: "FLT-VETIVER-002",
        idStation: "station-saint-louis-1764092258261",
        nom: "Filtre vétiver secondaire",
        type: "vetiver",
        caracteristiques: {
          dureeVieMaxHeures: 70080,
          volumeMaxM3: 35000,
          dateInstallation: "2021-06-10",
          fabricant: "GreenWater Tech",
          modele: "Vetiver-Pro-250"
        },
        suivi: {
          heuresActuelles: 28800,
          volumeActuelM3: 15750.3,
          dateDerniereMaintenance: "2025-11-01",
          nombreMaintenances: 6
        },
        etat: {
          pourcentageUsure: 41.1,
          joursRestants: 708,
          condition: "bon"
        },
        historiqueMaintenances: [
          {
            date: "2025-11-01",
            typeIntervention: "entretien",
            technicien: "Djily Gueye",
            notes: "Taille des racines, ajout de nutriments"
          },
          {
            date: "2025-08-15",
            typeIntervention: "nettoyage",
            technicien: "Mbagnick Sarr",
            notes: "Nettoyage complet du système racinaire"
          }
        ],
        actif: true
      }
    },
    {
      _id: "filtre-flt-sable-003",
      body: {
        idFiltre: "FLT-SABLE-003",
        idStation: "station-dakar-1764101019818",
        nom: "Filtre à sable rapide",
        type: "sable",
        caracteristiques: {
          dureeVieMaxHeures: 43800,
          volumeMaxM3: 80000,
          dateInstallation: "2019-09-25",
          fabricant: "AquaPur Industries",
          modele: "SandFilter-500"
        },
        suivi: {
          heuresActuelles: 38500,
          volumeActuelM3: 72300.8,
          dateDerniereMaintenance: "2025-10-28",
          nombreMaintenances: 15
        },
        etat: {
          pourcentageUsure: 87.9,
          joursRestants: 91,
          condition: "critique"
        },
        historiqueMaintenances: [
          {
            date: "2025-10-28",
            typeIntervention: "remplacement_partiel",
            technicien: "Pape Mor Diop",
            notes: "Remplacement de 30% du sable filtrant, colmatage important détecté"
          },
          {
            date: "2025-09-10",
            typeIntervention: "retrolavage",
            technicien: "Khalifa LO",
            notes: "Rétrolavage complet, pression normalisée"
          }
        ],
        actif: true
      }
    },
    {
      _id: "filtre-flt-coco-004",
      body: {
        idFiltre: "FLT-COCO-004",
        idStation: "station-dakar-0",
        nom: "Filtre fibre de coco biologique",
        type: "coco",
        caracteristiques: {
          dureeVieMaxHeures: 26280,
          volumeMaxM3: 25000,
          dateInstallation: "2023-02-18",
          fabricant: "BioFilter Co",
          modele: "CocoFiber-200"
        },
        suivi: {
          heuresActuelles: 8760,
          volumeActuelM3: 8500.2,
          dateDerniereMaintenance: "2025-11-10",
          nombreMaintenances: 3
        },
        etat: {
          pourcentageUsure: 33.3,
          joursRestants: 730,
          condition: "excellent"
        },
        historiqueMaintenances: [
          {
            date: "2025-11-10",
            typeIntervention: "inspection",
            technicien: "ALi Ba",
            notes: "Contrôle qualité, fibres en bon état, capacité de filtration optimale"
          },
          {
            date: "2025-05-22",
            typeIntervention: "nettoyage",
            technicien: "Bachir Diallo",
            notes: "Nettoyage léger, pas de problème détecté"
          }
        ],
        actif: true
      }
    },
    {
      _id: "filtre-flt-gravier-005",
      body: {
        idFiltre: "FLT-GRAVIER-005",
        idStation: "station-dakar-1764101019818",
        nom: "Filtre gravier multicouche",
        type: "gravier",
        caracteristiques: {
          dureeVieMaxHeures: 131400,
          volumeMaxM3: 120000,
          dateInstallation: "2018-11-05",
          fabricant: "HydroStone Systems",
          modele: "GravelMax-700"
        },
        suivi: {
          heuresActuelles: 52560,
          volumeActuelM3: 48200.5,
          dateDerniereMaintenance: "2025-09-30",
          nombreMaintenances: 12
        },
        etat: {
          pourcentageUsure: 40,
          joursRestants: 1314,
          condition: "moyen"
        },
        historiqueMaintenances: [
          {
            date: "2025-09-30",
            typeIntervention: "nettoyage_profond",
            technicien: "Mbagnick Sarr",
            notes: "Nettoyage haute pression, réarrangement des couches de gravier"
          },
          {
            date: "2025-06-12",
            typeIntervention: "remplacement_partiel",
            technicien: "Isabelle Vincent",
            notes: "Remplacement de la couche fine (granulométrie < 5mm)"
          },
          {
            date: "2025-03-08",
            typeIntervention: "inspection",
            technicien: "Djily Gueye",
            notes: "Inspection complète, début de colmatage en couche supérieure"
          }
        ],
        actif: true
      }
    },
    {
      _id: "filtre-flt-sable-099",
      body: {
        idFiltre: "FLT-SABLE-099",
        idStation: "station-saint-louis-1764092258261",
        nom: "Ancien filtre à sable (hors service)",
        type: "sable",
        caracteristiques: {
          dureeVieMaxHeures: 43800,
          volumeMaxM3: 75000,
          dateInstallation: "2015-04-12",
          fabricant: "AquaPur Industries",
          modele: "SandFilter-450"
        },
        suivi: {
          heuresActuelles: 43800,
          volumeActuelM3: 75000,
          dateDerniereMaintenance: "2024-12-20",
          nombreMaintenances: 22
        },
        etat: {
          pourcentageUsure: 100,
          joursRestants: 0,
          condition: "remplace"
        },
        historiqueMaintenances: [
          {
            date: "2024-12-20",
            typeIntervention: "mise_hors_service",
            technicien: "Khalifa Lo",
            notes: "Fin de vie atteinte, filtre remplacé par FLT-SABLE-003"
          }
        ],
        actif: false
      }
    }
  ];
  const maintenanceInterventions: MaintenanceIntervention[] = [
    {
      _id: "intervention-fh-20240312",
      body: {
        id_filtre: "FH",
        date_intervention: "2024-03-12T07:30:00.000Z",
        type_intervention: "Action corrective",
        description: "Colmatage sévère du filtre horizontal - débouchage d'urgence",
        operateur: "Moussa Faye",
        duree_minutes: 180,
        cout_estimatif: 25000,
        impact_attendu: "Restauration du débit nominal",
        notes: "Colmatage causé par accumulation de matières grasses. Recommandation: prétraitement renforcé.",
        statut: "Terminé",
        pieces_changees: ["Pompe de débouchage haute pression"]
      }
    },
    {
      _id: "intervention-general-20240301",
      body: {
        id_filtre: "General",
        date_intervention: "2024-03-01T16:00:00.000Z",
        type_intervention: "Débit ajusté",
        description: "Réduction du débit de 15 m³/j à 12 m³/j pour augmenter temps de contact",
        operateur: "Cheikh Sy",
        duree_minutes: 30,
        cout_estimatif: 0,
        impact_attendu: "Amélioration DBO5 et MES de 10-15%",
        notes: "Débit trop élevé réduisait l'efficacité du traitement biologique",
        statut: "Terminé",
        pieces_changees: []
      }
    },
    {
      _id: "intervention-fv2-20240210",
      body: {
        id_filtre: "FV2",
        date_intervention: "2024-02-10T09:00:00.000Z",
        type_intervention: "Ajout de plantes",
        description: "Plantation de roseaux (Phragmites australis) pour améliorer la nitrification",
        operateur: "Aminata Ndiaye",
        duree_minutes: 90,
        cout_estimatif: 12000,
        impact_attendu: "Réduction de 30% des nitrates par absorption racinaire",
        notes: "50 plants espacés de 30cm. Zone humide préparée avec substrat enrichi.",
        statut: "Terminé",
        pieces_changees: ["Phragmites australis (50 plants)"]
      }
    },
    {
      _id: "intervention-general-20240305",
      body: {
        id_filtre: "General",
        date_intervention: "2024-03-05T11:00:00.000Z",
        type_intervention: "Problème capteur",
        description: "Remplacement du capteur de pH défectueux donnant des valeurs erratiques",
        operateur: "Ousmane Ba",
        duree_minutes: 45,
        cout_estimatif: 35000,
        impact_attendu: "Mesures pH fiables pour pilotage du traitement",
        notes: "Capteur montrait pH 12 alors que réel = 7.2. Probable oxydation des électrodes.",
        statut: "Terminé",
        pieces_changees: ["Sonde pH HI98128", "Câble d'extension"]
      }
    },
    {
      _id: "intervention-fh-20240220",
      body: {
        id_filtre: "FH",
        date_intervention: "2024-02-20T14:30:00.000Z",
        type_intervention: "Nettoyage",
        description: "Nettoyage manuel des canaux horizontaux et retrait des boues accumulées",
        operateur: "Ibrahima Sarr",
        duree_minutes: 120,
        cout_estimatif: 15000,
        impact_attendu: "Amélioration du débit et réduction des coliformes",
        notes: "Accumulation de 5cm de boues dans le fond du filtre",
        statut: "Terminé",
        pieces_changees: []
      }
    },
    {
      _id: "intervention-fv1-20240115",
      body: {
        id_filtre: "FV1",
        date_intervention: "2024-01-15T08:00:00.000Z",
        type_intervention: "Changement de substrat",
        description: "Remplacement du substrat de filtration vertical saturé",
        operateur: "Mamadou Diallo",
        duree_minutes: 240,
        cout_estimatif: 85000,
        impact_attendu: "Restauration complète de la capacité de filtration",
        notes: "Substrat colmaté après 6 mois d'utilisation intensive. Présence de biofilm épais.",
        statut: "Terminé",
        pieces_changees: ["Sable 0.3-0.8mm", "Gravier 5-10mm", "Membrane géotextile"]
      }
    }
  ];

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

const users: User[] = [
    {
      _id: "user-coudy-daillo",
      body: {
        name: "Coudy Daillo",
        email: "samb.aida-sabara@ugb.edu.sn",
        password: "super123",
        role: "supervisor",
        station_id: "ALL",
        station_name: "Toutes les stations",
        permissions: {
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: true,
          canAccessData: true,
          canManageUsers: true
        },
        phone: "+221 77 999 00 00",
        active: true,
        department: "IT",
        position: "Administrateur Principal",
        createdAt: "01/01/2025, 00:00:00",
        lastLogin: null
      }
    },
    {
      _id: "user-aida-sabara",
      body: {
        name: "Aida Sabara",
        email: "aidasabara1111@gmail.com",
        password: "admin123",
        role: "admin",
        station_id: "ALL",
        station_name: "Toutes les stations",
        permissions: {
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: true,
          canAccessData: true,
          canManageUsers: true
        },
        phone: "+221 634 22 57",
        active: true,
        department: "IT",
        position: "Administrateur Principal",
        createdAt: "01/01/2025, 00:00:00",
        lastLogin: "25/11/2025, 18:31:08"
      }
    },
    {
      _id: "user-aida-samb",
      body: {
        name: "Aida Samb",
        email: "mamadou.diallo@ecostations.sn",
        password: "demo123",
        role: "agent",
        station_id: "Sanar_Station",
        station_name: "Station Sanar",
        permissions: {
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: true,
          canAccessData: true,
          canManageUsers: false
        },
        phone: "+221 77 634 22 57",
        active: true,
        department: "Exploitation",
        position: "Agent de Traitement des Eaux",
        createdAt: "10/01/2025, 01:09:32",
        lastLogin: null
      }
    }
  ];

const cyclesVie: CycleVie[] = [
    {
      _id: "cycle-vie-flt-roseau-001",
      body: {
        id_filtre: "FLT-ROSEAU-001",
        id_station: "station-saint-louis-1764092258261",
        etat_actuel: "bon",
        date_changement_etat: "2025-10-15",
        pourcentage_usure: 40,
        heures_utilisation: 35040,
        volume_traite_m3: 21500.5,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2020-03-15",
            date_fin: "2023-03-15",
            duree_jours: 1095,
            volume_traite: 12000,
            heures_utilisation: 13140
          },
          {
            etat: "bon",
            date_debut: "2023-03-15",
            date_fin: "2025-10-15",
            duree_jours: 945,
            volume_traite: 9500.5,
            heures_utilisation: 21900
          }
        ],
        metriques: {
          taux_usure_moyen: 1.2,
          volume_moyen_par_jour: 12.5,
          heures_moyennes_par_jour: 8.2,
          efficacite_moyenne: 92.5
        },
        jalons: {
          mise_en_service: "2020-03-15",
          prochaine_maintenance: "2026-01-15",
          fin_vie_estimee: "2030-03-15",
          remplacement_prevu: "2030-03-15"
        }
      }
    },
    {
      _id: "cycle-vie-flt-vetiver-002",
      body: {
        id_filtre: "FLT-VETIVER-002",
        id_station: "station-saint-louis-1764092258261",
        etat_actuel: "bon",
        date_changement_etat: "2025-11-01",
        pourcentage_usure: 41.1,
        heures_utilisation: 28800,
        volume_traite_m3: 15750.3,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2021-06-10",
            date_fin: "2024-06-10",
            duree_jours: 1096,
            volume_traite: 8500,
            heures_utilisation: 13152
          },
          {
            etat: "bon",
            date_debut: "2024-06-10",
            date_fin: "2025-11-01",
            duree_jours: 510,
            volume_traite: 7250.3,
            heures_utilisation: 15648
          }
        ],
        metriques: {
          taux_usure_moyen: 1.3,
          volume_moyen_par_jour: 10.8,
          heures_moyennes_par_jour: 7.9,
          efficacite_moyenne: 88.7
        },
        jalons: {
          mise_en_service: "2021-06-10",
          prochaine_maintenance: "2026-02-01",
          fin_vie_estimee: "2029-06-10",
          remplacement_prevu: "2029-06-10"
        }
      }
    },
    {
      _id: "cycle-vie-flt-sable-003",
      body: {
        id_filtre: "FLT-SABLE-003",
        id_station: "station-dakar-1764101019818",
        etat_actuel: "critique",
        date_changement_etat: "2025-10-28",
        pourcentage_usure: 87.9,
        heures_utilisation: 38500,
        volume_traite_m3: 72300.8,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2019-09-25",
            date_fin: "2022-09-25",
            duree_jours: 1095,
            volume_traite: 28000,
            heures_utilisation: 13140
          },
          {
            etat: "moyen",
            date_debut: "2022-09-25",
            date_fin: "2024-09-25",
            duree_jours: 730,
            volume_traite: 25000,
            heures_utilisation: 17520
          },
          {
            etat: "critique",
            date_debut: "2024-09-25",
            date_fin: "2025-10-28",
            duree_jours: 398,
            volume_traite: 19300.8,
            heures_utilisation: 7840
          }
        ],
        metriques: {
          taux_usure_moyen: 3.8,
          volume_moyen_par_jour: 35.2,
          heures_moyennes_par_jour: 10.5,
          efficacite_moyenne: 76.3
        },
        jalons: {
          mise_en_service: "2019-09-25",
          prochaine_maintenance: "2025-11-15",
          fin_vie_estimee: "2025-12-31",
          remplacement_prevu: "2026-01-15"
        }
      }
    },
    {
      _id: "cycle-vie-flt-coco-004",
      body: {
        id_filtre: "FLT-COCO-004",
        id_station: "station-dakar-0",
        etat_actuel: "excellent",
        date_changement_etat: "2025-11-10",
        pourcentage_usure: 33.3,
        heures_utilisation: 8760,
        volume_traite_m3: 8500.2,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2023-02-18",
            date_fin: "2025-11-10",
            duree_jours: 996,
            volume_traite: 8500.2,
            heures_utilisation: 8760
          }
        ],
        metriques: {
          taux_usure_moyen: 0.9,
          volume_moyen_par_jour: 8.5,
          heures_moyennes_par_jour: 8.8,
          efficacite_moyenne: 95.2
        },
        jalons: {
          mise_en_service: "2023-02-18",
          prochaine_maintenance: "2026-05-18",
          fin_vie_estimee: "2028-02-18",
          remplacement_prevu: "2028-02-18"
        }
      }
    },
    {
      _id: "cycle-vie-flt-gravier-005",
      body: {
        id_filtre: "FLT-GRAVIER-005",
        id_station: "station-dakar-1764101019818",
        etat_actuel: "moyen",
        date_changement_etat: "2025-09-30",
        pourcentage_usure: 40,
        heures_utilisation: 52560,
        volume_traite_m3: 48200.5,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2018-11-05",
            date_fin: "2021-11-05",
            duree_jours: 1095,
            volume_traite: 18000,
            heures_utilisation: 13140
          },
          {
            etat: "bon",
            date_debut: "2021-11-05",
            date_fin: "2023-11-05",
            duree_jours: 730,
            volume_traite: 15000,
            heures_utilisation: 17520
          },
          {
            etat: "moyen",
            date_debut: "2023-11-05",
            date_fin: "2025-09-30",
            duree_jours: 695,
            volume_traite: 15200.5,
            heures_utilisation: 21900
          }
        ],
        metriques: {
          taux_usure_moyen: 1.1,
          volume_moyen_par_jour: 18.3,
          heures_moyennes_par_jour: 9.8,
          efficacite_moyenne: 85.7
        },
        jalons: {
          mise_en_service: "2018-11-05",
          prochaine_maintenance: "2026-03-30",
          fin_vie_estimee: "2032-11-05",
          remplacement_prevu: "2032-11-05"
        }
      }
    },
    {
      _id: "cycle-vie-flt-sable-099",
      body: {
        id_filtre: "FLT-SABLE-099",
        id_station: "station-saint-louis-1764092258261",
        etat_actuel: "hors_service",
        date_changement_etat: "2024-12-20",
        pourcentage_usure: 100,
        heures_utilisation: 43800,
        volume_traite_m3: 75000,
        historique_etats: [
          {
            etat: "excellent",
            date_debut: "2015-04-12",
            date_fin: "2018-04-12",
            duree_jours: 1095,
            volume_traite: 25000,
            heures_utilisation: 13140
          },
          {
            etat: "bon",
            date_debut: "2018-04-12",
            date_fin: "2021-04-12",
            duree_jours: 1095,
            volume_traite: 25000,
            heures_utilisation: 13140
          },
          {
            etat: "moyen",
            date_debut: "2021-04-12",
            date_fin: "2023-04-12",
            duree_jours: 730,
            volume_traite: 15000,
            heures_utilisation: 8760
          },
          {
            etat: "critique",
            date_debut: "2023-04-12",
            date_fin: "2024-12-20",
            duree_jours: 618,
            volume_traite: 10000,
            heures_utilisation: 8760
          },
          {
            etat: "hors_service",
            date_debut: "2024-12-20",
            duree_jours: 341,
            volume_traite: 0,
            heures_utilisation: 0
          }
        ],
        metriques: {
          taux_usure_moyen: 2.4,
          volume_moyen_par_jour: 22.8,
          heures_moyennes_par_jour: 10.0,
          efficacite_moyenne: 82.1
        },
        jalons: {
          mise_en_service: "2015-04-12",
          prochaine_maintenance: "N/A",
          fin_vie_estimee: "2024-12-20",
          remplacement_prevu: "2024-12-20"
        }
      }
    }
  ];

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

  return { stations, readings, alerts, users, events, filtres, cyclesVie, maintenanceInterventions };
}

async function bulkInsert(collection: string, docs: any[]) {
  if (docs.length === 0) {
    console.log(`⚠️ Aucun document à insérer dans '${collection}'`);
    return;
  }
  
  try {
    await kuzzle.document.mCreate("iot", collection, docs);
    console.log(`📦 ${docs.length} documents insérés dans '${collection}'`);
  } catch (error) {
    console.error(`❌ Erreur lors de l'insertion dans '${collection}':`, error);
    throw error;
  }
}

async function seed() {
  try {
    await kuzzle.connect();
    console.log("🔌 Connecté à Kuzzle");

    await createMappings();

    const { stations, readings, alerts, users, events, filtres, cyclesVie, maintenanceInterventions } = createData();
    
    // Utiliser le nouveau fichier avec les dates
    const csvFilePath = path.join(__dirname, "..", "cleaning_water", "UGB_Sanar_Station_Dataset_Clean.csv");
    
    console.log(`📁 Lecture du fichier: ${csvFilePath}`);
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`❌ Fichier CSV introuvable: ${csvFilePath}`);
    }

    const waterQualityData = await readAndInsertCSV(csvFilePath);

    // Insérer toutes les données
    await bulkInsert("stations", stations);
    await bulkInsert("readings", readings);
    await bulkInsert("alerts", alerts);
    await bulkInsert("users", users);
    await bulkInsert("events", events);
    await bulkInsert("filtres", filtres);
    await bulkInsert("cycle-vie", cyclesVie);
    await bulkInsert("maintenance_interventions", maintenanceInterventions);
    
    // Insérer les données de qualité de l'eau avec dates réelles
    await bulkInsert("water_quality", waterQualityData);

    console.log("🎉 Toutes les données injectées avec succès !");
    console.log(`🌊 ${waterQualityData.length} mesures de qualité d'eau importées`);
    console.log(`👥 ${users.length} utilisateurs seedés`);
    console.log(`🔧 ${filtres.length} filtres seedés (${filtres.filter(f => f.body.actif).length} actifs, ${filtres.filter(f => !f.body.actif).length} inactifs)`);
    console.log(`📊 ${cyclesVie.length} cycles de vie seedés`);
    console.log(`🔧 ${maintenanceInterventions.length} interventions de maintenance seedées`);
    
    kuzzle.disconnect();
    console.log("🔌 Déconnecté de Kuzzle");
  } catch (error) {
    console.error("❌ Erreur lors du seed:", error);
    kuzzle.disconnect();
    process.exit(1);
  }
}

seed();