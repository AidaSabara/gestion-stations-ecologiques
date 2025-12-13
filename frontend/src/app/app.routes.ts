// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LayoutComponent } from './pages/layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { StationsComponent } from './pages/stations/stations.component';
import { Home1Component } from './pages/home1/home1.component';
import { HomeComponent } from './pages/home/home.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { MapViewComponent } from './pages/map-view/map-view.component';
import { DataTableComponent } from './pages/data-table/data-table.component';
import { ChartsComponent } from './pages/charts/charts.component';
import { PredictionsComponent } from './pages/predictions/predictions.component';
import { FiltresComponent } from './pages/filtres/filtres.component';
import { dataAccessGuard } from './data-access.guard';
import { AuthComponent } from './pages/auth/auth.component';
import { StationDetailComponent } from './pages/station-detail/station-detail.component';
import { RealtimeMonitoringComponent } from './pages/realtime-monitoring/realtime-monitoring.component';
//import { AlertHistoryComponent } from './pages/alert-history/alert-history.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
    // 🔓 Route publique (pas de guard)
    {
        path: 'auth',
        component: AuthComponent
    },


    // 🏠 Layout principal avec routes protégées
    {
        path: '',
        component: LayoutComponent,
        canActivate: [dataAccessGuard], // ✅ Protège tout le layout
        children: [
            // 🏠 Pages d'accueil
            {
                path: '',
                component: Home1Component
            },
            {
                path: 'home',
                component: HomeComponent
            },
            // 👤 ADMINISTRATION UTILISATEURS (nécessite canManageUsers)
            {
                path: 'admin',
                component: AdminComponent,
                data: { permission: 'canManageUsers' } // Uniquement pour les utilisateurs autorisés
            },

            // 📊 DÉTAIL STATION (nécessite canAccessData)
            {
                path: 'station/:id',
                component: StationDetailComponent,
                // dataAccessGuard déjà appliqué via le parent
            },

            // 🔔 PAGES SPÉCIALISÉES POUR STATION SPÉCIFIQUE
            {
                path: 'station/:id/alerts',
                component: AlertsComponent,
                data: { permission: 'canAccessAlerts' } // canAccessData + canAccessAlerts
            },
            {
                path: 'station/:id/data',
                component: DataTableComponent,
                data: { permission: 'canAccessData' } // Déjà vérifié par le guard parent
            },
            {
                path: 'station/:id/charts',
                component: ChartsComponent,
                data: { permission: 'canAccessGraphs' } // canAccessData + canAccessGraphs
            },
            {
                path: 'station/:id/filtres',
                component: FiltresComponent,
                data: { permission: 'canAccessFilters' } // canAccessData + canAccessFilters
            },

            // 🌍 PAGES GLOBALES
            {
                path: 'alerts',
                component: AlertsComponent,
                data: { permission: 'canAccessAlerts' }
            },
            {
                path: 'map',
                component: MapViewComponent
            },
            {
                path: 'data',
                component: DataTableComponent,
                data: { permission: 'canAccessData' }
            },
            {
                path: 'charts',
                component: ChartsComponent,
                data: { permission: 'canAccessGraphs' }
            },
            {
                path: 'predictions',
                component: PredictionsComponent
            },
            {
                path: 'dashboard',
                component: DashboardComponent
            },
            {
                path: 'stations',
                component: StationsComponent
            },
            {
                path: 'filtres',
                component: FiltresComponent,
                data: { permission: 'canAccessFilters' }
            },
            {
                path: 'realtime',
                component: RealtimeMonitoringComponent
            }
        ],
    },
     // Route globale pour l'historique
 // { path: 'alert-history', component: AlertHistoryComponent },
  // Route pour l'historique d'une station spécifique
    //{ path: 'alert-history', component: AlertHistoryComponent },

  // Route pour l'historique d'une station spécifique
  //{ path: 'alert-history/:id', component: AlertHistoryComponent },


    // 🚫 Redirection pour routes inconnues
    {
        path: '**',
        redirectTo: ''
    }
];
