import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly envName = environment.name;
  readonly apiBaseUrl = environment.apiBaseUrl;
}
