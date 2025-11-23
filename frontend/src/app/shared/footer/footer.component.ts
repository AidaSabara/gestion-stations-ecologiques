import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {

  currentYear: number = new Date().getFullYear();

  // Données statiques pour le footer (ou vous pouvez les injecter via un service)
  stationsCount: number = 0;
  alertsCount: number = 0;
  currentTime: string = new Date().toLocaleTimeString('fr-FR');

  constructor() { }

  ngOnInit(): void {
    this.updateTime();
  }

  private updateTime() {
    setInterval(() => {
      this.currentTime = new Date().toLocaleTimeString('fr-FR');
    }, 60000); // Mise à jour chaque minute
  }
}
