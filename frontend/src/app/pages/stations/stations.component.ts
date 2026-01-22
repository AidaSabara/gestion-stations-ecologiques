import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService } from '../../auth.service';
import { User } from '../../models/user.model';
import { Router } from '@angular/router';

interface StationCharacteristics {
  filterTypes: {
    type: string;
    quantity: number;
    installedDate?: string;
    lastMaintenance?: string;
  }[];
  plantedFilters: number;
  functionalFilters: number;
  dailyCapacity: number;
  numberOfTaps: number;
  operators: { name: string; role: string; contact?: string; }[];
  maintenanceHistory: { date: string; type: string; description: string; technician?: string; }[];
  hasPowerBackup: boolean;
  hasWaterStorage: boolean;
  storageCapacity?: number;
  accessRoad: 'good' | 'medium' | 'poor';
  distanceToMainRoad: number;
  lastInspection?: string;
  nextInspection?: string;
  notes?: string;
}
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
    characteristics?: StationCharacteristics;
  };
  body?: any;
  name?: string;
  location?: any;
  status?: any;
  type?: any;
  installedAt?: any;
  region?: string;
  characteristics?: StationCharacteristics;
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

  showCharacteristicsModal = false;
  selectedStationForCharacteristics: Station | null = null;
  characteristicsForm: FormGroup;
  isLoadingCharacteristics = false;


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
    filterTypeOptions = [
    'Filtre à sable',
    'Roseaux',
    'Vetiver',
    'Coco',
    'Substrat',
    'Coco',
    'Typha',
    'Autre'
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
      latitude: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
  longitude: ['', [Validators.required, Validators.min(-180), Validators.max(180)]],
  status: ['active', Validators.required],
  type: ['mobile', Validators.required]
    });

    // Auto-remplir les coordonnées quand une région est sélectionnée avec décalage aléatoire (seulement pour l'ajout)
this.stationForm.get('region')?.valueChanges.subscribe(regionName => {
    if (!this.isEditing) {
      const region = this.regions.find(r => r.name === regionName);
      if (region) {
        // Génération d'un décalage aléatoire entre 0.001° et 0.01° (≈ 110m à 1.1km)
        const randomOffsetLat = (Math.random() - 0.5) * 0.02;
        const randomOffsetLon = (Math.random() - 0.5) * 0.02;

        const newLat = region.lat + randomOffsetLat;
        const newLon = region.lon + randomOffsetLon;

        console.log('📍 Coordonnées auto-générées (modifiables):');
        console.log(`   Base: ${region.lat}, ${region.lon}`);
        console.log(`   Offset: ${randomOffsetLat.toFixed(4)}, ${randomOffsetLon.toFixed(4)}`);
        console.log(`   Proposition: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`);
        console.log('   💡 Vous pouvez modifier ces valeurs manuellement');

        // ✅ Remplir les champs SANS les désactiver
        this.stationForm.patchValue({
          latitude: parseFloat(newLat.toFixed(6)),
          longitude: parseFloat(newLon.toFixed(6))
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

    this.characteristicsForm = this.fb.group({
      filterTypes: this.fb.array([]),
      plantedFilters: [0, [Validators.min(0)]],
      functionalFilters: [0, [Validators.min(0)]],
      dailyCapacity: [0, [Validators.min(0)]],
      numberOfTaps: [0, [Validators.min(0)]],
      hasPowerBackup: [false],
      hasWaterStorage: [false],
      storageCapacity: [0],
      accessRoad: ['good'],
      distanceToMainRoad: [0, [Validators.min(0)]],
      lastInspection: [''],
      nextInspection: [''],
      notes: ['']
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
onAdminAuthSubmit(): void {
  console.log('🔐 Soumission auth admin...');

  if (this.adminAuthForm.invalid) {
    console.error('❌ Formulaire admin invalide');
    return;
  }

  this.isAdminAuthenticating = true;
  this.adminAuthErrorMessage = '';

  const { email, password } = this.adminAuthForm.value;
  console.log('📧 Email admin:', email);

  // ✅ UTILISER .subscribe() au lieu de await
  this.authService.login(email, password).subscribe({
    next: (result) => {
      console.log('📊 Résultat auth admin:', result);

      // ✅ Vérifier avec result.data?.user ou result.user
      const user = result.data?.user || result.user;

      if (result.success && user) {
        console.log('✅ Authentification admin réussie:', user);
        this.currentUser = user;
        this.isAdmin = user.role === 'admin';

        if (this.isAdmin) {
          this.closeAdminAuthModal();
          this.executePendingAdminAction();
        } else {
          this.adminAuthErrorMessage = 'Accès refusé : droits administrateur requis';
        }
      } else {
        this.adminAuthErrorMessage = result.message || 'Erreur d\'authentification';
      }

      this.isAdminAuthenticating = false;
    },
    error: (error) => {
      console.error('❌ Erreur auth admin:', error);
      this.adminAuthErrorMessage = error.message || 'Erreur de connexion. Veuillez réessayer.';
      this.isAdminAuthenticating = false;
    }
  });
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
    //this.stationForm.get('latitude')?.disable();
    //this.stationForm.get('longitude')?.disable();
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

  // 1. Remplir les infos de base
  this.stationForm.patchValue({
    name: stationData.name,
    region: stationData.region || this.getStationRegion(station),
    latitude: stationData.location?.lat || '',
    longitude: stationData.location?.lon || '',
    status: stationData.status || 'active',
    type: stationData.type || 'mobile'
  });

  // 2. Remplir les caractéristiques si elles existent
  const chars = stationData.characteristics;
  if (chars) {
    this.characteristicsForm.patchValue({
      plantedFilters: chars.plantedFilters || 0,
      functionalFilters: chars.functionalFilters || 0,
      dailyCapacity: chars.dailyCapacity || 0,
      numberOfTaps: chars.numberOfTaps || 0,
      hasPowerBackup: chars.hasPowerBackup || false,
      hasWaterStorage: chars.hasWaterStorage || false,
      storageCapacity: chars.storageCapacity || 0,
      accessRoad: chars.accessRoad || 'good',
      distanceToMainRoad: chars.distanceToMainRoad || 0,
      lastInspection: chars.lastInspection || '',
      nextInspection: chars.nextInspection || '',
      notes: chars.notes || ''
    });

    // Charger les types de filtres
    this.clearFilterTypes();
    if (chars.filterTypes && chars.filterTypes.length > 0) {
      chars.filterTypes.forEach((filter: any) => {
        this.addFilterType(filter);
      });
    }
  }

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
    //this.stationForm.get('latitude')?.disable();
    //this.stationForm.get('longitude')?.disable();
    this.errorMessage = '';
    this.successMessage = '';
  }
    canManageCharacteristics(): boolean {
  if (!this.currentUser) return false;
  // Seuls les admins peuvent ajouter/modifier les caractéristiques
  return this.currentUser.role === 'admin';
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
  onAuthSubmit(): void {  // ❌ SUPPRIMER async
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

  const { email, password } = this.authForm.value;
  const stationId = this.selectedStationForAuth._id;

  console.log('📧 Email:', email);
  console.log('🏢 Station ID:', stationId);

  // ✅ UTILISER .subscribe() au lieu de await
  this.authService.authenticateForStation(stationId, email, password).subscribe({
    next: (result) => {
      console.log('📊 Résultat authentification:', result);

      // ✅ Vérifier avec result.data?.user ou result.user
      const user = result.data?.user || result.user;

      if (result.success && user) {
        console.log('✅ =============================');
        console.log('✅ AUTHENTIFICATION RÉUSSIE');
        console.log('✅ Utilisateur:', user);
        console.log('✅ =============================');

        this.closeAuthModal();
        this.successMessage = result.message || 'Authentification réussie';

        console.log('⏳ Redirection dans 1 seconde...');

        setTimeout(() => {
          console.log('🚀 Redirection vers /filtres pour station:', stationId);
          this.navigateToStationDashboard(stationId);
        }, 1000);

      } else {
        console.error('❌ Authentification échouée:', result.message);
        this.authErrorMessage = result.message || 'Authentification échouée';
      }

      this.isAuthenticating = false;
    },
    error: (error) => {
      console.error('❌ ERREUR CRITIQUE:', error);
      this.authErrorMessage = error.message || 'Erreur de connexion. Veuillez réessayer.';
      this.isAuthenticating = false;
    }
  });
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
  /**
 * ✅ METTRE À JOUR UNE STATION (avec caractéristiques)
 */
private async updateStation(formValue: any): Promise<void> {
  if (!this.currentEditingStation) {
    throw new Error('Aucune station à modifier');
  }

  const stationId = this.currentEditingStation._id;

  // 1. Données de base
  const updatedStation: any = {
    name: formValue.name,
    location: {
      lat: parseFloat(formValue.latitude),
      lon: parseFloat(formValue.longitude)
    },
    status: formValue.status,
    type: formValue.type,
    region: formValue.region
  };

  // 2. Ajouter les caractéristiques
  const charsValue = this.characteristicsForm.value;
  updatedStation.characteristics = {
    filterTypes: charsValue.filterTypes || [],
    plantedFilters: charsValue.plantedFilters || 0,
    functionalFilters: charsValue.functionalFilters || 0,
    dailyCapacity: charsValue.dailyCapacity || 0,
    numberOfTaps: charsValue.numberOfTaps || 0,
    operators: [],
    maintenanceHistory: [],
    hasPowerBackup: charsValue.hasPowerBackup || false,
    hasWaterStorage: charsValue.hasWaterStorage || false,
    storageCapacity: charsValue.storageCapacity || 0,
    accessRoad: charsValue.accessRoad || 'good',
    distanceToMainRoad: charsValue.distanceToMainRoad || 0,
    lastInspection: charsValue.lastInspection || '',
    nextInspection: charsValue.nextInspection || '',
    notes: charsValue.notes || ''
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

 getStationData(station: any): any {
  if (!station) return {};

  // Cas 1 : Format avec _source (Kuzzle Search)
  if (station._source) return station._source;

  // Cas 2 : Format avec body (ton Interface actuelle)
  if (station.body) return station.body;

  // Cas 3 : Format à plat (création Front directe)
  // On retourne l'objet lui-même mais on enlève les propriétés système
  const { _id, _kuzzle_info, ...rest } = station;
  return rest;
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

  /**
   * Ouvre le modal des caractéristiques
   */
  openCharacteristicsModal(station: Station): void {
    console.log('📊 Ouverture des caractéristiques pour:', station);
    this.selectedStationForCharacteristics = station;
    this.showCharacteristicsModal = true;
    this.loadStationCharacteristics(station);
  }

  /**
   * Ferme le modal des caractéristiques
   */
  closeCharacteristicsModal(): void {
    this.showCharacteristicsModal = false;
    this.selectedStationForCharacteristics = null;
    this.characteristicsForm.reset({
      plantedFilters: 0,
      functionalFilters: 0,
      dailyCapacity: 0,
      numberOfTaps: 0,
      hasPowerBackup: false,
      hasWaterStorage: false,
      storageCapacity: 0,
      accessRoad: 'good',
      distanceToMainRoad: 0
    });
    this.clearFilterTypes();
  }

  /**
   * Charge les caractéristiques d'une station
   */
  private async loadStationCharacteristics(station: Station): Promise<void> {
    this.isLoadingCharacteristics = true;

    try {
      const stationData = this.getStationData(station);
      const chars = stationData.characteristics;

      if (chars) {
        this.characteristicsForm.patchValue({
          plantedFilters: chars.plantedFilters || 0,
          functionalFilters: chars.functionalFilters || 0,
          dailyCapacity: chars.dailyCapacity || 0,
          numberOfTaps: chars.numberOfTaps || 0,
          hasPowerBackup: chars.hasPowerBackup || false,
          hasWaterStorage: chars.hasWaterStorage || false,
          storageCapacity: chars.storageCapacity || 0,
          accessRoad: chars.accessRoad || 'good',
          distanceToMainRoad: chars.distanceToMainRoad || 0,
          lastInspection: chars.lastInspection || '',
          nextInspection: chars.nextInspection || '',
          notes: chars.notes || ''
        });

        if (chars.filterTypes && chars.filterTypes.length > 0) {
          chars.filterTypes.forEach((filter: any) => {
            this.addFilterType(filter);
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement caractéristiques:', error);
    } finally {
      this.isLoadingCharacteristics = false;
    }
  }

  /**
   * Sauvegarde les caractéristiques
   */
async saveCharacteristics(): Promise<void> {
  if (!this.selectedStationForCharacteristics || this.characteristicsForm.invalid) {
    return;
  }

  this.isSubmitting = true;

  try {
    const formValue = this.characteristicsForm.value;
    const stationId = this.selectedStationForCharacteristics._id;

    // 1. Préparer l'objet caractéristiques
    const characteristics: StationCharacteristics = {
      ...formValue,
      operators: [],
      maintenanceHistory: []
    };

    // 2. Récupérer les données actuelles de la station (nom, location, etc.)
    const currentData = this.getStationData(this.selectedStationForCharacteristics);

    // 3. Fusionner : On garde tout ce qu'il y avait, et on ajoute/écrase characteristics
    const updatedStation = {
      ...currentData,
      characteristics: characteristics
    };

    // 4. Envoyer à Kuzzle
    await this.kuzzleService.updateStation(stationId, updatedStation);

    this.successMessage = '✅ Caractéristiques sauvegardées !';
    await this.loadStations();

    setTimeout(() => {
      this.closeCharacteristicsModal();
      this.successMessage = '';
    }, 1500);

  } catch (error) {
    console.error('❌ Erreur:', error);
    this.errorMessage = 'Erreur lors de la sauvegarde.';
  } finally {
    this.isSubmitting = false;
  }
}
  /**
   * Gestion du FormArray des types de filtres
   */
  get filterTypesArray(): FormArray {
    return this.characteristicsForm.get('filterTypes') as FormArray;
  }

  addFilterType(data?: any): void {
    const filterGroup = this.fb.group({
      type: [data?.type || '', Validators.required],
      quantity: [data?.quantity || 1, [Validators.required, Validators.min(1)]],
      installedDate: [data?.installedDate || ''],
      lastMaintenance: [data?.lastMaintenance || '']
    });
    this.filterTypesArray.push(filterGroup);
  }

  removeFilterType(index: number): void {
    this.filterTypesArray.removeAt(index);
  }

  clearFilterTypes(): void {
    while (this.filterTypesArray.length > 0) {
      this.filterTypesArray.removeAt(0);
    }
  }

  /**
   * Vérifie si une station a des caractéristiques
   */
hasCharacteristics(station: Station): boolean {
  if (!station) return false; // Sécurité si la station est nulle

  const stationData = this.getStationData(station);

  // On vérifie que stationData existe ET qu'il possède des caractéristiques
  return !!(stationData && stationData.characteristics);
}
  /**
   * Calcule la santé d'une station (0-100%)
   */
 /**
 * Calcule la santé d'une station (0-100%)
 * Intègre la disponibilité technique, la maintenance et la qualité de l'eau
 */
calculateStationHealth(station: any, waterQualityData?: any[]): number {
  const stationData = this.getStationData(station);
  const chars = stationData?.characteristics;

  // Si aucune caractéristique n'est renseignée, on ne peut pas calculer de santé réelle
  if (!chars) return 0;

  let score = 0;
  const weights = { environnement: 40, technique: 30, maintenance: 30 };

  // --- 1. PERFORMANCE ENVIRONNEMENTALE (40 points) ---
  // On calcule l'efficacité réelle basée sur l'abattement de la pollution
  if (waterQualityData && waterQualityData.length > 0) {
    const rendementMoyen = this.calculateAverageEfficiency(waterQualityData);
    score += (rendementMoyen / 100) * weights.environnement;
  } else {
    // Score par défaut si pas de données d'analyse (pénalité pour manque de suivi)
    score += 10;
  }

  // --- 2. SANTÉ TECHNIQUE / FILTRES (30 points) ---
  // On utilise Number() pour s'assurer que les calculs ne foirent pas avec les inputs formulaires
  const fonctionnels = Number(chars.functionalFilters) || 0;
  const plantes = Number(chars.plantedFilters) || 0;
  const total = fonctionnels + plantes;

  if (total > 0) {
    const filterRatio = Math.min(fonctionnels / total, 1);
    score += filterRatio * weights.technique;
  }

  // --- 3. MAINTENANCE ET RÉSILIENCE (30 points) ---
  let maintenanceScore = 0;
  if (chars.lastInspection) {
    const daysSinceInspection = Math.floor(
      (Date.now() - new Date(chars.lastInspection).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceInspection < 30) maintenanceScore += 20;      // Très récent
    else if (daysSinceInspection < 90) maintenanceScore += 10; // Acceptable
  }

  // Bonus pour l'infrastructure
  if (chars.hasPowerBackup) maintenanceScore += 5;
  if (chars.hasWaterStorage) maintenanceScore += 5;

  score += maintenanceScore;

  // Retourne le score arrondi, bridé entre 0 et 100
  return Math.min(Math.max(Math.round(score), 0), 100);
}

/**
 * Calcule le rendement épuratoire moyen sur une série de mesures
 * Formule : ((Entrée - Sortie) / Entrée) * 100
 */
private calculateAverageEfficiency(data: any[]): number {
  if (!data || data.length === 0) return 0;

  // On ne garde que les mesures qui ont les deux valeurs pour comparer
  const validMeasures = data.filter(m =>
    m.valeur_entree !== undefined && m.valeur_entree !== null &&
    m.valeur_sortie !== undefined && m.valeur_sortie !== null
  );

  if (validMeasures.length === 0) return 0;

  const totalEfficiency = validMeasures.reduce((acc, curr) => {
    const entree = parseFloat(curr.valeur_entree);
    const sortie = parseFloat(curr.valeur_sortie);

    if (isNaN(entree) || isNaN(sortie) || entree <= 0) return acc;

    const efficiency = ((entree - sortie) / entree) * 100;
    // On limite l'efficience entre 0 et 100 pour éviter les aberrations
    return acc + Math.min(Math.max(efficiency, 0), 100);
  }, 0);

  return totalEfficiency / validMeasures.length;
}

  /**
   * Obtient l'icône de santé
   */
  getStationHealthIcon(station: Station): string {
    const health = this.calculateStationHealth(station);
    if (health >= 80) return 'bi-check-circle-fill text-success';
    if (health >= 50) return 'bi-exclamation-circle-fill text-warning';
    return 'bi-x-circle-fill text-danger';
  }

  /**
   * Obtient un résumé des caractéristiques
   */
  getCharacteristicsSummary(station: Station): string {
    const stationData = this.getStationData(station);
    const chars = stationData.characteristics;

    if (!chars) return 'Aucune caractéristique définie';

    const parts: string[] = [];

    if (chars.filterTypes && chars.filterTypes.length > 0) {
      const totalFilters = chars.filterTypes.reduce((sum: number, f: any) => sum + f.quantity, 0);
      parts.push(`${totalFilters} filtre(s)`);
    }

    if (chars.plantedFilters > 0) {
      parts.push(`${chars.plantedFilters} planté(s)`);
    }

    if (chars.dailyCapacity > 0) {
      parts.push(`${chars.dailyCapacity}L/jour`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'Caractéristiques partielles';
  }

  /**
   * Génère un rapport pour une station
   */
  generateStationReport(station: Station): void {
    const stationData = this.getStationData(station);
    const chars = stationData.characteristics;

    if (!chars) {
      alert('Aucune caractéristique définie pour cette station');
      return;
    }

    const report = `
═══════════════════════════════════════════════════════════════════════════
                            RAPPORT DE STATION
═══════════════════════════════════════════════════════════════════════════

📍 INFORMATIONS GÉNÉRALES
──────────────────────────────────────────────────────────────────────────
Station         : ${stationData.name}
Région          : ${this.getStationRegion(station)}
Statut          : ${stationData.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
Type            : ${stationData.type === 'fixed' ? '📍 Fixe' : '🚗 Mobile'}

🔧 ÉQUIPEMENTS
──────────────────────────────────────────────────────────────────────────
Types de filtres : ${chars.filterTypes.length}
${chars.filterTypes.map((f: any) => `  • ${f.type} : ${f.quantity} unité(s)`).join('\n') || '  Aucun'}
Filtres plantés  : ${chars.plantedFilters}
Filtres actifs   : ${chars.functionalFilters}

💧 CAPACITÉ
──────────────────────────────────────────────────────────────────────────
Capacité/jour    : ${chars.dailyCapacity.toLocaleString('fr-FR')} L
Robinets         : ${chars.numberOfTaps}

🏗️ INFRASTRUCTURE
──────────────────────────────────────────────────────────────────────────
Générateur       : ${chars.hasPowerBackup ? '✅ Oui' : '❌ Non'}
Réservoir        : ${chars.hasWaterStorage ? '✅ Oui' : '❌ Non'}
Capacité stock   : ${chars.storageCapacity || 0} L

🔨 MAINTENANCE
──────────────────────────────────────────────────────────────────────────
Dernière insp.   : ${chars.lastInspection || 'Non renseignée'}
Prochaine insp.  : ${chars.nextInspection || 'Non planifiée'}

📊 SANTÉ : ${this.calculateStationHealth(station)}%

═══════════════════════════════════════════════════════════════════════════
Généré le : ${new Date().toLocaleString('fr-FR')}
═══════════════════════════════════════════════════════════════════════════
    `.trim();

    console.log(report);

    navigator.clipboard.writeText(report).then(() => {
      this.successMessage = '📋 Rapport copié dans le presse-papier !';
      setTimeout(() => this.successMessage = '', 3000);
    }).catch(() => {
      alert('Rapport généré (consultez la console)');
    });
  }

  /**
   * Exporte toutes les caractéristiques en CSV
   */
  exportAllCharacteristicsToCSV(): void {
    const headers = [
      'ID', 'Nom', 'Région', 'Statut', 'Type',
      'Filtres plantés', 'Filtres actifs', 'Capacité L/jour',
      'Robinets', 'Générateur', 'Réservoir', 'Santé %'
    ];

    const rows = this.stations.map(station => {
      const stationData = this.getStationData(station);
      const chars = stationData.characteristics;

      return [
        station._id,
        stationData.name,
        this.getStationRegion(station),
        stationData.status,
        stationData.type,
        chars?.plantedFilters || 0,
        chars?.functionalFilters || 0,
        chars?.dailyCapacity || 0,
        chars?.numberOfTaps || 0,
        chars?.hasPowerBackup ? 'Oui' : 'Non',
        chars?.hasWaterStorage ? 'Oui' : 'Non',
        this.calculateStationHealth(station)
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stations_caracteristiques_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    this.successMessage = '📊 Export CSV réussi !';
    setTimeout(() => this.successMessage = '', 3000);
  }
}
