import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-concierge',
  imports: [RouterLink],
  template: `
    <section>
      <h1>Concierge</h1>
      <p class="lede">The Malaysia AI concierge is next. Until then, use the airport transport guide.</p>
      <p><a routerLink="/arrival/transport" class="btn">Airport transport</a></p>
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
export class Concierge {}
