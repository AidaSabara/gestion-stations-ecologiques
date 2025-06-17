import { Routes } from '@angular/router';
import { LayoutComponent } from './pages/layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { StationsComponent } from './pages/stations/stations.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', component: DashboardComponent },
      { path: 'stations', component: StationsComponent },
    ],
  },
];
