import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-explore',
  imports: [RouterLink],
  template: `
    <section>
      <h1>Explore</h1>
      <p class="lede">Nearby places and on-the-ground tips will land here.</p>
      <p><a routerLink="/arrival" class="btn">Open arrival guide</a></p>
    </section>
  `,
  styles: `
    h1 {
      margin: 0 0 0.25rem;
    }
    .lede {
      color: var(--color-text-muted);
    }
  `,
})
export class Explore {}
