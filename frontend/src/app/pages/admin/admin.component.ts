
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User, CreateUserDto } from '../../models/user.model';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService } from '../../auth.service';
import { UserService } from '../../user.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Données
  users: User[] = [];
  filteredUsers: User[] = [];
  stations: any[] = [];
  currentUser: User | null = null;

  // Statistiques
  stats = {
    total: 0,
    active: 0,
    inactive: 0,
    byRole: {} as { [key: string]: number }
  };

  // Formulaires
  userForm: FormGroup;
  searchForm: FormGroup;

  // États UI
  showModal = false;
  isEditMode = false;
  selectedUser: User | null = null;
  loading = false;
  showFilters = false;

  // Filtres
  selectedRole = 'all';
  selectedStation = 'ALL';
  selectedStatus = 'all';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Rôles disponibles
  availableRoles = [
    { value: 'admin', label: 'Administrateur', color: 'red' },
    { value: 'supervisor', label: 'Superviseur', color: 'blue' },
    { value: 'analyst', label: 'Analyste', color: 'green' },
    { value: 'technician', label: 'Technicien', color: 'orange' },
    { value: 'operator', label: 'Opérateur', color: 'gray' }
  ];

  constructor(
    private userService: UserService,
    private kuzzleService: KuzzleService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.userForm = this.createUserForm();
    this.searchForm = this.createSearchForm();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    //this.loadStations();
   // this.loadUsers();
    //this.loadStats();
    this.setupSearchListener();
    this.waitForKuzzleAndLoad();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================
  // INITIALISATION
  // ==========================================
private async waitForKuzzleAndLoad(): Promise<void> {
    console.log('⏳ Admin: Attente connexion Kuzzle...');

    // Attendre la connexion (max 10 secondes)
    const maxWait = 10000;
    const startTime = Date.now();

    while (!this.kuzzleService.isConnected()) {
      if (Date.now() - startTime > maxWait) {
        console.error('❌ Timeout: Kuzzle non connecté après 10s');
        this.loading = false;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('✅ Admin: Kuzzle connecté, chargement données...');

    // Maintenant charger tout
    await this.loadStations();
    this.loadUsers();
    this.loadStats();
  }
  private createUserForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['operator', Validators.required],
      station_id: ['', Validators.required],
      station_name: ['', Validators.required],
      phone: ['', Validators.required],
      department: ['', Validators.required],
      position: ['', Validators.required],
      active: [true],
      permissions: this.fb.group({
        canAccessAlerts: [false],
        canAccessGraphs: [false],
        canAccessFilters: [false],
        canAccessData: [false],
        canManageUsers: [false]
      })
    });
  }

  private createSearchForm(): FormGroup {
    return this.fb.group({
      searchTerm: ['']
    });
  }

  private loadCurrentUser(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
  }

  private async loadStations(): Promise<void> {
  try {
    console.log('🔍 Chargement des stations...');

    const results = await this.kuzzleService.getStations();

    console.log('📦 Données brutes reçues:', results);

    // ✅ CORRECTION : Utiliser "name" au lieu de "nom"
    this.stations = results.map((doc: any) => {
      const source = doc._source || doc.body || {};

      return {
        _id: doc._id,
        name: source.name || `Station ${doc._id.substring(0, 8)}`,
        // ⚡ Garder les deux formats pour compatibilité
        nom: source.name || source.nom || `Station ${doc._id.substring(0, 8)}`,
        localisation: source.location || source.localisation || '',
        type: source.type || '',
        status: source.status || 'active',
        _source: source,
        body: source
      };
    });

    console.log('✅ Stations formatées:', this.stations.length);
    console.log('📄 Exemple:', this.stations[0]);

  } catch (error) {
    console.error('❌ Erreur chargement stations:', error);
    this.stations = [];
  }
}

  private loadUsers(): void {
    this.loading = true;

    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.applyFilters();
          this.loading = false;
          console.log('👥 Utilisateurs chargés:', users.length);
        },
        error: (error: unknown) => {
          console.error('❌ Erreur chargement utilisateurs:', error);
          this.users = [];
          this.loading = false;

          // ✅ Afficher un message à l'utilisateur
          alert('Erreur lors du chargement des utilisateurs. Vérifiez la connexion à Kuzzle.');
        }
      });
  }


private loadStats(): void {
  this.userService.getUserStats()
    .pipe(takeUntil(this.destroy$))
    .subscribe((stats: {
      total: number;
      active: number;
      inactive: number;
      byRole: { [key: string]: number };
      byStation: { [key: string]: number };
    }) => {
      this.stats = stats;
    });
}
  private setupSearchListener(): void {
    this.searchForm.get('searchTerm')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(term => {
        this.onSearch(term);
      });
  }

  // ==========================================
  // GESTION MODAL
  // ==========================================

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedUser = null;
    this.userForm.reset({
      active: true,
      role: 'operator',
      permissions: {
        canAccessAlerts: false,
        canAccessGraphs: false,
        canAccessFilters: false,
        canAccessData: false,
        canManageUsers: false
      }
    });
    // Rendre le mot de passe obligatoire en création
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  openEditModal(user: User): void {
    this.isEditMode = true;
    this.selectedUser = user;
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      role: user.role,
      station_id: user.station_id,
      station_name: user.station_name,
      phone: user.phone,
      department: user.department,
      position: user.position,
      active: user.active,
      permissions: user.permissions
    });
    // Rendre le mot de passe optionnel en édition
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.userForm.reset();
    this.selectedUser = null;
  }

  // ==========================================
  // CRUD UTILISATEURS
  // ==========================================

onSubmit(): void {
  if (this.userForm.invalid) {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
    return;
  }

  this.loading = true;
  const formData = this.userForm.value;

  if (this.isEditMode && this.selectedUser) {
    const updateData: any = { ...formData, _id: this.selectedUser._id };
    if (!formData.password) {
      delete updateData.password;
    }

    this.userService.updateUser(this.selectedUser._id, updateData).subscribe({
      next: () => {
        console.log('✅ Utilisateur mis à jour');
        this.loadUsers();
        this.closeModal();
        this.loading = false;
      },
      error: (error: unknown) => {
        console.error('❌ Erreur mise à jour:', error);
        this.loading = false;
      }
    });
  } else {
    const userData: CreateUserDto = formData;
    this.userService.createUser(userData).subscribe({
      next: () => {
        console.log('✅ Utilisateur créé');
        this.loadUsers();
        this.closeModal();
        this.loading = false;
      },
      error: (error: unknown) => {
        console.error('❌ Erreur création:', error);
        this.loading = false;
      }
    });
  }
}
deleteUser(user: User): void {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.name}" ?`)) {
    return;
  }

  this.loading = true;
  this.userService.deleteUser(user._id).subscribe({
    next: () => {
      console.log('✅ Utilisateur supprimé');
      this.loadUsers();
      this.loading = false;
    },
    error: (error: unknown) => {
      console.error('❌ Erreur suppression:', error);
      this.loading = false;
    }
  });
}
toggleUserStatus(user: User): void {
  this.userService.toggleUserStatus(user._id).subscribe({
    next: () => {
      console.log('✅ Statut utilisateur modifié');
      this.loadUsers();
    },
    error: (error: unknown) => {
      console.error('❌ Erreur changement statut:', error);
    }
  });
}
  // ==========================================
  // FILTRES ET RECHERCHE
  // ==========================================

  onSearch(term: string): void {
    if (!term.trim()) {
      this.applyFilters();
      return;
    }

    const lowerTerm = term.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.name.toLowerCase().includes(lowerTerm) ||
      user.email.toLowerCase().includes(lowerTerm) ||
      user.department.toLowerCase().includes(lowerTerm) ||
      user.position.toLowerCase().includes(lowerTerm)
    );
    this.updatePagination();
  }

  applyFilters(): void {
    let filtered = [...this.users];

    // Filtre par rôle
    if (this.selectedRole !== 'all') {
      filtered = filtered.filter(u => u.role === this.selectedRole);
    }

    // Filtre par station
    if (this.selectedStation !== 'ALL') {
      filtered = filtered.filter(u => u.station_id === this.selectedStation);
    }

    // Filtre par statut
    if (this.selectedStatus !== 'all') {
      const isActive = this.selectedStatus === 'active';
      filtered = filtered.filter(u => u.active === isActive);
    }

    this.filteredUsers = filtered;
    this.updatePagination();
  }

  onRoleFilterChange(role: string): void {
    this.selectedRole = role;
    this.applyFilters();
  }

  onStationFilterChange(stationId: string): void {
    this.selectedStation = stationId;
    this.applyFilters();
  }

  onStatusFilterChange(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  resetFilters(): void {
    this.selectedRole = 'all';
    this.selectedStation = 'ALL';
    this.selectedStatus = 'all';
    this.searchForm.reset();
    this.applyFilters();
  }

  // ==========================================
  // PAGINATION
  // ==========================================

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // ==========================================
  // PERMISSIONS
  // ==========================================

  onRoleChange(role: string): void {
    const permissionsGroup = this.userForm.get('permissions') as FormGroup;

    // Définir les permissions par défaut selon le rôle
    switch (role) {
      case 'admin':
        permissionsGroup.patchValue({
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: true,
          canAccessData: true,
          canManageUsers: true
        });
        break;
      case 'supervisor':
        permissionsGroup.patchValue({
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: true,
          canAccessData: true,
          canManageUsers: false
        });
        break;
      case 'analyst':
        permissionsGroup.patchValue({
          canAccessAlerts: true,
          canAccessGraphs: true,
          canAccessFilters: false,
          canAccessData: true,
          canManageUsers: false
        });
        break;
      case 'technician':
        permissionsGroup.patchValue({
          canAccessAlerts: true,
          canAccessGraphs: false,
          canAccessFilters: true,
          canAccessData: false,
          canManageUsers: false
        });
        break;
      case 'operator':
        permissionsGroup.patchValue({
          canAccessAlerts: true,
          canAccessGraphs: false,
          canAccessFilters: false,
          canAccessData: false,
          canManageUsers: false
        });
        break;
    }
  }

  onStationChange(event: any): void {
  const stationId = event.target.value;
  const station = this.stations.find(s => s._id === stationId);

  if (station) {
    console.log('📍 Station sélectionnée:', station);

    // ✅ CORRECTION : Utiliser "name" comme clé principale
    this.userForm.patchValue({
      station_name: station.name || station.nom || ''
    });
  }
}


  // ==========================================
  // EXPORT
  // ==========================================

  exportToJson(): void {
    this.userService.exportUsersToJson();
  }

  exportToCsv(): void {
    this.userService.exportUsersToCsv();
  }

  // ==========================================
  // HELPERS
  // ==========================================

  getRoleBadgeClass(role: string): string {
    const roleConfig = this.availableRoles.find(r => r.value === role);
    return `badge-${roleConfig?.color || 'gray'}`;
  }

  getRoleLabel(role: string): string {
    const roleConfig = this.availableRoles.find(r => r.value === role);
    return roleConfig?.label || role;
  }

  formatDate(date: string | null): string {
    if (!date) return 'Jamais';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  canDeleteUser(user: User): boolean {
    // Ne pas pouvoir supprimer son propre compte
    if (this.currentUser?._id === user._id) return false;
    // Seul un admin peut supprimer un autre admin
    if (user.role === 'admin' && this.currentUser?.role !== 'admin') return false;
    return true;
  }

  canEditUser(user: User): boolean {
    // Peut toujours éditer son propre compte
    if (this.currentUser?._id === user._id) return true;
    // Seul un admin peut éditer un autre admin
    if (user.role === 'admin' && this.currentUser?.role !== 'admin') return false;
    return true;
  }
}
