// backend/src/scripts/compare-regularizations.ts

import { MLTrainingService } from '../services/ml/ml-training.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script pour comparer Ridge vs Lasso vs Elastic Net
 * Usage: npm run compare-regularizations
 */
async function compareRegularizations() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  COMPARAISON RIDGE vs LASSO vs ELASTIC NET - MÉMOIRE      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const regularizationTypes: ('ridge' | 'lasso' | 'elasticnet')[] = ['ridge', 'lasso', 'elasticnet'];
  const results: any[] = [];

  for (const regType of regularizationTypes) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔬 TEST ${regType.toUpperCase()}`);
    console.log('='.repeat(60));

    const trainingService = new MLTrainingService();

    try {
      const result = await trainingService.trainWaterQualityModel({
        minSamples: 5,
        regularizationType: regType
      });

      if (result.success && result.metrics) {
        results.push({
          regularization: regType,
          metrics: result.metrics.metrics,
          samples: result.trainingData?.metadata.totalSamples
        });

        console.log(`\n✅ ${regType.toUpperCase()} - Résultats:`);
        console.log(`   MAE: ${result.metrics.metrics.mae.toFixed(4)}`);
        console.log(`   RMSE: ${result.metrics.metrics.rmse.toFixed(4)}`);
        console.log(`   R²: ${result.metrics.metrics.r2.toFixed(4)}`);
        console.log(`   MAPE: ${result.metrics.metrics.mape.toFixed(2)}%`);
      }
    } catch (error) {
      console.error(`❌ Erreur avec ${regType}:`, error);
    }

    // Petit délai entre les tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Afficher le comparatif final
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TABLEAU COMPARATIF FINAL');
  console.log('='.repeat(60));
  console.log('\n| Régularisation | MAE      | RMSE     | R²       | MAPE    |');
  console.log('|---------------|----------|----------|----------|---------|');

  results.forEach(r => {
    console.log(
      `| ${r.regularization.padEnd(13)} | ` +
      `${r.metrics.mae.toFixed(4).padEnd(8)} | ` +
      `${r.metrics.rmse.toFixed(4).padEnd(8)} | ` +
      `${r.metrics.r2.toFixed(4).padEnd(8)} | ` +
      `${r.metrics.mape.toFixed(2).padEnd(7)}% |`
    );
  });

  console.log('\n' + '='.repeat(60));

  // Déterminer le meilleur modèle
  const bestByR2 = results.reduce((best, current) =>
    current.metrics.r2 > best.metrics.r2 ? current : best
  );

  const bestByMAE = results.reduce((best, current) =>
    current.metrics.mae < best.metrics.mae ? current : best
  );

  console.log('\n🏆 MEILLEURS MODÈLES:');
  console.log(`   - Par R² (généralisation): ${bestByR2.regularization.toUpperCase()} (R² = ${bestByR2.metrics.r2.toFixed(4)})`);
  console.log(`   - Par MAE (précision): ${bestByMAE.regularization.toUpperCase()} (MAE = ${bestByMAE.metrics.mae.toFixed(4)})`);

  // Sauvegarder les résultats pour le mémoire
  const reportPath = path.join(__dirname, '../../models/regularization-comparison.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Résultats sauvegardés dans: ${reportPath}`);

  console.log('\n📝 RECOMMANDATION POUR LE MÉMOIRE:');
  console.log(`   Utilisez ${bestByR2.regularization.toUpperCase()} pour de meilleurs résultats de généralisation.`);
  console.log('');
}

compareRegularizations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });