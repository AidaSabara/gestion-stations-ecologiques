// backend/src/services/file-parser.service.ts
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import {
  WaterQualityDocument,
  RawWaterQualityData,
  ParseResult,
  ParseOptions,
  COLUMN_MAPPING,
  REQUIRED_FIELDS,
  NUMERIC_FIELDS
} from '../types/water-quality.types';

export class FileParserService {
  /**
   * Parse un fichier Excel avec détection automatique intelligente
   * Gère TOUS les formats de fichiers terrain sans intervention manuelle
   */
  parseExcel(buffer: Buffer, options: ParseOptions = {}): ParseResult {
    const result: ParseResult = {
      success: false,
      data: [],
      errors: [],
      warnings: [],
      stats: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        sheets: []
      }
    };

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellStyles: false });

      console.log(`📚 Fichier Excel détecté: ${workbook.SheetNames.length} feuille(s)`);

      // Traiter chaque feuille
      for (const sheetName of workbook.SheetNames) {
        // Ignorer feuilles non pertinentes
        if (this.shouldIgnoreSheet(sheetName)) {
          console.log(`⏭️ Feuille ignorée: "${sheetName}"`);
          continue;
        }

        console.log(`\n🔍 Traitement de la feuille: "${sheetName}"`);
        result.stats.sheets.push(sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        
        // DÉTECTION INTELLIGENTE : Trouve la vraie ligne d'en-tête
        const analysisResult = this.analyzeWorksheet(worksheet);
        
        if (!analysisResult.headerFound) {
          result.warnings.push(`Feuille "${sheetName}": En-têtes non détectés`);
          console.warn(`⚠️ Feuille "${sheetName}": Pas d'en-têtes valides trouvés`);
          continue;
        }

        console.log(`✅ En-têtes trouvés à la ligne ${analysisResult.headerRowIndex + 1}`);
        console.log(`📊 Colonnes détectées: ${analysisResult.validColumns.length}`);
        console.log(`   → ${analysisResult.validColumns.slice(0, 5).join(', ')}...`);

        // Extraire les données à partir de la ligne suivant les en-têtes
        const cleanedData = this.extractDataFromWorksheet(
          worksheet, 
          analysisResult.headerRowIndex,
          analysisResult.validColumns
        );

        console.log(`📦 ${cleanedData.length} lignes de données extraites`);

        // Extraire infos de la feuille (phase, filtre)
        const sheetInfo = this.extractInfoFromSheetName(sheetName);
        console.log(`🏷️ Info feuille: Phase=${sheetInfo.phase}, Filtre=${sheetInfo.id_filtre}`);

        // Parser chaque ligne
        for (let i = 0; i < cleanedData.length; i++) {
          const absoluteRowNumber = analysisResult.headerRowIndex + i + 2;
          result.stats.totalRows++;

          // Ignorer lignes vides ou de statistiques
          if (this.isEmptyOrStatRow(cleanedData[i])) {
            continue;
          }

          try {
            const document = this.mapRowToDocument(cleanedData[i], {
              ...options,
              sheetName,
              sheetInfo
            });

            // Valider
            const validation = this.validateDocument(document, options.strictValidation);
            
            if (validation.isValid) {
              result.data.push(document);
              result.stats.validRows++;
            } else {
              result.stats.invalidRows++;
              result.errors.push(
                `Feuille "${sheetName}", Ligne ${absoluteRowNumber}: ${validation.errors.join(', ')}`
              );
            }
          } catch (error: any) {
            result.stats.invalidRows++;
            result.errors.push(
              `Feuille "${sheetName}", Ligne ${absoluteRowNumber}: ${error.message}`
            );
          }
        }
      }

      result.success = result.data.length > 0;
      
      console.log(`\n✅ Parsing terminé:`);
      console.log(`   - ${result.data.length} documents valides`);
      console.log(`   - ${result.stats.invalidRows} lignes invalides`);
      console.log(`   - ${result.stats.sheets.length} feuille(s) traitée(s)`);

      return result;
    } catch (error: any) {
      console.error('❌ Erreur parsing Excel:', error);
      result.errors.push(`Erreur parsing Excel: ${error.message}`);
      return result;
    }
  }

  /**
   * Détermine si une feuille doit être ignorée
   */
  private shouldIgnoreSheet(sheetName: string): boolean {
    const lower = sheetName.toLowerCase().trim();
    const ignorePatterns = [
      'instruction', 'exemple', 'template', 'guide',
      'légende', 'legende', 'readme', 'info'
    ];
    
    return ignorePatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * ANALYSE INTELLIGENTE du worksheet pour trouver les en-têtes
   * Détecte automatiquement la bonne ligne même avec titres, lignes vides, etc.
   */
  private analyzeWorksheet(worksheet: XLSX.WorkSheet): {
    headerFound: boolean;
    headerRowIndex: number;
    validColumns: string[];
  } {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Mots-clés essentiels pour identifier les en-têtes de données
    const essentialKeywords = [
      'mois', 'data', 'date', 'temperature', 'température', 'ph',
      'dbo', 'dco', 'mes', 'conductivite', 'conductivité',
      'nitrate', 'ammonium', 'phosphate', 'coliforme'
    ];

    // Chercher dans les 20 premières lignes
    const maxRowsToCheck = Math.min(20, range.e.r + 1);
    
    for (let row = range.s.r; row < maxRowsToCheck; row++) {
      const rowData = this.readRowFromWorksheet(worksheet, row, range);
      
      // Compter colonnes non vides
      const nonEmptyCells = rowData.filter(cell => 
        cell && 
        typeof cell === 'string' && 
        cell.trim() !== '' &&
        !cell.toUpperCase().includes('EMPTY')
      );

      // Compter les mots-clés trouvés
      let keywordMatches = 0;
      const validColumns: string[] = [];

      for (const cell of nonEmptyCells) {
        const normalized = cell.toLowerCase().trim();
        
        // Vérifier si c'est un mot-clé essentiel
        if (essentialKeywords.some(keyword => normalized.includes(keyword))) {
          keywordMatches++;
          validColumns.push(cell.trim());
        } else if (normalized.length > 2 && !this.isLikelyDecorative(cell)) {
          // Colonne valide mais pas un mot-clé (ex: "Opération", "Observation")
          validColumns.push(cell.trim());
        }
      }

      // Critères de détection de la ligne d'en-tête:
      // - Au moins 4 mots-clés essentiels
      // - Au moins 6 colonnes non vides au total
      if (keywordMatches >= 4 && validColumns.length >= 6) {
        console.log(`🎯 Ligne d'en-tête détectée: ligne ${row + 1}`);
        console.log(`   - ${keywordMatches} mots-clés essentiels`);
        console.log(`   - ${validColumns.length} colonnes valides`);
        
        return {
          headerFound: true,
          headerRowIndex: row,
          validColumns: this.getAllColumnsFromRow(worksheet, row, range)
        };
      }
    }

    return {
      headerFound: false,
      headerRowIndex: -1,
      validColumns: []
    };
  }

  /**
   * Vérifie si une cellule ressemble à du texte décoratif
   */
  private isLikelyDecorative(text: string): boolean {
    const decorativePatterns = [
      /^entrée/i, /^entree/i, /^sortie/i, /^eau brute/i,
      /^station/i, /^filtre/i, /^moyenne$/i, /^max$/i, 
      /^min$/i, /^ds$/i, /^cv$/i, /^n$/i
    ];
    
    return decorativePatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Lit toutes les cellules d'une ligne
   */
  private readRowFromWorksheet(
    worksheet: XLSX.WorkSheet, 
    row: number, 
    range: XLSX.Range
  ): any[] {
    const cells: any[] = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      cells.push(cell?.v ?? null);
    }
    
    return cells;
  }

  /**
   * Récupère tous les noms de colonnes (en-têtes) d'une ligne
   */
  private getAllColumnsFromRow(
    worksheet: XLSX.WorkSheet, 
    row: number, 
    range: XLSX.Range
  ): string[] {
    const columns: string[] = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      
      if (cell?.v) {
        const value = String(cell.v).trim();
        // Ignorer colonnes EMPTY et colonnes vides
        if (value && !value.toUpperCase().includes('EMPTY') && value !== '-') {
          columns.push(value);
        }
      }
    }
    
    return columns;
  }

  /**
   * Extrait les données à partir de la ligne suivant les en-têtes
   */
  private extractDataFromWorksheet(
    worksheet: XLSX.WorkSheet,
    headerRowIndex: number,
    validColumns: string[]
  ): RawWaterQualityData[] {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const data: RawWaterQualityData[] = [];

    // Mapper les colonnes vers leur index
    const headerRow = this.readRowFromWorksheet(worksheet, headerRowIndex, range);
    const columnMapping: Map<number, string> = new Map();
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const headerValue = headerRow[col - range.s.c];
      if (headerValue && typeof headerValue === 'string') {
        const trimmed = headerValue.trim();
        if (trimmed && !trimmed.toUpperCase().includes('EMPTY') && trimmed !== '-') {
          columnMapping.set(col, trimmed);
        }
      }
    }

    // Extraire les données
    for (let row = headerRowIndex + 1; row <= range.e.r; row++) {
      const rowData: RawWaterQualityData = {};
      let hasData = false;

      for (let col = range.s.c; col <= range.e.c; col++) {
        const columnName = columnMapping.get(col);
        if (!columnName) continue; // Colonne ignorée

        const address = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[address];

        if (cell?.v !== undefined && cell?.v !== null) {
          rowData[columnName] = cell.v;
          hasData = true;
        } else {
          rowData[columnName] = null;
        }
      }

      if (hasData) {
        data.push(rowData);
      }
    }

    return data;
  }

  /**
   * Vérifie si une ligne est vide ou est une ligne de statistiques
   */
  private isEmptyOrStatRow(row: RawWaterQualityData): boolean {
    if (!row || typeof row !== 'object') return true;

    // Vérifier si complètement vide
    const allEmpty = Object.values(row).every(value => 
      value === null || 
      value === undefined || 
      value === '' ||
      (typeof value === 'string' && value.trim() === '')
    );

    if (allEmpty) return true;

    // Détecter lignes de statistiques (MOYENNE, MAX, MIN, DS, CV, n)
    const firstValue = Object.values(row).find(v => v !== null && v !== undefined);
    if (firstValue && typeof firstValue === 'string') {
      const normalized = firstValue.toLowerCase().trim();
      const statKeywords = ['moyenne', 'max', 'min', 'ds', 'cv', 'n', 'total'];
      if (statKeywords.includes(normalized)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extrait les infos de phase et filtre depuis le nom de feuille
   */

   /**
 * Extrait les infos de phase et filtre depuis le nom de feuille
 * CORRIGÉ: 
 * - type_filtre = Filtre_Vertical ou Filtre_Horizontal uniquement
 * - MELANGE = Sortie avec mélange Typha+Vetiver (classé en Filtre_Vertical)
 */
private extractInfoFromSheetName(sheetName: string): {
    phase: 'Entree' | 'Sortie';
    id_filtre: string;
    type_filtre: string;
  } {
    const info: any = {
      phase: 'Entree',
      id_filtre: '',
      type_filtre: 'Non_Applicable'
    };
    
    const normalized = sheetName.toLowerCase().trim();
    
    // 🆕 PRIORITÉ 1: Détecter codes SFV (Sortie Filtre Vertical)
    const sfvMatch = sheetName.match(/SFV(\d+[a-z]?)/i);
    if (sfvMatch) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Vertical';
      info.id_filtre = `SFV${sfvMatch[1].toUpperCase()}`;
      console.log(`   → Détecté: Sortie Filtre Vertical ${info.id_filtre}`);
      return info;
    }
    
    // 🆕 PRIORITÉ 2: Détecter codes SFH (Sortie Filtre Horizontal)
    const sfhMatch = sheetName.match(/SFH([a-z]?)/i);
    if (sfhMatch) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Horizontal';
      info.id_filtre = `SFH${sfhMatch[1].toUpperCase()}`;
      console.log(`   → Détecté: Sortie Filtre Horizontal ${info.id_filtre}`);
      return info;
    }
    
    // PRIORITÉ 3: Codes de filtres génériques (FV1, FH2, etc.)
    const filtreCodeMatch = sheetName.match(/([A-Z]{2,3}\d+[a-z]?)/i);
    if (filtreCodeMatch) {
      info.id_filtre = filtreCodeMatch[1].toUpperCase();
      
      // Déterminer phase et type selon le préfixe
      if (info.id_filtre.startsWith('FV') || info.id_filtre.startsWith('SFV')) {
        info.phase = 'Sortie';
        info.type_filtre = 'Filtre_Vertical';
      } else if (info.id_filtre.startsWith('FH') || info.id_filtre.startsWith('SFH')) {
        info.phase = 'Sortie';
        info.type_filtre = 'Filtre_Horizontal';
      } else {
        info.phase = 'Sortie';
        info.type_filtre = 'Non_Applicable';
      }
      
      console.log(`   → Détecté: ${info.type_filtre} ${info.id_filtre} (${info.phase})`);
      return info;
    }
    
    // Vetiver = Filtre Vertical
    if (normalized.includes('vetiver') || normalized.includes('vétiver')) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Vertical';
      info.id_filtre = 'VETIVER';
      return info;
    }
    
    // Typha = Filtre Horizontal
    if (normalized.includes('typha')) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Horizontal';
      info.id_filtre = 'TYPHA';
      return info;
    }
    
    // Mélange = Filtre Vertical (classification par défaut)
    if (normalized.includes('melange') || normalized.includes('mélange') || normalized.includes('mixte')) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Vertical';
      info.id_filtre = 'MELANGE';
      return info;
    }
    
    // Eau Décantée
    if (normalized.includes('decant') || normalized.includes('décant')) {
      info.phase = 'Entree';
      info.type_filtre = 'Non_Applicable';
      info.id_filtre = 'DECANTEE';
      return info;
    }
    
    // Eau Brute (Entrée)
    if (normalized.includes('brute') || normalized.includes('raw') || 
        normalized.includes('entree') || normalized.includes('entrée') ||
        normalized.includes('input')) {
      info.phase = 'Entree';
      info.type_filtre = 'Non_Applicable';
      info.id_filtre = 'BRUTE';
      return info;
    }
    
    // Sortie explicite
    if (normalized.includes('sortie') || normalized.includes('output') || 
        normalized.includes('traité') || normalized.includes('traite')) {
      info.phase = 'Sortie';
      info.type_filtre = 'Filtre_Vertical';
      return info;
    }
    
    return info;
  }


  /**
   * Mappe une ligne brute vers un document water_quality
   */
  private mapRowToDocument(
    rawRow: RawWaterQualityData,
    options: ParseOptions & { sheetName?: string; sheetInfo?: any } = {}
  ): WaterQualityDocument {
    const doc: any = {
      id_station: options.defaultStation || '',
      phase: options.sheetInfo?.phase || 'Entree',
      type_filtre: options.sheetInfo?.type_filtre || 'Non_Applicable',
      id_filtre: options.sheetInfo?.id_filtre || '',
      date: null,
      mois: null,
      temperature_c: null,
      ph: null,
      conductivite_us_cm: null,
      potentiel_redox_mv: null,
      dbo5_mg_l: null,
      dco_mg_l: null,
      mes_mg_l: null,
      mvs_pct: null,
      nitrates_mg_l: null,
      ammonium_mg_l: null,
      azote_total_mg_l: null,
      phosphates_mg_l: null,
      coliformes_fecaux_cfu_100ml: null,
      oeufs_helminthes: null,
      huiles_graisses: null,
      nom_feuille: options.sheetName || '',
      contient_valeurs_estimees: false
    };

    // Mapper les colonnes
    for (const [rawKey, value] of Object.entries(rawRow)) {
      if (value === null || value === undefined) continue;

      const mappedKey = COLUMN_MAPPING[rawKey] || this.smartColumnMapping(rawKey);
      if (!mappedKey) continue;

      // Traiter selon le type
      if (mappedKey === 'date') {
        doc[mappedKey] = this.formatDate(value);
      } else if (mappedKey === 'mois') {
        doc[mappedKey] = String(value).trim();
      } else if (mappedKey === 'phase') {
        doc[mappedKey] = this.normalizePhase(value);
      } else if (NUMERIC_FIELDS.includes(mappedKey as any)) {
        doc[mappedKey] = this.parseNumericValue(value);
      } else if (mappedKey === 'contient_valeurs_estimees') {
        doc[mappedKey] = this.parseBooleanValue(value);
      } else if (['id_station', 'type_filtre', 'id_filtre', 'nom_feuille'].includes(mappedKey)) {
        doc[mappedKey] = String(value).trim();
      }
    }

    // Extraire le mois de la date si absent
    if (doc.date && !doc.mois) {
      doc.mois = this.extractMonth(doc.date);
    }

    return doc as WaterQualityDocument;
  }

  /**
   * Mapping intelligent des colonnes
   */
  private smartColumnMapping(rawKey: string): string {
    const normalized = rawKey.toLowerCase().trim();
    
    // Mapping par mots-clés
    if (normalized.includes('mois')) return 'mois';
    if (normalized === 'data' || normalized === 'date') return 'date';
    if (normalized.includes('temperature') || normalized.includes('température')) return 'temperature_c';
    if (normalized === 'ph') return 'ph';
    if (normalized.includes('conductivite') || normalized.includes('conductivité') || normalized.includes('ce')) return 'conductivite_us_cm';
    if (normalized.includes('redox') || normalized.includes('potentiel')) return 'potentiel_redox_mv';
    if (normalized.includes('dbo')) return 'dbo5_mg_l';
    if (normalized.includes('dco')) return 'dco_mg_l';
    if (normalized.includes('mes') || normalized.includes('matière')) return 'mes_mg_l';
    if (normalized.includes('mvs')) return 'mvs_pct';
    if (normalized.includes('nitrate')) return 'nitrates_mg_l';
    if (normalized.includes('ammonium') || normalized.includes('nh4')) return 'ammonium_mg_l';
    if (normalized.includes('azote') && normalized.includes('total')) return 'azote_total_mg_l';
    if (normalized.includes('phosphate') || normalized.includes('po4')) return 'phosphates_mg_l';
    if (normalized.includes('coliforme')) return 'coliformes_fecaux_cfu_100ml';
    if (normalized.includes('helminthe') || normalized.includes('oeuf')) return 'oeufs_helminthes';
    if (normalized.includes('huile') || normalized.includes('graisse')) return 'huiles_graisses';
    
    return '';
  }

  /**
   * Valide un document
   */
  private validateDocument(doc: any, strict: boolean = false): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (!doc[field]) {
        errors.push(`Champ obligatoire manquant: ${field}`);
      }
    }

    if (strict) {
      if (doc.phase && !['Entree', 'Sortie'].includes(doc.phase)) {
        errors.push(`Phase invalide: ${doc.phase}`);
      }

      for (const field of NUMERIC_FIELDS) {
        const value = doc[field];
        if (value !== null && value !== undefined && typeof value !== 'number') {
          errors.push(`${field} doit être numérique`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private parseNumericValue(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    // Gérer notation scientifique Excel (ex: 3.67E+06)
    if (typeof value === 'string') {
      value = value.replace(',', '.').trim();
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  private parseBooleanValue(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return ['true', 'oui', 'yes', '1', 'vrai'].includes(lower);
    }
    return Boolean(value);
  }

  private normalizePhase(value: any): 'Entree' | 'Sortie' {
    const str = String(value).toLowerCase().trim();
    if (str.includes('sortie') || str.includes('output')) return 'Sortie';
    return 'Entree';
  }

  
private formatDate(value: any): string {
  if (!value) return '';

  try {
    let date: Date;

    // Si c'est déjà une string au format DD/MM/YYYY
    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      const parts = value.split(/[\/,\s:]+/);
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Les mois JS commencent à 0
      const year = parseInt(parts[2]);
      date = new Date(year, month, day, 0, 0, 0);
    }
    // Si c'est un nombre Excel (jours depuis 1900)
    else if (typeof value === 'number') {
      const excelDate = XLSX.SSF.parse_date_code(value);
      date = new Date(excelDate.y, excelDate.m - 1, excelDate.d, 0, 0, 0);
    }
    // Si c'est déjà un objet Date
    else if (value instanceof Date) {
      date = value;
    }
    // Sinon, essayer de parser
    else {
      date = new Date(value);
    }

    // Vérifier que la date est valide
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Date invalide:', value);
      return '';
    }

    // Retourner au format ISO 8601
    return date.toISOString();

  } catch (error) {
    console.error('❌ Erreur formatage date:', error, 'Valeur:', value);
    return '';
  }
}
  private extractMonth(dateStr: string): string {
    try {
      const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];

      if (dateStr.includes('/')) {
        const parts = dateStr.split(/[\/,]/);
        const monthNum = parseInt(parts[1]) - 1;
        return months[monthNum] || '';
      }

      return '';
    } catch {
      return '';
    }
  }

  /**
   * Parse CSV (conservé pour compatibilité)
   */
  parseCSV(fileContent: string, options: ParseOptions = {}): ParseResult {
    const result: ParseResult = {
      success: false,
      data: [],
      errors: [],
      warnings: [],
      stats: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        sheets: ['CSV']
      }
    };

    try {
      const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: options.skipEmptyRows !== false,
        dynamicTyping: false,
        transformHeader: (header: string) => header.trim()
      });

      if (parseResult.errors.length > 0) {
        parseResult.errors.forEach(err => {
          result.warnings.push(`CSV parsing warning: ${err.message}`);
        });
      }

      const rawData = parseResult.data as RawWaterQualityData[];

      for (let i = 0; i < rawData.length; i++) {
        const rowNumber = i + 2;
        result.stats.totalRows++;

        if (this.isEmptyOrStatRow(rawData[i])) {
          result.stats.invalidRows++;
          continue;
        }

        try {
          const document = this.mapRowToDocument(rawData[i], options);
          const validation = this.validateDocument(document, options.strictValidation);
          
          if (validation.isValid) {
            result.data.push(document);
            result.stats.validRows++;
          } else {
            result.stats.invalidRows++;
            result.errors.push(`Ligne ${rowNumber}: ${validation.errors.join(', ')}`);
          }
        } catch (error: any) {
          result.stats.invalidRows++;
          result.errors.push(`Ligne ${rowNumber}: ${error.message}`);
        }
      }

      result.success = result.data.length > 0;
      return result;
    } catch (error: any) {
      result.errors.push(`Erreur parsing CSV: ${error.message}`);
      return result;
    }
  }
}