import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService, User } from '../../auth.service';
import { Router } from '@angular/router';

interface Station {
  _id: string;
  _source?: {
    name: string;
    location: {
      lat: number;
      lon: number;
    };
    status: 'active' | 'inactive';
    type: 'mobile' | 'fixed';
    installedAt: string;
    region?: string;
  };
  body?: any;
  name?: string;
  location?: any;
  status?: any;
  type?: any;
  installedAt?: any;
  region?: string;
}

@Component({
  selector: 'app-stations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './stations.component.html',
  styleUrls: ['./stations.component.css']
})
export class StationsComponent implements OnInit {
  @Output() stationCreated = new EventEmitter<Station>();
  @Output() stationUpdated = new EventEmitter<Station>();

  stations: Station[] = [];
  filteredStations: Station[] = [];
  regionsList: string[] = [];
  selectedRegion: string = '';

  isLoading = true;
  showAddModal = false;
  showEditModal = false;
  showAuthModal = false;
  showAdminAuthModal = false;

  stationForm: FormGroup;
  authForm: FormGroup;
  adminAuthForm: FormGroup;

  isSubmitting = false;
  isAuthenticating = false;
  isAdminAuthenticating = false;

  errorMessage = '';
  successMessage = '';
  authErrorMessage = '';
  adminAuthErrorMessage = '';

  currentEditingStation: Station | null = null;
  selectedStationForAuth: Station | null = null;
  isEditing = false;

  currentUser: User | null = null;
  isAdmin = false;

  // Régions du Sénégal avec coordonnées
  regions = [
    { name: 'Dakar', lat: 14.6928, lon: -17.4467 },
    { name: 'Thiès', lat: 14.7914, lon: -16.9256 },
    { name: 'Saint-Louis', lat: 16.0179, lon: -16.4896 },
    { name: 'Ziguinchor', lat: 12.5833, lon: -16.2667 },
    { name: 'Kaolack', lat: 14.146, lon: -16.0726 },
    { name: 'Louga', lat: 15.6144, lon: -16.2286 },
    { name: 'Tambacounda', lat: 13.7699, lon: -13.6673 },
    { name: 'Kolda', lat: 12.8833, lon: -14.95 },
    { name: 'Matam', lat: 15.6559, lon: -13.2559 },
    { name: 'Fatick', lat: 14.3396, lon: -16.4117 },
    { name: 'Diourbel', lat: 14.655, lon: -16.2314 },
    { name: 'Kédougou', lat: 12.55, lon: -12.1833 },
    { name: 'Sédhiou', lat: 12.7081, lon: -15.5569 },
    { name: 'Kaffrine', lat: 14.1167, lon: -15.7 }
  ];

  constructor(
    private kuzzleService: KuzzleService,
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Formulaire de station
    this.stationForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      region: ['', Validators.required],
      latitude: [{ value: '', disabled: false }, [Validators.required, Validators.min(-90), Validators.max(90)]],
      longitude: [{ value: '', disabled: false }, [Validators.required, Validators.min(-180), Validators.max(180)]],
      status: ['active', Validators.required],
      type: ['mobile', Validators.required]
    });

    // Auto-remplir les coordonnées quand une région est sélectionnée (seulement pour l'ajout)
    this.stationForm.get('region')?.valueChanges.subscribe(regionName => {
      if (!this.isEditing) {
        const region = this.regions.find(r => r.name === regionName);
        if (region) {
          this.stationForm.patchValue({
            latitude: region.lat,
            longitude: region.lon
          });
        }
      }
    });

    // Formulaire d'authentification utilisateur
    this.authForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Formulaire d'authentification admin
    this.adminAuthForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.loadStations();
    this.checkCurrentUser();
    this.checkAuthentication();

  }

  // ============================================================================
  // GESTION DE L'AUTHENTIFICATION
  // ============================================================================
  private checkAuthentication(): void {
    if (!this.authService.isAuthenticated()) {
      console.log('🔐 Utilisateur non authentifié, redirection vers auth...');
      this.router.navigate(['/auth'], {
        queryParams: { redirect: 'stations' }
      });
      return;
    }
    console.log('✅ Utilisateur authentifié, accès autorisé aux stations');
  }

  private checkCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.isAdmin = this.currentUser?.role === 'admin';
    console.log('🔐 Utilisateur actuel:', this.currentUser);
    console.log('👑 Est admin:', this.isAdmin);
  }

  /**
   * ✅ OUVERTURE MODAL AUTHENTIFICATION ADMIN
   */
  openAdminAuthModal(action: 'add' | 'edit' | 'delete', station?: Station): void {
    console.log('🔐 Ouverture modal auth admin pour:', action);

    if (station) {
      this.currentEditingStation = station;
    }

    // Stocker l'action à effectuer après authentification
    sessionStorage.setItem('pendingAdminAction', action);

    this.showAdminAuthModal = true;
    this.adminAuthForm.reset();
    this.adminAuthErrorMessage = '';
  }

  /**
   * ✅ FERMETURE MODAL AUTHENTIFICATION ADMIN
   */
  closeAdminAuthModal(): void {
    this.showAdminAuthModal = false;
    this.adminAuthForm.reset();
    this.adminAuthErrorMessage = '';
    sessionStorage.removeItem('pendingAdminAction');
  }

  /**
   * ✅ SOUMISSION AUTHENTIFICATION ADMIN
   */
  async onAdminAuthSubmit(): Promise<void> {
    console.log('🔐 Soumission auth admin...');

    if (this.adminAuthForm.invalid) {
      console.error('❌ Formulaire admin invalide');
      return;
    }

    this.isAdminAuthenticating = true;
    this.adminAuthErrorMessage = '';

    try {
      const { email, password } = this.adminAuthForm.value;

      console.log('📧 Email admin:', email);

      const result = await this.authService.login(email, password);

      if (result.success && result.user) {
        console.log('✅ Authentification admin réussie:', result.user);
        this.currentUser = result.user;
        this.isAdmin = result.user.role === 'admin';

        if (this.isAdmin) {
          this.closeAdminAuthModal();
          this.executePendingAdminAction();
        } else {
          this.adminAuthErrorMessage = 'Accès refusé : droits administrateur requis';
        }
      } else {
        this.adminAuthErrorMessage = result.message || 'Erreur d\'authentification';
      }

    } catch (error) {
      console.error('❌ Erreur auth admin:', error);
      this.adminAuthErrorMessage = 'Erreur de connexion. Veuillez réessayer.';
    } finally {
      this.isAdminAuthenticating = false;
    }
  }

  /**
   * ✅ EXÉCUTION ACTION ADMIN APRÈS AUTH
   */
  private executePendingAdminAction(): void {
    const action = sessionStorage.getItem('pendingAdminAction');
    console.log('🎯 Exécution action admin:', action);

    switch (action) {
      case 'add':
        this.openAddModalAfterAuth();
        break;
      case 'edit':
        if (this.currentEditingStation) {
          this.openEditModalAfterAuth(this.currentEditingStation);
        }
        break;
      case 'delete':
        if (this.currentEditingStation) {
          this.deleteStationAfterAuth(this.currentEditingStation._id);
        }
        break;
    }

    sessionStorage.removeItem('pendingAdminAction');
  }

  /**
   * ✅ OUVERTURE MODAL AJOUT APRÈS AUTH
   */
  private openAddModalAfterAuth(): void {
    this.isEditing = false;
    this.showAddModal = true;
    this.stationForm.reset({ status: 'active', type: 'mobile' });
    this.stationForm.get('latitude')?.disable();
    this.stationForm.get('longitude')?.disable();
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * ✅ OUVERTURE MODAL ÉDITION APRÈS AUTH
   */
  private openEditModalAfterAuth(station: Station): void {
    this.isEditing = true;
    this.currentEditingStation = station;
    this.showEditModal = true;

    const stationData = this.getStationData(station);

    this.stationForm.patchValue({
      name: stationData.name,
      region: stationData.region || this.getStationRegion(station),
      latitude: stationData.location?.lat || '',
      longitude: stationData.location?.lon || '',
      status: stationData.status || 'active',
      type: stationData.type || 'mobile'
    });

    this.stationForm.get('latitude')?.enable();
    this.stationForm.get('longitude')?.enable();
    this.errorMessage = '';
    this.successMessage = '';

    console.log('📝 Ouverture modal édition après auth:', station);
  }

  /**
   * ✅ SUPPRESSION APRÈS AUTH
   */
  private async deleteStationAfterAuth(stationId: string): Promise<void> {
    try {
      await this.kuzzleService.deleteStation(stationId);
      this.successMessage = 'Station supprimée avec succès !';
      this.notifyMapDirectly({ _id: stationId }, 'STATION_DELETED');
      await this.loadStations();

      setTimeout(() => {
        this.successMessage = '';
      }, 3000);

    } catch (error) {
      console.error('❌ Erreur suppression station:', error);
      this.errorMessage = 'Erreur lors de la suppression. Veuillez réessayer.';
    }
  }

  // ============================================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================================

  async loadStations(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('🔄 Chargement des stations...');
      const stations = await this.kuzzleService.getStations();
      console.log('📦 Stations brutes récupérées:', stations.length);

      // Transformation des données pour uniformiser la structure
      this.stations = stations.map((station: any) => {
        if (station._source) {
          return {
            _id: station._id,
            _source: station._source,
            region: station._source.region || this.extractRegionFromName(station._source.name)
          };
        } else if (station.body) {
          return {
            _id: station._id,
            _source: station.body,
            region: station.body.region || this.extractRegionFromName(station.body.name)
          };
        } else {
          return {
            _id: station._id,
            _source: {
              name: station.name,
              location: station.location,
              status: station.status,
              type: station.type,
              installedAt: station.installedAt,
              region: station.region
            },
            region: station.region || this.extractRegionFromName(station.name)
          };
        }
      });

      // Appliquer le filtre actuel si une région est sélectionnée
      if (this.selectedRegion) {
        this.filterByRegion();
      } else {
        this.filteredStations = [...this.stations];
      }

      this.extractRegionsList();

      console.log('✅ Stations chargées:', this.stations.length);
      console.log('🎯 Stations filtrées:', this.filteredStations.length);

      // Vérifier le nombre total dans Kuzzle
      const totalCount = await this.kuzzleService.countStations();
      if (totalCount !== this.stations.length) {
        console.warn(`⚠️ ATTENTION: Kuzzle a ${totalCount} stations mais seulement ${this.stations.length} ont été chargées!`);
      }

    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
      this.errorMessage = 'Impossible de charger les stations. Veuillez réessayer.';
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================================
  // GESTION DES MODALS
  // ============================================================================

  openAddModal(): void {
    if (!this.isAdmin) {
      this.openAdminAuthModal('add');
      return;
    }
    this.openAddModalAfterAuth();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.stationForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
  }

  openEditModal(station: Station): void {
    if (!this.canEdit()) {
      this.openAdminAuthModal('edit', station);
      return;
    }
    this.openEditModalAfterAuth(station);
  }

  closeEditModal(): void {
    this.isEditing = false;
    this.showEditModal = false;
    this.currentEditingStation = null;
    this.stationForm.reset();
    this.stationForm.get('latitude')?.disable();
    this.stationForm.get('longitude')?.disable();
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * ✅ GESTION DU DOUBLE-CLIC SUR UNE STATION
   */
  onStationDoubleClick(station: Station): void {
    console.log('🔥 =================================');
    console.log('🔥 DOUBLE CLIC DÉTECTÉ');
    console.log('🔥 Station:', station);
    console.log('🔥 Station ID:', station._id);
    console.log('🔥 =================================');

    const stationData = this.getStationData(station);
    const stationName = stationData.name || station._id;

    console.log('📍 Nom de la station:', stationName);

    // Vérifier si c'est la station Sanar (la seule avec des données)
    if (!stationName.toLowerCase().includes('sanar')) {
      console.warn('⚠️ Station sans données:', stationName);

      const confirmAccess = confirm(
        `⚠️ ATTENTION\n\n` +
        `La station "${stationName}" n'a pas encore de données disponibles.\n\n` +
        `Seule la station Sanar est actuellement opérationnelle.\n\n` +
        `Voulez-vous quand même essayer d'accéder à cette station ?`
      );

      if (!confirmAccess) {
        console.log('❌ Accès annulé par l\'utilisateur');
        return;
      }
    }

    // Ouvrir le modal d'authentification
    console.log('🔐 Ouverture du modal d\'authentification...');
    this.openAuthModal(station);
  }

  /**
   * ✅ OUVRIR LE MODAL D'AUTHENTIFICATION
   */
  openAuthModal(station: Station): void {
    console.log('🔐 openAuthModal appelée');
    console.log('📍 Station sélectionnée:', station);

    this.selectedStationForAuth = station;
    this.showAuthModal = true;
    this.authForm.reset();
    this.authErrorMessage = '';

    console.log('✅ Modal d\'authentification affiché');
    console.log('✅ showAuthModal =', this.showAuthModal);
    console.log('✅ selectedStationForAuth =', this.selectedStationForAuth);
  }

  /**
   * ✅ FERMER LE MODAL D'AUTHENTIFICATION
   */
  closeAuthModal(): void {
    console.log('❌ Fermeture du modal d\'authentification');

    this.showAuthModal = false;
    this.selectedStationForAuth = null;
    this.authForm.reset();
    this.authErrorMessage = '';
  }

  /**
   * ✅ SOUMETTRE L'AUTHENTIFICATION
   */
  async onAuthSubmit(): Promise<void> {
    console.log('🔐 =================================');
    console.log('🔐 SOUMISSION FORMULAIRE AUTH');
    console.log('🔐 =================================');

    if (this.authForm.invalid || !this.selectedStationForAuth) {
      console.error('❌ Formulaire invalide ou pas de station sélectionnée');
      console.log('Formulaire valide:', this.authForm.valid);
      console.log('Station sélectionnée:', this.selectedStationForAuth);
      return;
    }

    this.isAuthenticating = true;
    this.authErrorMessage = '';

    try {
      const { email, password } = this.authForm.value;
      const stationId = this.selectedStationForAuth._id;

      console.log('📧 Email:', email);
      console.log('🏢 Station ID:', stationId);

      const result = await this.authService.authenticateForStation(stationId, email, password);

      console.log('📊 Résultat authentification:', result);

      if (result.success) {
        console.log('✅ =============================');
        console.log('✅ AUTHENTIFICATION RÉUSSIE');
        console.log('✅ Utilisateur:', result.user);
        console.log('✅ =============================');

        this.closeAuthModal();
        this.successMessage = result.message;

        console.log('⏳ Redirection dans 1 seconde...');

        setTimeout(() => {
          console.log('🚀 Redirection vers /filtres pour station:', stationId);
          this.navigateToStationDashboard(stationId);
        }, 1000);

      } else {
        console.error('❌ Authentification échouée:', result.message);
        this.authErrorMessage = result.message;
      }

    } catch (error) {
      console.error('❌ ERREUR CRITIQUE:', error);
      this.authErrorMessage = 'Erreur de connexion. Veuillez réessayer.';
    } finally {
      this.isAuthenticating = false;
    }
  }

  /**
   * ✅ NAVIGUER VERS LE DASHBOARD DE LA STATION
   */
  private navigateToStationDashboard(stationId: string): void {
    console.log('🗺️ Navigation vers le dashboard de la station:', stationId);

    this.router.navigate(['/filtres'], {
      queryParams: { station: stationId }
    }).then(success => {
      if (success) {
        console.log('✅ Navigation réussie vers /filtres');
      } else {
        console.error('❌ Échec de la navigation');
      }
    }).catch(err => {
      console.error('❌ Erreur lors de la navigation:', err);
    });
  }

  // ============================================================================
  // GESTION DES FORMULAIRES
  // ============================================================================

  async onSubmit(): Promise<void> {
    console.log('🔍 Début onSubmit - Formulaire valide:', this.stationForm.valid);
    console.log('📝 Mode:', this.isEditing ? 'ÉDITION' : 'AJOUT');

    if (this.stationForm.invalid) {
      console.log('❌ Formulaire invalide');
      Object.keys(this.stationForm.controls).forEach(key => {
        const control = this.stationForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formValue = this.stationForm.getRawValue();
      console.log('✅ Données du formulaire:', formValue);

      if (this.isEditing && this.currentEditingStation) {
        await this.updateStation(formValue);
      } else {
        await this.createStation(formValue);
      }

    } catch (error: any) {
      console.error('❌ Erreur détaillée:', error);
      this.errorMessage = error.message ||
        `Erreur lors de ${this.isEditing ? 'la modification' : 'l\'ajout'} de la station. Veuillez réessayer.`;
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * ✅ CRÉER UNE NOUVELLE STATION
   */
  /**
 * ✅ VÉRIFIER SI L'UTILISATEUR PEUT MODIFIER
 */
canEdit(): boolean {
  if (!this.currentUser) return false;
  return this.currentUser.role === 'admin' || this.currentUser.role === 'supervisor';
}
canDelete(): boolean {
  if (!this.currentUser) return false;
  return this.currentUser.role === 'admin';
}

/**
 * ✅ VÉRIFIER SI L'UTILISATEUR PEUT AJOUTER
 */
canAdd(): boolean {
  if (!this.currentUser) return false;
  return this.currentUser.role === 'admin';
}
  private async createStation(formValue: any): Promise<void> {
    const regionName = formValue.region.toLowerCase().replace(/\s+/g, '-');
    const timestamp = Date.now();

    const newStation = {
      _id: `station-${regionName}-${timestamp}`,
      body: {
        name: formValue.name,
        location: {
          lat: parseFloat(formValue.latitude),
          lon: parseFloat(formValue.longitude)
        },
        status: formValue.status,
        type: formValue.type,
        installedAt: new Date().toISOString(),
        region: formValue.region
      }
    };

    console.log('🚀 Station à créer:', newStation);

    const createdStation = await this.kuzzleService.createStation(newStation);
    console.log('✅ Station créée dans Kuzzle:', createdStation);

    this.stationCreated.emit(newStation as any);
    this.notifyMapDirectly(newStation, 'NEW_STATION');

    this.successMessage = '✅ Station ajoutée avec succès !';

    console.log('⏳ Attente de l\'indexation Kuzzle...');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('🔄 Rechargement de la liste des stations...');
    await this.loadStations();

    setTimeout(() => {
      this.closeAddModal();
      this.successMessage = '';
    }, 1500);
  }

  /**
   * ✅ METTRE À JOUR UNE STATION
   */
  private async updateStation(formValue: any): Promise<void> {
    if (!this.currentEditingStation) {
      throw new Error('Aucune station à modifier');
    }

    const stationId = this.currentEditingStation._id;

    const updatedStation = {
      name: formValue.name,
      location: {
        lat: parseFloat(formValue.latitude),
        lon: parseFloat(formValue.longitude)
      },
      status: formValue.status,
      type: formValue.type,
      region: formValue.region
    };

    console.log('🔄 Station à mettre à jour:', stationId, updatedStation);

    const result = await this.kuzzleService.updateStation(stationId, updatedStation);
    console.log('✅ Station mise à jour dans Kuzzle:', result);

    this.stationUpdated.emit({ _id: stationId, ...updatedStation } as any);
    this.notifyMapDirectly({ _id: stationId, body: updatedStation }, 'STATION_UPDATED');

    this.successMessage = '✅ Station modifiée avec succès !';

    console.log('🔄 Rechargement de la liste des stations...');
    await this.loadStations();

    setTimeout(() => {
      this.closeEditModal();
      this.successMessage = '';
    }, 1500);
  }

  /**
   * ✅ SUPPRIMER UNE STATION
   */
  async deleteStation(stationId: string): Promise<void> {
    if (!this.isAdmin) {
      const station = this.stations.find(s => s._id === stationId);
      if (station) {
        this.openAdminAuthModal('delete', station);
      }
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette station ?')) {
      return;
    }

    await this.deleteStationAfterAuth(stationId);
  }

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  private notifyMapDirectly(station: any, eventType: string): void {
    window.dispatchEvent(new CustomEvent('stationEvent', {
      detail: {
        type: eventType,
        station: station,
        timestamp: Date.now()
      }
    }));

    const stationEvent = {
      type: eventType,
      station: station,
      timestamp: Date.now()
    };
    localStorage.setItem('stationEvent', JSON.stringify(stationEvent));
    console.log('📢 Carte notifiée:', eventType);
  }

  getStationData(station: Station): any {
    return station._source || station.body || station;
  }

  private extractRegionFromName(name: string): string {
    if (!name) return 'Dakar';
    const regions = this.regions.map(r => r.name);
    for (const region of regions) {
      if (name.toLowerCase().includes(region.toLowerCase())) {
        return region;
      }
    }
    return 'Dakar';
  }

  private extractRegionsList(): void {
    const allRegions = this.stations
      .map(station => station.region)
      .filter((region): region is string =>
        region !== undefined && region !== null && region.trim() !== ''
      );
    this.regionsList = [...new Set(allRegions)].sort();
    console.log('📍 Régions disponibles:', this.regionsList);
  }

  filterByRegion(): void {
    if (!this.selectedRegion) {
      this.filteredStations = [...this.stations];
    } else {
      this.filteredStations = this.stations.filter(station => {
        const stationRegion = this.getStationRegion(station);
        return stationRegion === this.selectedRegion;
      });
    }
    console.log(`🔍 Filtrage région "${this.selectedRegion}": ${this.filteredStations.length} stations`);
  }

  getStationName(station: Station): string {
    if (station._source) return station._source.name;
    if (station.body) return station.body.name;
    return station.name || 'Nom inconnu';
  }

  getStationStatus(station: Station): string {
    if (station._source) return station._source.status;
    if (station.body) return station.body.status;
    return station.status || 'active';
  }

  getStationType(station: Station): string {
    if (station._source) return station._source.type;
    if (station.body) return station.body.type;
    return station.type || 'fixed';
  }

  getStationInstalledAt(station: Station): string {
    if (station._source) return station._source.installedAt;
    if (station.body) return station.body.installedAt;
    return station.installedAt || new Date().toISOString();
  }

  getStationRegion(station: Station): string {
    if (station.region) return station.region;
    if (station._source && station._source.region) return station._source.region;
    if (station.body && station.body.region) return station.body.region;
    const name = this.getStationName(station);
    return this.extractRegionFromName(name) || 'Non spécifiée';
  }

  getTotalStationsCount(): number {
    return this.stations.length;
  }

  getActiveStationsCount(): number {
    return this.stations.filter(station =>
      this.getStationStatus(station) === 'active'
    ).length;
  }

  getInactiveStationsCount(): number {
    return this.stations.filter(station =>
      this.getStationStatus(station) === 'inactive'
    ).length;
  }

  getFixedStationsCount(): number {
    return this.stations.filter(station =>
      this.getStationType(station) === 'fixed'
    ).length;
  }

  getMobileStationsCount(): number {
    return this.stations.filter(station =>
      this.getStationType(station) === 'mobile'
    ).length;
  }

  getStationCountByRegion(region: string): number {
    return this.stations.filter(station =>
      this.getStationRegion(station) === region
    ).length;
  }

  getTypeIcon(type: string): string {
    return type === 'fixed' ? 'bi-pin-map-fill' : 'bi-geo-alt-fill';
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Date inconnue';
    }
  }

  getStatusClass(status: string): string {
    return status === 'active' ? 'active' : 'inactive';
  }

  getRegionName(lat: number, lon: number): string {
    const region = this.regions.find(r =>
      Math.abs(r.lat - lat) < 0.1 && Math.abs(r.lon - lon) < 0.1
    );
    return region ? region.name : 'Localisation inconnue';
  }

/**
 * ✅ GETTER POUR LE NOM D'AFFICHAGE
 */
get displayName(): string {
  if (!this.currentUser) return 'Non connecté';
  return this.currentUser.name || this.currentUser.email || 'Utilisateur';
}

/**
 * ✅ GETTER POUR LE RÔLE D'AFFICHAGE
 */
get displayRole(): string {
  if (!this.currentUser) return 'Aucun rôle';
  return this.currentUser.role || 'Utilisateur';
}

  debugStations(): void {
    console.log('🔍 DEBUG STATIONS:');
    console.log('📊 Total stations:', this.stations.length);
    console.log('✅ Stations actives:', this.getActiveStationsCount());
    console.log('⏸️ Stations inactives:', this.getInactiveStationsCount());
    console.log('📍 Stations fixes:', this.getFixedStationsCount());
    console.log('🚗 Stations mobiles:', this.getMobileStationsCount());
    console.log('🎯 Stations filtrées:', this.filteredStations.length);

    this.stations.forEach((station, index) => {
      console.log(`📍 Station ${index + 1}:`, {
        id: station._id,
        name: this.getStationName(station),
        region: this.getStationRegion(station),
        status: this.getStationStatus(station),
        type: this.getStationType(station),
        hasSource: !!station._source,
        hasBody: !!station.body,
        structure: station
      });
    });
  }
}
