import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SOS_COLOR } from './explore/explore.service';
import { STITCH_AVATAR_URL, STITCH_HEADER_WEATHER, STITCH_LOGO_URL } from './stitch-assets';

const MAIN_TABS = new Set(['/', '/explore', '/trips', '/plan', '/concierge', '/settings']);

export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly title = 'Malaysia Companion';
  readonly logoUrl = STITCH_LOGO_URL;
  readonly avatarUrl = STITCH_AVATAR_URL;
  readonly weatherLine = STITCH_HEADER_WEATHER;
  readonly sosColor = SOS_COLOR;
  readonly showBack = signal(false);
  readonly adminShell = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split('?')[0];
        const admin = isAdminPath(path);
        this.adminShell.set(admin);
        this.showBack.set(!admin && !MAIN_TABS.has(path));
      });
  }

  goBack(): void {
    this.location.back();
  }
}
