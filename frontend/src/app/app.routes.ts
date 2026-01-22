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
import { mapAccessGuard } from './map-access.guard';
import { AuthComponent } from './pages/auth/auth.component';
import { StationDetailComponent } from './pages/station-detail/station-detail.component';
import { RealtimeMonitoringComponent } from './pages/realtime-monitoring/realtime-monitoring.component';
import { AdminComponent } from './pages/admin/admin.component';
import { UserActivityComponent } from './pages/user-activity/user-activity.component';
import { SensorInjectionComponent } from './pages/sensor-injection/sensor-injection.component';
import { WaterQualityInjectionComponent } from './pages/water-quality-injection/water-quality-injection.component';

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
        canActivate: [dataAccessGuard],
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
                data: { permission: 'canManageUsers' }
            },

            // ✅ HISTORIQUE DES ACTIVITÉS (Admin et Agent uniquement)
            {
                path: 'user-activity',
                component: UserActivityComponent,
                data: { allowedRoles: ['admin', 'agent'] } // ✅ Supervisor exclu
            },

            // 📊 DÉTAIL STATION (nécessite canAccessData)
            {
                path: 'station/:id',
                component: StationDetailComponent,
            },

            // 🔔 PAGES SPÉCIALISÉES POUR STATION SPÉCIFIQUE
            {
                path: 'station/:id/alerts',
                component: AlertsComponent,
                data: { permission: 'canAccessAlerts' }
            },
            {
                path: 'station/:id/data',
                component: DataTableComponent,
                data: { permission: 'canAccessData' }
            },
            {
                path: 'station/:id/charts',
                component: ChartsComponent,
                data: { permission: 'canAccessGraphs' }
            },
            {
                path: 'station/:id/filtres',
                component: FiltresComponent,
                data: { permission: 'canAccessFilters' }
            },

            // 🗺️ CARTE COMPLÈTE - ADMIN UNIQUEMENT
            {
                path: 'map',
                component: MapViewComponent,
                canActivate: [mapAccessGuard]
            },

            // 🌍 PAGES GLOBALES
            {
                path: 'alerts',
                component: AlertsComponent,
                data: { permission: 'canAccessAlerts' }
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
            },
            {
                path: 'sensor-injection',
                component: SensorInjectionComponent
            },
            {
                path: 'water-quality-injection',
                component: WaterQualityInjectionComponent,

            },

        ],
    },

    // 🚫 Redirection pour routes inconnues
    {
        path: '**',
        redirectTo: ''
    }
];
