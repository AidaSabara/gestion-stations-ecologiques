import { Component } from '@angular/core';
import { HeaderComponent } from "../../shared/header/header.component";
import { SidebarComponent } from "../../shared/sidebar/sidebar.component";
import { FooterComponent } from "../../shared/footer/footer.component";
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [HeaderComponent, RouterOutlet, SidebarComponent, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {

}
