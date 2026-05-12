import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 rounded-full border-4 border-purple-100 animate-spin"
             style="border-top-color: var(--color-primary)"></div>
        <span class="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  `,
})
export class LoadingSpinnerComponent {}
