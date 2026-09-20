import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_UPDATED, PRIVACY_LEDE, PRIVACY_SECTIONS, PRIVACY_TITLE } from './legal-copy';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './legal.css',
})
export class Privacy {
  readonly title = PRIVACY_TITLE;
  readonly lede = PRIVACY_LEDE;
  readonly updated = LEGAL_UPDATED;
  readonly sections = PRIVACY_SECTIONS;
}
