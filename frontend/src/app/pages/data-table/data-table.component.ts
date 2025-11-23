import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';

// Angular Material
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface WaterQualityData {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre: string;
    id_filtre: string;
    ph: number;
    potentiel_redox_mv: number;
    dbo5_mg_l: number;
    dco_mg_l: number;
    mes_mg_l: number;
    nitrates_mg_l: number;
    ammonium_mg_l: number;
    azote_total_mg_l: number;
    phosphates_mg_l: number;
    coliformes_fecaux_cfu_100ml: number;
    nom_feuille: string;
    contient_valeurs_estimees: boolean;
  };
}

interface Station {
  _id: string;
  _source?: { name: string; [key: string]: any; };
  body?: { name: string; [key: string]: any; };
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.css']
})
export class DataTableComponent implements OnInit, AfterViewInit {
  waterData: WaterQualityData[] = [];
  allWaterData: WaterQualityData[] = [];
  dataSource = new MatTableDataSource<WaterQualityData>();
  isLoading = true;
  now: Date = new Date();

  // 👇 NOUVELLES PROPRIÉTÉS POUR STATION SPÉCIFIQUE
  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;
  private stations: Map<string, string> = new Map();

  // Filtres
  selectedPhase = 'all';
  selectedFilter = 'all';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'id_filtre',
    'phase',
    'ph',
    'dbo5_mg_l',
    'dco_mg_l',
    'mes_mg_l',
    'nitrates_mg_l',
    'ammonium_mg_l',
    'azote_total_mg_l',
    'phosphates_mg_l',
    'coliformes_fecaux_cfu_100ml'
  ];

  constructor(
    private kuzzleService: KuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    // 👇 RÉCUPÉRER LE STATION ID DEPUIS L'URL
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    console.log('📍 Station ID depuis URL:', this.stationId);

    await this.loadStations();

    // 👇 Récupérer le nom de la station si on est en mode spécifique
    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
    }

    await this.loadWaterQualityData();

    // Actualiser l'heure chaque seconde
    setInterval(() => {
      this.now = new Date();
    }, 1000);
  }

  // 👇 MÉTHODE POUR CHARGER LES STATIONS
  private async loadStations() {
    try {
      const stationsData = await this.kuzzleService.getStations();
      stationsData.forEach((station: Station) => {
        const source: { name?: string } = station._source || station.body || {};
        this.stations.set(station._id, source.name || station._id);
      });
      console.log('✅ Stations chargées:', this.stations.size);
    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
    }
  }

  // 👇 VÉRIFIER SI UNE DONNÉE APPARTIENT À LA STATION FILTRÉE
  private belongsToStation(dataStationId: string): boolean {
    if (!this.stationId) return true; // Pas de filtre = tout afficher
    return dataStationId === this.stationId;
  }

  ngAfterViewInit(): void {
    // Configuration du tableau Material
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }

    if (this.sort) {
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (item, property) => {
        if (!item || !item.body) return '';
        const value = item.body[property as keyof typeof item.body];
        if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        }
        if (value === null || value === undefined) {
          return '';
        }
        return value as string | number;
      };
    }

    this.dataSource.filterPredicate = (data: WaterQualityData, filter: string) => {
      if (!data || !data.body) return false;
      const searchStr = `
        ${data.body.id_filtre || ''}
        ${data.body.phase || ''}
        ${data.body.ph || ''}
        ${data.body.id_station || ''}
        ${data.body.type_filtre || ''}
      `.toLowerCase();
      return searchStr.indexOf(filter) !== -1;
    };
  }

  async loadWaterQualityData() {
    try {
      this.isLoading = true;
      console.log('🔄 Chargement données water_quality...');

      const results = await this.kuzzleService.getWaterQualityData();

      // 👇 FILTRER LES DONNÉES SI STATION SPÉCIFIQUE
      const filteredResults = results.filter((hit: any) => {
        const source = hit._source || hit.body || {};
        const dataStationId = source.id_station;
        return this.belongsToStation(dataStationId);
      });

      console.log(`📊 Données après filtrage station: ${filteredResults.length}/${results.length}`);

      // Formater les données
      this.allWaterData = filteredResults.map((hit: any) => {
        const source = hit._source || hit.body || {};
        return {
          _id: hit._id,
          body: {
            id_station: source.id_station,
            phase: source.phase,
            type_filtre: source.type_filtre,
            id_filtre: source.id_filtre,
            ph: source.ph,
            potentiel_redox_mv: source.potentiel_redox_mv,
            dbo5_mg_l: source.dbo5_mg_l,
            dco_mg_l: source.dco_mg_l,
            mes_mg_l: source.mes_mg_l,
            nitrates_mg_l: source.nitrates_mg_l,
            ammonium_mg_l: source.ammonium_mg_l,
            azote_total_mg_l: source.azote_total_mg_l,
            phosphates_mg_l: source.phosphates_mg_l,
            coliformes_fecaux_cfu_100ml: source.coliformes_fecaux_cfu_100ml,
            nom_feuille: source.nom_feuille,
            contient_valeurs_estimees: source.contient_valeurs_estimees
          }
        };
      });

      this.waterData = [...this.allWaterData];
      this.dataSource.data = this.waterData;

      console.log(`✅ ${this.waterData.length} enregistrements chargés pour la station`);

    } catch (error) {
      console.error('❌ Erreur chargement données qualité eau:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // 👇 MÉTHODE POUR RETOURNER À LA STATION
  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/map']);
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    console.log('🔍 Filtrage par texte:', filterValue);
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  filterByPhase(phase: string) {
    console.log('📊 Filtrage par phase:', phase);
    this.selectedPhase = phase;
    this.applyFilters();
  }

  filterByFilter(filterId: string) {
    console.log('🔧 Filtrage par filtre:', filterId);
    this.selectedFilter = filterId;
    this.applyFilters();
  }

  private applyFilters() {
    let filteredData = [...this.allWaterData];

    if (this.selectedPhase !== 'all') {
      filteredData = filteredData.filter(d => d && d.body && d.body.phase === this.selectedPhase);
    }

    if (this.selectedFilter !== 'all') {
      filteredData = filteredData.filter(d => d && d.body && d.body.id_filtre === this.selectedFilter);
    }

    this.waterData = filteredData;
    this.dataSource.data = this.waterData;
    console.log('🔍 Données filtrées:', this.waterData.length, 'éléments');
  }

  getUniqueFilters(): string[] {
    if (!this.allWaterData) return [];
    const validData = this.allWaterData.filter(d => d && d.body);
    return [...new Set(validData.map(d => d.body.id_filtre))];
  }

  getUniquePhases(): string[] {
    if (!this.allWaterData) return [];
    const validData = this.allWaterData.filter(d => d && d.body);
    return [...new Set(validData.map(d => d.body.phase))];
  }

  getValueClass(column: string, value: number): string {
    if (value === null || value === undefined) return '';

    const thresholds: { [key: string]: { low: number; high: number } } = {
      'ph': { low: 6.5, high: 8.5 },
      'dbo5_mg_l': { low: 5, high: 25 },
      'dco_mg_l': { low: 30, high: 125 },
      'mes_mg_l': { low: 5, high: 35 },
      'nitrates_mg_l': { low: 5, high: 25 },
      'ammonium_mg_l': { low: 0.5, high: 2 },
      'azote_total_mg_l': { low: 5, high: 15 },
      'phosphates_mg_l': { low: 1, high: 3 },
      'coliformes_fecaux_cfu_100ml': { low: 0, high: 100 }
    };

    const threshold = thresholds[column];
    if (!threshold) return '';

    if (column === 'ph') {
      return (value >= threshold.low && value <= threshold.high) ? 'normal-value' : 'high-value';
    } else {
      if (value <= threshold.low) return 'normal-value';
      if (value <= threshold.high) return 'medium-value';
      return 'high-value';
    }
  }

  getValueColor(column: string, value: number): string {
    const className = this.getValueClass(column, value);
    switch (className) {
      case 'normal-value': return 'text-success';
      case 'medium-value': return 'text-warning';
      case 'high-value': return 'text-danger';
      default: return '';
    }
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') return value.toFixed(1);
    return value.toString();
  }

  getPhaseClass(phase: string): string {
    return phase === 'Entrée' ? 'badge bg-warning' : 'badge bg-success';
  }

  exportData() {
    const validData = this.waterData.filter(item => item && item.body);
    const dataToExport = validData.map(item => ({
      Filtre: item.body.id_filtre,
      Phase: item.body.phase,
      Station: item.body.id_station,
      pH: item.body.ph,
      'DBO5 (mg/L)': item.body.dbo5_mg_l,
      'DCO (mg/L)': item.body.dco_mg_l,
      'MES (mg/L)': item.body.mes_mg_l,
      'Nitrates (mg/L)': item.body.nitrates_mg_l,
      'Ammonium (mg/L)': item.body.ammonium_mg_l,
      'Azote total (mg/L)': item.body.azote_total_mg_l,
      'Phosphates (mg/L)': item.body.phosphates_mg_l,
      'Coliformes (CFU/100ml)': item.body.coliformes_fecaux_cfu_100ml
    }));

    if (dataToExport.length === 0) {
      console.warn('⚠️ Aucune donnée à exporter');
      return;
    }

    const csv = this.convertToCSV(dataToExport);
    this.downloadCSV(csv, 'qualite_eau_export.csv');
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return header + '\n' + rows.join('\n');
  }

  private downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async refreshData() {
    console.log('🔄 Actualisation des données...');
    await this.loadWaterQualityData();
  }

  // Statistiques
  getWaterQualityStats() {
    if (!this.allWaterData || this.allWaterData.length === 0) return null;

    const validData = this.allWaterData.filter(d => d && d.body);

    return {
      totalSamples: validData.length,
      uniqueFilters: new Set(validData.map(d => d.body.id_filtre)).size,
      avgPH: this.calculateAverage('ph'),
      abnormalPH: validData.filter(d =>
        d.body.ph !== null && (d.body.ph < 6.5 || d.body.ph > 8.5)
      ).length,
      highColiformes: validData.filter(d =>
        d.body.coliformes_fecaux_cfu_100ml !== null &&
        d.body.coliformes_fecaux_cfu_100ml > 200
      ).length
    };
  }

  private calculateAverage(field: keyof WaterQualityData['body']): number {
    const validData = this.allWaterData.filter(d => d && d.body);
    const validValues = validData
      .map(d => d.body[field] as number)
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

}
