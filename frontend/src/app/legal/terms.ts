import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_UPDATED, TERMS_LEDE, TERMS_SECTIONS, TERMS_TITLE } from './legal-copy';

@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  templateUrl: './terms.html',
  styleUrl: './legal.css',
})
export class Terms {
  readonly title = TERMS_TITLE;
  readonly lede = TERMS_LEDE;
  readonly updated = LEGAL_UPDATED;
  readonly sections = TERMS_SECTIONS;
}
