const { Kuzzle, WebSocket } = require('kuzzle-sdk');

async function run() {
  const kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));

  try {
    await kuzzle.connect();
    console.log('Connecté à Kuzzle');

    // Document qui dépasse les seuils -> doit déclencher des alertes
    const doc = {
      stationId: 'Sanar',
      pH: 10.5,        // dépasse max 9
      DO: 1.5,         // en dessous min 2
      DCO: 130,        // dépasse max 120
      DBO5: 30         // dépasse max 25
    };

    // Crée le document dans la collection water_quality
    const res = await kuzzle.document.create('iot', 'water_quality', doc);
    console.log('Document créé id=', res._id);

    // Petite attente puis recherche des alertes
    setTimeout(async () => {
      const alerts = await kuzzle.document.search('iot', 'alerts', { query: { match_all: {} } });
      console.log('Alertes créées :', alerts.hits.map(h => h._source));
      await kuzzle.disconnect();
      process.exit(0);
    }, 1000);

  } catch (err) {
    console.error('Erreur:', err.message);
    await kuzzle.disconnect();
    process.exit(1);
  }
}

run();
