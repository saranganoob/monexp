import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // iPhone Safari only applies :active (our press feedback) when the page listens for touches.
    inject(DOCUMENT).addEventListener('touchstart', () => {}, { passive: true });
  }
}
