import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-sensor-injection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sensor-injection.component.html',
  styleUrl: './sensor-injection.component.css'
})
export class SensorInjectionComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  // --- CONFIGURATION ---
  apiUrl = 'http://localhost:8080/api/sensors';
  //
  notification = {
    show: false,
    type: 'success' as 'success' | 'error',
    title: '',
    message: ''
  };

  // --- ETATS DE L'INTERFACE ---
  isLoading = false;
  uploadProgress: string = '';
  selectedFile: File | null = null;

  // --- DONNÉES STATISTIQUES (Manquait précédemment) ---
  stats = {
    totalReadings: 0,
    totalWaterQuality: 0
  };

  // --- DONNÉES FORMULAIRE UNIQUE (Adapté à ton HTML) ---
  sensorData: any = {
    stationId: '',
    temperature: null,
    humidity: null,
    ph: null,
    turbidity: null,
    dissolvedOxygen: null,
    co2: null
  };

  // --- DONNÉES EXCEL ---
  excelData: any[] = [];
  excelColumns: string[] = [];
  defaultStationId: string = '';
  defaultPhase: string = 'ENTREE';
  defaultTypeFiltre: string = '';
  defaultIdFiltre: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadStats();
  }

  // =====================================================
  // 📊 STATISTIQUES ET UTILS
  // =====================================================

  loadStats() {
    this.http.get<any>(`${this.apiUrl}/stats`).subscribe({
      next: (data) => this.stats = data,
      error: () => console.log('Stats non disponibles')
    });
  }

  resetForm() {
    this.sensorData = {
      stationId: '',
      temperature: null,
      humidity: null,
      ph: null,
      turbidity: null,
      dissolvedOxygen: null,
      co2: null
    };
  }

  generateRandomData() {
    this.sensorData.stationId = 'STATION-TEST';
    this.sensorData.temperature = +(Math.random() * 10 + 20).toFixed(2);
    this.sensorData.humidity = +(Math.random() * 20 + 50).toFixed(2);
    this.sensorData.ph = +(Math.random() * 2 + 6).toFixed(2);
    this.sensorData.turbidity = +(Math.random() * 5).toFixed(2);
    this.sensorData.dissolvedOxygen = +(Math.random() * 4 + 4).toFixed(2);
    this.sensorData.co2 = Math.floor(Math.random() * 100 + 400);
  }

  // =====================================================
  // 🚀 INJECTION UNIQUE
  // =====================================================

  injectSingleSensor() {
    this.isLoading = true;
    this.http.post(`${this.apiUrl}/ingest`, this.sensorData).subscribe({
      next: () => {
        alert('✅ Donnée envoyée !');
        this.isLoading = false;
        this.loadStats();
      },
      error: (err) => {
        alert('❌ Erreur d\'envoi');
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  // =====================================================
  // 📂 GESTION EXCEL
  // =====================================================

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile = file;
    this.parseExcel(file);
  }

  parseExcel(file: File) {
    this.uploadProgress = '📖 Lecture du fichier...';
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        let headerRowIndex = jsonData.findIndex(row =>
          row.some(cell => cell && (String(cell).includes('Data') || String(cell).includes('Mois')))
        );

        if (headerRowIndex === -1) headerRowIndex = 0;

        const headers = jsonData[headerRowIndex];
        this.excelColumns = headers.filter(h => h);

       // --- METS CE BLOC À LA PLACE ---
          this.excelData = jsonData.slice(headerRowIndex + 1)
            .filter(row => row[1] && String(row[1]).trim() !== '') // On garde seulement si la colonne "Data" (index 1) est remplie
            .map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                if (header) obj[header] = row[index];
              });
              return obj;
            });
                  this.uploadProgress = `✅ ${this.excelData.length} lignes prêtes.`;
      } catch (error) {
        this.uploadProgress = '❌ Erreur de lecture.';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  uploadFile() {
  if (this.excelData.length === 0) {
    alert('⚠️ Aucune donnée à importer');
    return;
  }

  if (!this.defaultStationId || !this.defaultPhase) {
    alert('⚠️ Veuillez renseigner Station ID et Phase avant l\'import');
    return;
  }

  this.isLoading = true;
  this.uploadProgress = '📤 Envoi en masse...';

  const formattedData = this.excelData.map(row => ({
    ...this.transformExcelRow(row),
    typeFiltre: this.defaultTypeFiltre,
    idFiltre: this.defaultIdFiltre
  }));

  this.http.post(`${this.apiUrl}/ingest/batch`, { sensors: formattedData }).subscribe({
    next: (res: any) => {
      this.isLoading = false;

      // 🎉 ALERTE DE SUCCÈS
      alert(`✅ SUCCÈS !\n\n${formattedData.length} lignes ont été importées avec succès dans la station "${this.defaultStationId}"`);

      // Message visuel aussi
      this.uploadProgress = `✅ Import réussi ! ${formattedData.length} lignes ajoutées.`;

      this.loadStats();

      // Réinitialiser après 5 secondes
      setTimeout(() => {
        this.resetFile();
        this.uploadProgress = '';
      }, 5000);
    },
    error: (err) => {
      this.isLoading = false;

      // ❌ ALERTE D'ERREUR
      alert(`❌ ERREUR D'IMPORTATION\n\nImpossible d'envoyer les données au serveur.\n\nDétails: ${err.message || 'Erreur inconnue'}`);

      this.uploadProgress = '❌ Erreur d\'importation. Veuillez réessayer.';
      console.error('Erreur complète:', err);
    }
  });
}
showNotification(type: 'success' | 'error', title: string, message: string) {
    this.notification = { show: true, type, title, message };

    // Auto-fermeture après 5 secondes
    setTimeout(() => {
      this.closeNotification();
    }, 30000);
  }

  closeNotification() {
    this.notification.show = false;
  }
  transformExcelRow(row: any): any {
  return {
    stationId: this.defaultStationId,
    phase: this.defaultPhase,
    // Gestion de la date
    date: this.findValue(row, ['data', 'date', 'timestamp', 'moment']),

    // Paramètres Physico-chimiques (Synonymes)
    temperature: this.findValue(row, ['temp', 'ºC', 'temperature']),
    ph: this.findValue(row, ['ph']),
    conductivite: this.findValue(row, ['ce', 'cond', 'µS', 'conductivite', 'conductivité']),
    turbidite: this.findValue(row, ['turb', 'ntu', 'turbidité', 'turbidite']),
    dissolvedOxygen: this.findValue(row, ['oxygene', 'o2', 'dissous']),

    // Paramètres de pollution
    dbo5: this.findValue(row, ['dbo5', 'biologique']),
    dco: this.findValue(row, ['dco', 'chimique']),
    mes: this.findValue(row, ['mes', 'suspension']),

    // Nutriments et Bactério
    nitrates: this.findValue(row, ['nitrate', 'no3']),
    phosphates: this.findValue(row, ['phosphate', 'po4']),
    ammonium: this.findValue(row, ['ammonium', 'nh4']),
    coliformes_fecaux: this.findValue(row, ['coliforme', 'cfu', 'bactério', 'fecaux'])
  };
}

  findValue(row: any, keywords: string[]): any {
    const key = Object.keys(row).find(k =>
      keywords.some(word => k.toLowerCase().includes(word.toLowerCase()))
    );
    return key ? row[key] : null;
  }

  resetFile() {
    this.selectedFile = null;
    this.excelData = [];
    this.excelColumns = [];
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  // =====================================================
  // 💻 COMMANDES CURL (Pour ton HTML)
  // =====================================================

  getCurlCommand(): string {
    return `curl -X POST ${this.apiUrl}/ingest \\
-H "Content-Type: application/json" \\
-d '${JSON.stringify(this.sensorData)}'`;
  }

  copyCurlCommand() {
    navigator.clipboard.writeText(this.getCurlCommand());
    alert('Commande copiée !');
  }
}
