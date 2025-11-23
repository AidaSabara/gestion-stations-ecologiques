import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  // Propriétés avec valeurs par défaut
  alertsCount: number = 2; // 2 alertes pour la démo
  notificationsCount: number = 3; // 3 notifications système

  constructor() { }

  ngOnInit(): void {
    // Vous pouvez laisser vide ou ajouter de la logique si nécessaire
  }
}
