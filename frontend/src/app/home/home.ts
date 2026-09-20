import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly envName = environment.name;
  readonly apiBaseUrl = environment.apiBaseUrl;
}
