#!/bin/bash

echo "🔧 Initialisation des collections Kuzzle pour l'index 'iot'..."

# Créer l'index
kourou index:create iot --silent

# stations
kourou collection:create iot stations '{
  mappings: {
    properties: {
      name: { type: "text" },
      location: { type: "geo_point" },
      status: { type: "keyword" },
      type: { type: "keyword" },
      installedAt: { type: "date" }
    }
  }
}' --silent

# readings
kourou collection:create iot readings '{
  mappings: {
    properties: {
      stationId: { type: "keyword" },
      timestamp: { type: "date" },
      temperature: { type: "float" },
      humidity: { type: "float" },
      airQuality: { type: "float" },
      co2: { type: "float" }
    }
  }
}' --silent

# alerts
kourou collection:create iot alerts '{
  mappings: {
    properties: {
      stationId: { type: "keyword" },
      type: { type: "keyword" },
      message: { type: "text" },
      level: { type: "keyword" },
      timestamp: { type: "date" }
    }
  }
}' --silent

# users
kourou collection:create iot users '{
  mappings: {
    properties: {
      name: { type: "text" },
      email: { type: "keyword" },
      role: { type: "keyword" },
      createdAt: { type: "date" }
    }
  }
}' --silent

# events
kourou collection:create iot events '{
  mappings: {
    properties: {
      type: { type: "keyword" },
      message: { type: "text" },
      timestamp: { type: "date" }
    }
  }
}' --silent

echo "✅ Collections créées avec succès dans l'index 'iot'"
