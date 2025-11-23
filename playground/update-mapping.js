const { Kuzzle, WebSocket } = require('kuzzle-sdk');

async function updateWaterQualityMapping() {
  const kuzzle = new Kuzzle(new WebSocket('localhost'));
  
  try {
    await kuzzle.connect();
    console.log('🔌 Connecté à Kuzzle');

    // Mettre à jour le mapping pour ajouter la date
    const updatedMapping = {
      properties: {
        date: { type: "date" },
        mois: { type: "keyword" },
        temperature_c: { type: "float" },
        conductivite_us_cm: { type: "float" },
        mvs_pct: { type: "float" },
        oeufs_helminthes: { type: "float" },
        huiles_graisses: { type: "float" }
      }
    };

    await kuzzle.collection.updateMapping('iot', 'water_quality', updatedMapping);
    console.log('✅ Colonne DATE ajoutée à water_quality');

    kuzzle.disconnect();
    console.log('🔌 Déconnecté');
  } catch (error) {
    console.error('❌ Erreur:', error);
    kuzzle.disconnect();
  }
}

updateWaterQualityMapping();
