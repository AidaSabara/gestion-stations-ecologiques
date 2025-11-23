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
import { authGuard } from './auth.guard';
import { dataAccessGuard } from './data-access.guard';
import { AuthComponent } from './pages/auth/auth.component';
import { StationDetailComponent } from './pages/station-detail/station-detail.component';


export const routes: Routes = [
    { path: 'auth', component: AuthComponent },
    {
        path: '',
        component: LayoutComponent,
        children: [
            { path: '', component: Home1Component },
            { path: 'home', component: HomeComponent },

            // DÉTAIL STATION
            { path: 'station/:id', component: StationDetailComponent },

            // PAGES SPÉCIALISÉES POUR STATION SPÉCIFIQUE
            { path: 'station/:id/alerts', component: AlertsComponent },
            { path: 'station/:id/data', component: DataTableComponent, canActivate: [dataAccessGuard] },
            { path: 'station/:id/charts', component: ChartsComponent },
            { path: 'station/:id/filtres', component: FiltresComponent },

            // PAGES SPÉCIALISÉES (globales)
            { path: 'alerts', component: AlertsComponent },
            { path: 'map', component: MapViewComponent },
            { path: 'data', component: DataTableComponent },
            { path: 'charts', component: ChartsComponent },
            { path: 'predictions', component: PredictionsComponent },
            { path: 'dashboard', component: DashboardComponent },
            { path: 'stations', component: StationsComponent, canActivate: [authGuard] },
            { path: 'filtres', component: FiltresComponent }
        ],
    },
];
