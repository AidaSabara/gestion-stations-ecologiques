// frontend/src/app/components/water-quality-injection/water-quality-injection.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WaterQualityService } from '../../water-quality.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-water-quality-injection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './water-quality-injection.component.html',
  styleUrls: ['./water-quality-injection.component.css']
})
export class WaterQualityInjectionComponent implements OnInit {
  // Gestion du fichier
  selectedFile: File | null = null;
  validatedData: any[] = [];
  sheetsProcessed: number = 0;
  previewData: any[] = [];
  previewHeaders: string[] = [];

  // Configuration obligatoire
  stationId: string = '';

  // État de l'upload
  uploadInProgress: boolean = false;
  uploadResult: any = null;

  constructor(private waterQualityService: WaterQualityService) {}

  ngOnInit(): void {
    console.log('💧 WaterQualityInjectionComponent initialisé');
  }

  /**
   * Gère la sélection du fichier
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Format de fichier non valide. Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    this.selectedFile = file;
    this.uploadResult = null;
    this.parseFileLocally(file);

    console.log('📁 Fichier sélectionné:', file.name);
  }

  /**
   * Parse le fichier localement pour l'aperçu
   * AMÉLIORÉ: Détection intelligente des en-têtes comme dans le backend
   */
  parseFileLocally(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        let allRows: any[] = [];
        let sheetsCount = 0;

        console.log(`📚 Fichier Excel: ${workbook.SheetNames.length} feuille(s)`);

        workbook.SheetNames.forEach(sheetName => {
          // Ignorer feuilles Instructions/Exemples
          if (this.shouldIgnoreSheet(sheetName)) {
            console.log(`⏭️ Feuille ignorée: "${sheetName}"`);
            return;
          }

          console.log(`🔍 Traitement feuille: "${sheetName}"`);

          const worksheet = workbook.Sheets[sheetName];

          // DÉTECTION INTELLIGENTE des en-têtes
          const analysisResult = this.analyzeWorksheet(worksheet);

          if (!analysisResult.headerFound) {
            console.warn(`⚠️ Feuille "${sheetName}": En-têtes non détectés`);
            return;
          }

          console.log(`✅ En-têtes trouvés à la ligne ${analysisResult.headerRowIndex + 1}`);
          console.log(`📊 Colonnes: ${analysisResult.validColumns.length}`);

          // Extraire les données à partir de la ligne suivant les en-têtes
          const cleanedData = this.extractDataFromWorksheet(
            worksheet,
            analysisResult.headerRowIndex
          );

          console.log(`📦 ${cleanedData.length} lignes extraites`);

          if (cleanedData.length > 0) {
            // Filtrer les lignes de statistiques
            const validData = cleanedData.filter(row => !this.isEmptyOrStatRow(row));
            allRows = [...allRows, ...validData];
            sheetsCount++;
          }
        });

        this.validatedData = allRows;
        this.sheetsProcessed = sheetsCount;
        this.previewData = allRows.slice(0, 10);

        if (allRows.length > 0) {
          this.previewHeaders = Object.keys(allRows[0]).filter(key =>
            !key.toUpperCase().includes('EMPTY') && key !== '-'
          );
        }

        console.log(`✅ Parsing terminé: ${allRows.length} lignes valides, ${sheetsCount} feuille(s)`);

      } catch (error) {
        console.error('❌ Erreur parsing:', error);
        alert('Erreur lors de la lecture du fichier.');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  /**
   * Vérifie si une feuille doit être ignorée
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
   * Analyse intelligente du worksheet pour trouver les en-têtes
   * (Même logique que le backend)
   */
  private analyzeWorksheet(worksheet: XLSX.WorkSheet): {
    headerFound: boolean;
    headerRowIndex: number;
    validColumns: string[];
  } {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Mots-clés essentiels pour identifier les en-têtes
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

        if (essentialKeywords.some(keyword => normalized.includes(keyword))) {
          keywordMatches++;
          validColumns.push(cell.trim());
        } else if (normalized.length > 2 && !this.isLikelyDecorative(cell)) {
          validColumns.push(cell.trim());
        }
      }

      // Si on trouve au moins 4 mots-clés et 6 colonnes valides
      if (keywordMatches >= 4 && validColumns.length >= 6) {
        return {
          headerFound: true,
          headerRowIndex: row,
          validColumns
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
   * Extrait les données à partir de la ligne suivant les en-têtes
   */
  private extractDataFromWorksheet(
    worksheet: XLSX.WorkSheet,
    headerRowIndex: number
  ): any[] {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const data: any[] = [];

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
      const rowData: any = {};
      let hasData = false;

      for (let col = range.s.c; col <= range.e.c; col++) {
        const columnName = columnMapping.get(col);
        if (!columnName) continue;

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
  private isEmptyOrStatRow(row: any): boolean {
    if (!row || typeof row !== 'object') return true;

    // Vérifier si complètement vide
    const allEmpty = Object.values(row).every(value =>
      value === null ||
      value === undefined ||
      value === '' ||
      (typeof value === 'string' && value.trim() === '')
    );

    if (allEmpty) return true;

    // Détecter lignes de statistiques
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
   * Upload vers Kuzzle (utilise la méthode uploadFile du service)
   */
  uploadToKuzzle(): void {
    if (!this.selectedFile) {
      alert('Aucun fichier sélectionné');
      return;
    }

    if (!this.stationId || this.stationId.trim() === '') {
      alert('⚠️ Veuillez renseigner l\'ID de la station avant d\'importer');
      return;
    }

    if (this.validatedData.length === 0) {
      alert('Aucune donnée à importer');
      return;
    }

    this.uploadInProgress = true;
    this.uploadResult = null;

    // Options d'upload avec l'ID de la station
    const options = {
      strictValidation: false,
      defaultStation: this.stationId
    };

    console.log('🚀 Upload vers le backend avec station:', this.stationId);

    this.waterQualityService.uploadFile(this.selectedFile, options)
      .subscribe({
        next: (response: any) => {
          console.log('✅ Upload réussi:', response);
          this.uploadInProgress = false;
          this.uploadResult = response;

          if (response.success) {
            setTimeout(() => {
              this.resetForm();
            }, 5000);
          }
        },
        error: (error: any) => {
  console.error('❌ ERREUR COMPLÈTE:', error);
  console.error('❌ Status:', error.status);
  console.error('❌ Message:', error.error);
  console.error('❌ Error object:', JSON.stringify(error, null, 2));

  this.uploadInProgress = false;
  this.uploadResult = {
    success: false,
    message: error.error?.message || error.error?.error || error.message || 'Erreur inconnue',
    data: null
  };

  // Afficher l'erreur à l'utilisateur
  alert(`❌ Erreur: ${this.uploadResult.message}`);
}
      });
  }

  /**
   * Télécharge le template
   */
  downloadTemplate(): void {
    console.log('📥 Téléchargement du template...');
    this.waterQualityService.downloadTemplate();
  }

  /**
   * Réinitialise le formulaire
   */
  resetForm(): void {
    this.selectedFile = null;
    this.validatedData = [];
    this.sheetsProcessed = 0;
    this.previewData = [];
    this.previewHeaders = [];
    this.uploadResult = null;
    this.stationId = '';

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    console.log('🔄 Formulaire réinitialisé');
  }

  /**
   * Supprime le fichier sélectionné
   */
  removeFile(): void {
    this.resetForm();
  }
}
