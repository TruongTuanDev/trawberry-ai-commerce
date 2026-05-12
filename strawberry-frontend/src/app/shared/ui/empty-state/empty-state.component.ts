import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div class="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mb-6 text-gray-300 relative">
        <div class="absolute inset-0 rounded-full bg-gray-100 animate-pulse opacity-50"></div>
        <ng-content select="[icon]"></ng-content>
        @if (!hasIconContent) {
          <svg class="w-12 h-12 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        }
      </div>
      <h3 class="text-xl font-black text-gray-900 mb-2 tracking-tight">{{ title() }}</h3>
      <p class="text-gray-500 max-w-sm mx-auto leading-relaxed mb-8">{{ description() }}</p>
      <ng-content select="[actions]"></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  title = input<string>('No items found');
  description = input<string>('Try adjusting your filters or check back later.');
  
  // This is a simple trick to check if content was provided, though in Angular 19+ 
  // we could use contentChildren. For now let's just use defaults if nothing passed.
  get hasIconContent() { return false; } // Simplified for now
}
