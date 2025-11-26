// Interface pour les lectures de capteurs
export interface SensorReading {
  _id?: string;              // ID Kuzzle (optionnel)
  stationId: string;         // ID de la station
  timestamp: string;         // Date/heure ISO
  temperature: number;       // Température en °C
  humidity: number;          // Humidité en %
  airQuality: number;        // Indice qualité de l'air (0-500)
  co2: number;              // CO2 en ppm
  ph?: number;              // pH (optionnel)
  turbidity?: number;       // Turbidité (optionnel)
  dissolvedOxygen?: number; // Oxygène dissous (optionnel)
}

// Interface pour les statistiques
export interface ReadingStats {
  avgTemperature: number;
  avgHumidity: number;
  avgAirQuality: number;
  avgCo2: number;
  count: number;
}
