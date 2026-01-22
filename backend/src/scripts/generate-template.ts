// backend/src/scripts/generate-template.ts
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Génère un template Excel conforme aux fichiers terrain
 * Les agents n'ont qu'à remplir les mesures, tout le reste est automatique
 */

// En-têtes pour phase ENTRÉE (moins de colonnes)
const HEADERS_ENTREE = [
  'Mois',
  'Data',
  'Heure echantillon /observations',
  'Temperature (°C)',
  'pH',
  'conductivité (µS/cm)',
  'Potentiel Redox (mV)'
];

// En-têtes pour phase SORTIE (toutes les colonnes)
const HEADERS_SORTIE = [
  'Mois',
  'Data',
  'Heure echantillon /observations',
  'Temperature (°C)',
  'pH',
  'conductivité (µS/cm)',
  'Potentiel Redox (mV)',
  'DBO5 (mg/L)',
  'DCO (mg/L)',
  'MES (mg/L)',
  'MVS (%)',
  'Nitrates (mg/L)',
  'Ammonium (mg/L)',
  'Azote Total (mg/L)',
  'Phosphates (mg/L)',
  'Coliformes Fécaux (CFU/100ml)',
  'Oeufs Helminthes',
  'Huiles et Graisses'
];

// Exemples de données pour ENTRÉE
const EXAMPLES_ENTREE = [
  {
    'Mois': 'Mars',
    'Data': '09/03/2025',
    'Heure echantillon /observations': '9h',
    'Temperature (°C)': 24.2,
    'pH': 8.09,
    'conductivité (µS/cm)': 2930,
    'Potentiel Redox (mV)': 278
  },
  {
    'Mois': 'Mars',
    'Data': '16/03/2025',
    'Heure echantillon /observations': '9h',
    'Temperature (°C)': 22.7,
    'pH': 8.23,
    'conductivité (µS/cm)': 3760,
    'Potentiel Redox (mV)': 285
  },
  {
    'Mois': 'Avril',
    'Data': '02/04/2025',
    'Heure echantillon /observations': '9h',
    'Temperature (°C)': 24.7,
    'pH': 8.07,
    'conductivité (µS/cm)': 3080,
    'Potentiel Redox (mV)': 292
  }
];

// Exemples de données pour SORTIE
const EXAMPLES_SORTIE = [
  {
    'Mois': 'Mars',
    'Data': '09/03/2025',
    'Heure echantillon /observations': '14h',
    'Temperature (°C)': 26.5,
    'pH': 7.42,
    'conductivité (µS/cm)': 1850,
    'Potentiel Redox (mV)': 312,
    'DBO5 (mg/L)': 15,
    'DCO (mg/L)': 45,
    'MES (mg/L)': 10,
    'MVS (%)': 65,
    'Nitrates (mg/L)': 5.2,
    'Ammonium (mg/L)': 1.3,
    'Azote Total (mg/L)': 8.5,
    'Phosphates (mg/L)': 2.1,
    'Coliformes Fécaux (CFU/100ml)': 1000,
    'Oeufs Helminthes': 0,
    'Huiles et Graisses': null
  },
  {
    'Mois': 'Mars',
    'Data': '16/03/2025',
    'Heure echantillon /observations': '14h',
    'Temperature (°C)': 27.1,
    'pH': 7.38,
    'conductivité (µS/cm)': 1920,
    'Potentiel Redox (mV)': 308,
    'DBO5 (mg/L)': 18,
    'DCO (mg/L)': 52,
    'MES (mg/L)': 12,
    'MVS (%)': 68,
    'Nitrates (mg/L)': 4.8,
    'Ammonium (mg/L)': 1.5,
    'Azote Total (mg/L)': 9.2,
    'Phosphates (mg/L)': 2.3,
    'Coliformes Fécaux (CFU/100ml)': 850,
    'Oeufs Helminthes': 0,
    'Huiles et Graisses': null
  }
];

function generateTemplate() {
  console.log('📝 Génération du template Excel pour agents terrain...');

  const workbook = XLSX.utils.book_new();

  // === FEUILLE 1: Instructions ===
  const instructionsData = [
    ['📋 TEMPLATE DE DONNÉES - QUALITÉ DE L\'EAU'],
    ['Version Agents Terrain - Station de Traitement'],
    [],
    ['🚀 MODE D\'EMPLOI RAPIDE:'],
    [],
    ['1️⃣ NOMMAGE DES FEUILLES (IMPORTANT):'],
    ['   • Pour ENTRÉE du filtre FV1 : nommez la feuille "Entree_FV1" ou "ENTREE FV1"'],
    ['   • Pour SORTIE du filtre FV1 : nommez la feuille "Sortie_FV1" ou "SORTIE FV1"'],
    ['   • Pour SORTIE du filtre FV2 : nommez la feuille "Sortie_FV2" ou "SFV2"'],
    ['   • Le système détecte automatiquement la phase et le filtre depuis le nom !'],
    [],
    ['2️⃣ SAISIE DES DONNÉES:'],
    ['   • NE MODIFIEZ PAS les en-têtes (première ligne avec Mois, Data, Temperature...)'],
    ['   • Remplissez les données ligne par ligne à partir de la ligne 2'],
    ['   • Laissez vide les mesures non effectuées (le système mettra "null")'],
    ['   • Vous pouvez ajouter des lignes de statistiques (MOYENNE, MAX, MIN) à la fin'],
    [],
    ['3️⃣ FORMAT DES DONNÉES:'],
    ['   • Mois : Écrivez le nom (Mars, Avril, Mai...)'],
    ['   • Data : Date au format JJ/MM/AAAA (ex: 09/04/2025) ou nombre Excel'],
    ['   • Heure : Format texte libre (ex: "9h", "14h30", "20h00")'],
    ['   • Valeurs numériques : Utilisez point ou virgule (24.2 ou 24,2)'],
    ['   • Notation scientifique acceptée : 3.67E+06 pour les coliformes'],
    [],
    ['4️⃣ LORS DE L\'IMPORT:'],
    ['   • Ouvrez l\'interface web d\'injection'],
    ['   • Saisissez l\'ID de votre station (fourni par l\'administrateur)'],
    ['   • Sélectionnez votre fichier Excel'],
    ['   • Cliquez sur "Importer"'],
    ['   • Le système :'],
    ['     ✓ Détecte automatiquement les en-têtes'],
    ['     ✓ Ignore les lignes de titre et colonnes vides'],
    ['     ✓ Ignore les lignes de statistiques'],
    ['     ✓ Extrait la phase et le filtre du nom de feuille'],
    ['     ✓ Convertit les dates automatiquement'],
    [],
    ['⚠️ IMPORTANT:'],
    ['   • L\'ID de la station est OBLIGATOIRE lors de l\'import'],
    ['   • Exemples d\'ID : "station-saint-louis-1764092258261"'],
    ['   • Les feuilles "Instructions" et "Exemples" sont automatiquement ignorées'],
    [],
    ['📊 COLONNES DISPONIBLES:'],
    [''],
    ['PHASE ENTRÉE (mesures de base):'],
    ['   • Mois, Data, Heure, Temperature, pH, Conductivité, Potentiel Redox'],
    [''],
    ['PHASE SORTIE (mesures complètes):'],
    ['   • Mois, Data, Heure, Temperature, pH, Conductivité, Potentiel Redox'],
    ['   • DBO5, DCO, MES, MVS'],
    ['   • Nitrates, Ammonium, Azote Total, Phosphates'],
    ['   • Coliformes Fécaux, Oeufs Helminthes, Huiles et Graisses'],
    [],
    ['💡 ASTUCE:'],
    ['   • Vous pouvez garder vos titres décoratifs et colonnes vides'],
    ['   • Le système est intelligent et les ignore automatiquement'],
    ['   • Concentrez-vous sur la saisie des données !'],
    [],
    ['📞 SUPPORT:'],
    ['   En cas de problème, contactez l\'administrateur système']
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 90 }]; // Largeur colonne
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // === FEUILLE 2: Exemples ENTRÉE ===
  const examplesEntreeSheet = XLSX.utils.json_to_sheet(EXAMPLES_ENTREE, {
    header: HEADERS_ENTREE
  });
  XLSX.utils.book_append_sheet(workbook, examplesEntreeSheet, 'Exemples_Entree');

  // === FEUILLE 3: Exemples SORTIE ===
  const examplesSortieSheet = XLSX.utils.json_to_sheet(EXAMPLES_SORTIE, {
    header: HEADERS_SORTIE
  });
  XLSX.utils.book_append_sheet(workbook, examplesSortieSheet, 'Exemples_Sortie');

  // === FEUILLES DE SAISIE (vides avec en-têtes uniquement) ===
  
  // Entrée FV1
  const entreeFV1Data = [HEADERS_ENTREE];
  const entreeFV1Sheet = XLSX.utils.aoa_to_sheet(entreeFV1Data);
  XLSX.utils.book_append_sheet(workbook, entreeFV1Sheet, 'Entree_FV1');

  // Sortie FV1
  const sortieFV1Data = [HEADERS_SORTIE];
  const sortieFV1Sheet = XLSX.utils.aoa_to_sheet(sortieFV1Data);
  XLSX.utils.book_append_sheet(workbook, sortieFV1Sheet, 'Sortie_FV1');

  // Sortie FV2
  const sortieFV2Data = [HEADERS_SORTIE];
  const sortieFV2Sheet = XLSX.utils.aoa_to_sheet(sortieFV2Data);
  XLSX.utils.book_append_sheet(workbook, sortieFV2Sheet, 'Sortie_FV2');

  // Sortie FV3 (optionnel)
  const sortieFV3Data = [HEADERS_SORTIE];
  const sortieFV3Sheet = XLSX.utils.aoa_to_sheet(sortieFV3Data);
  XLSX.utils.book_append_sheet(workbook, sortieFV3Sheet, 'Sortie_FV3');

  // Créer le dossier templates
  const templatesDir = path.join(__dirname, '../../templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
    console.log('📁 Dossier templates créé');
  }

  // Sauvegarder
  const outputPath = path.join(templatesDir, 'template_water_quality.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log(`\n✅ Template généré avec succès: ${outputPath}`);
  console.log('\n📊 Feuilles créées:');
  console.log('   1. Instructions       - Guide complet pour les agents');
  console.log('   2. Exemples_Entree    - Exemples de données d\'entrée');
  console.log('   3. Exemples_Sortie    - Exemples de données de sortie');
  console.log('   4. Entree_FV1         - Feuille vide pour saisie entrée FV1');
  console.log('   5. Sortie_FV1         - Feuille vide pour saisie sortie FV1');
  console.log('   6. Sortie_FV2         - Feuille vide pour saisie sortie FV2');
  console.log('   7. Sortie_FV3         - Feuille vide pour saisie sortie FV3');
  console.log('\n💡 Les agents peuvent maintenant:');
  console.log('   • Télécharger ce template');
  console.log('   • Remplir les feuilles avec leurs mesures');
  console.log('   • Uploader directement sans nettoyage manuel');
  console.log('\n🎉 Tout est automatique !');
}

// Exécuter
try {
  generateTemplate();
} catch (error) {
  console.error('❌ Erreur lors de la génération:', error);
  process.exit(1);
}