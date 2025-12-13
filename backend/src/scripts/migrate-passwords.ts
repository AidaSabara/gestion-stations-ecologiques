import { Kuzzle, WebSocket } from "kuzzle-sdk";
import { PasswordUtil } from "../utils/password.util";

async function migratePasswords() {
  const kuzzle = new Kuzzle(new WebSocket("localhost"));

  try {
    console.log('🔄 Démarrage de la migration des mots de passe...');
    
    await kuzzle.connect();
    console.log('✅ Connecté à Kuzzle');

    const response = await kuzzle.document.search(
      'iot',
      'users',
      { query: { match_all: {} } },
      { size: 1000 }
    );

    console.log(`📊 ${response.hits.length} utilisateurs trouvés`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const hit of response.hits) {
      const userId = hit._id;
      const userData = hit._source as any;

      // Vérifier si le mot de passe est déjà hashé (bcrypt commence par $2b$)
      if (userData.password && !userData.password.startsWith('$2b$')) {
        console.log(`🔐 Migration du mot de passe pour: ${userData.email}`);

        try {
          const hashedPassword = await PasswordUtil.hash(userData.password);

          await kuzzle.document.update(
            'iot',
            'users',
            userId,
            { password: hashedPassword }
          );

          migratedCount++;
          console.log(`  ✅ Migré: ${userData.email}`);
        } catch (error) {
          console.error(`  ❌ Erreur migration ${userData.email}:`, error);
        }
      } else {
        console.log(`  ⏭️  Déjà migré: ${userData.email}`);
        skippedCount++;
      }
    }

    console.log('\n📊 RÉSUMÉ DE LA MIGRATION:');
    console.log(`  ✅ Migrés: ${migratedCount}`);
    console.log(`  ⏭️  Ignorés (déjà hashés): ${skippedCount}`);
    console.log(`  📝 Total: ${response.hits.length}`);

    kuzzle.disconnect();
    console.log('🔌 Déconnecté de Kuzzle');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    kuzzle.disconnect();
    process.exit(1);
  }
}

migratePasswords();
