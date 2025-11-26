import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CycleVieFiltre, KuzzleService } from '../../kuzzle.service';

@Component({
  selector: 'app-cycle-vie-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cycle-vie-widget.component.html',
  styleUrls: ['./cycle-vie-widget.component.css']
})
export class CycleVieWidgetComponent implements OnInit, OnChanges {
  @Input() filtreId!: string;
  @Input() compact: boolean = false;
  @Input() cycleVieData?: CycleVieFiltre | null; // ✅ NOUVEAU : Accepter les données directement

  cycleVie: CycleVieFiltre | null = null;
  loading: boolean = true;

  constructor(private kuzzleService: KuzzleService) {}

  ngOnInit() {
    this.loadCycleVie();
  }

  // ✅ Détecter les changements de cycleVieData
  ngOnChanges(changes: SimpleChanges) {
    if (changes['cycleVieData'] && this.cycleVieData) {
      this.cycleVie = this.cycleVieData;
      this.loading = false;
      console.log('✅ Widget reçu cycle de vie:', this.cycleVie);
    }
  }

  async loadCycleVie() {
    // Si les données sont déjà passées en Input, les utiliser
    if (this.cycleVieData) {
      this.cycleVie = this.cycleVieData;
      this.loading = false;
      console.log('✅ Widget utilise cycleVieData passé en Input');
      return;
    }

    // Sinon, charger depuis Kuzzle
    this.loading = true;
    console.log('🔍 Widget charge cycle vie pour:', this.filtreId);

    this.cycleVie = await this.kuzzleService.getCycleVieFiltre(this.filtreId);

    console.log('📊 Widget a chargé:', this.cycleVie);
    this.loading = false;
  }

  getEtatColor(etat: string): string {
    const colors: { [key: string]: string } = {
      'neuf': '#10b981',
      'bon': '#3b82f6',
      'moyen': '#f59e0b',
      'degrade': '#f97316',
      'critique': '#ef4444',
      'hors_service': '#6b7280'
    };
    return colors[etat] || '#6b7280';
  }

  getEtatIcon(etat: string): string {
    const icons: { [key: string]: string } = {
      'neuf': '✨',
      'bon': '✅',
      'moyen': '⚠️',
      'degrade': '🔴',
      'critique': '🚨',
      'hors_service': '❌'
    };
    return icons[etat] || '❓';
  }

  getEtatLabel(etat: string): string {
    const labels: { [key: string]: string } = {
      'neuf': 'Neuf',
      'bon': 'Bon état',
      'moyen': 'État moyen',
      'degrade': 'Dégradé',
      'critique': 'Critique',
      'hors_service': 'Hors service'
    };
    return labels[etat] || etat;
  }

  getJoursRestants(): number {
    if (!this.cycleVie?.jalons?.fin_vie_estimee) return 0;

    const finVie = new Date(this.cycleVie.jalons.fin_vie_estimee);
    const today = new Date();
    const diff = finVie.getTime() - today.getTime();

    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
