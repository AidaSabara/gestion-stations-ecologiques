#!/bin/bash

# Script pour simuler une passerelle IoT qui envoie des données
# Usage: ./test-sensor.sh

API_URL="http://localhost:8080/api/sensors"


echo "🚀 Simulation d'envoi de données depuis une passerelle IoT"
echo "=================================================="

# Test 1: Injection capteur unique
echo ""
echo "📡 Test 1: Injection capteur unique"
curl -X POST "${API_URL}/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "station-dakar-0",
    "temperature": 25.3,
    "humidity": 68.5,
    "airQuality": 145,
    "co2": 425,
    "ph": 7.2,
    "turbidity": 12.5,
    "dissolvedOxygen": 8.3
  }' | jq '.'

sleep 2

# Test 2: Injection batch (plusieurs capteurs)
echo ""
echo "📡 Test 2: Injection batch (3 capteurs)"
curl -X POST "${API_URL}/ingest/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "sensors": [
      {
        "stationId": "station-dakar-0",
        "temperature": 24.5,
        "humidity": 65.2,
        "ph": 7.1
      },
      {
        "stationId": "station-thies-1",
        "temperature": 26.3,
        "humidity": 70.8,
        "ph": 7.4
      },
      {
        "stationId": "station-saint-louis-2",
        "temperature": 23.8,
        "humidity": 62.5,
        "ph": 7.0
      }
    ]
  }' | jq '.'

sleep 2

# Test 3: Récupérer les statistiques
echo ""
echo "📊 Test 3: Statistiques"
curl -X GET "${API_URL}/stats" | jq '.'

echo ""
echo "✅ Tests terminés !"