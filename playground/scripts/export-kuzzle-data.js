const { Kuzzle, WebSocket } = require('kuzzle-sdk');
const fs = require('fs');
const path = require('path');

const INDEX = 'iot';
const COLLECTIONS = [
  'users',
  'reading',
  'alerts',
  'cycle-vie',
  'events',
  'filtres',
  'maintenance_interventions',
  'stations',
  'water_quality',
  'users-activity-logs',
  'historique_alerts'
];

const BACKUP_DIR = './kuzzle-backup';

async function exportKuzzleData() {
  console.log('🔌 Connexion à Kuzzle...');
  
  const kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));

  try {
    await kuzzle.connect();
    console.log('✅ Connecté à Kuzzle\n');

    // Créer le dossier de backup s'il n'existe pas
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const allData = {
      index: INDEX,
      collections: {}
    };

    // Exporter chaque collection
    for (const collection of COLLECTIONS) {
      console.log(`📦 Export de ${collection}...`);
      
      try {
        const response = await kuzzle.document.search(
          INDEX,
          collection,
          {},
          { size: 10000, scroll: '1m' }
        );

        let documents = response.hits;
        let scrollId = response.scrollId;

        // Pagination si plus de 10000 documents
        while (scrollId && documents.length < response.total) {
          const scrollResponse = await kuzzle.document.scroll(scrollId, { scroll: '1m' });
          documents = documents.concat(scrollResponse.hits);
          scrollId = scrollResponse.scrollId;
        }

        allData.collections[collection] = {
          total: documents.length,
          documents: documents.map(doc => ({
            _id: doc._id,
            _source: doc._source
          }))
        };

        console.log(`   ✓ ${documents.length} documents exportés`);
      } catch (error) {
        console.log(`   ⚠️ Erreur lors de l'export de ${collection}: ${error.message}`);
        allData.collections[collection] = {
          total: 0,
          documents: [],
          error: error.message
        };
      }
    }

    // Sauvegarder dans un fichier JSON
    const backupFile = path.join(BACKUP_DIR, 'data.json');
    fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));

    console.log(`\n✅ Export terminé !`);
    console.log(`📁 Fichier créé : ${backupFile}`);
    console.log(`\n📊 Résumé :`);
    
    let totalDocs = 0;
    for (const [collection, data] of Object.entries(allData.collections)) {
      console.log(`   - ${collection}: ${data.total} documents`);
      totalDocs += data.total;
    }
    console.log(`\n   Total: ${totalDocs} documents exportés`);

    kuzzle.disconnect();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Lancer l'export
exportKuzzleData();
