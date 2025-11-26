const { Kuzzle, WebSocket } = require('kuzzle-sdk');
const { v4: uuidv4 } = require('uuid');

const kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));

let intervalId = null;
let isRunning = false;

// Générer une lecture aléatoire
function generateReading(stationId) {
  return {
    stationId,
    timestamp: new Date().toISOString(),
    temperature: Number((Math.random() * 20 + 20).toFixed(2)),
    humidity: Number((Math.random() * 60 + 30).toFixed(2)),
    airQuality: Number((Math.random() * 500).toFixed(2)),
    co2: Number((Math.random() * 700 + 300).toFixed(2)),
    ph: Number((Math.random() * 4 + 6).toFixed(2)),
    turbidity: Number((Math.random() * 100).toFixed(2)),
    dissolvedOxygen: Number((Math.random() * 15).toFixed(2))
  };
}

// Envoyer les données
async function sendReadings(stationIds) {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  for (const stationId of stationIds) {
    const reading = generateReading(stationId);
    
    try {
      await kuzzle.document.create('iot', 'readings', reading, uuidv4(), { refresh: 'wait_for' });
      
      await kuzzle.document.create('iot', 'water_quality', {
        stationId: reading.stationId,
        timestamp: reading.timestamp,
        ph: reading.ph,
        turbidity: reading.turbidity,
        dissolvedOxygen: reading.dissolvedOxygen,
        temperature: reading.temperature
      }, uuidv4(), { refresh: 'wait_for' });
      
      console.log(`📊 [${timestamp}] Lecture envoyée pour ${stationId}`);
      console.log(`   → Temp: ${reading.temperature}°C, Hum: ${reading.humidity}%, AQI: ${reading.airQuality}`);
    } catch (error) {
      console.error(`❌ Erreur pour ${stationId}:`, error.message);
    }
  }
}

// Démarrer le simulateur
async function startSimulator(intervalSeconds = 30, stationIds = ['station-dakar-0']) {
  if (isRunning) {
    console.log('⚠️ Le simulateur est déjà en cours');
    return;
  }

  await kuzzle.connect();
  console.log('✅ Connecté à Kuzzle');
  console.log(`🟢 Démarrage du simulateur (intervalle: ${intervalSeconds}s)`);
  console.log(`📍 Stations: ${stationIds.join(', ')}`);

  // Envoyer immédiatement
  await sendReadings(stationIds);

  // Puis périodiquement
  intervalId = setInterval(async () => {
    await sendReadings(stationIds);
  }, intervalSeconds * 1000);

  isRunning = true;
}

// Arrêter proprement
process.on('SIGINT', () => {
  console.log('\n🔴 Arrêt du simulateur...');
  if (intervalId) clearInterval(intervalId);
  kuzzle.disconnect();
  process.exit(0);
});

// Configuration
const config = {
  intervalSeconds: process.env.INTERVAL || 30,
  stationIds: process.env.STATIONS ? process.env.STATIONS.split(',') : ['station-dakar-0', 'station-dakar-1']
};

// Démarrer
startSimulator(config.intervalSeconds, config.stationIds);
