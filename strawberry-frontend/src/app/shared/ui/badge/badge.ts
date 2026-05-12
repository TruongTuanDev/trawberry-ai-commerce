import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'gray' | 'purple' | 'green' | 'red' | 'yellow';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold leading-tight uppercase tracking-widest whitespace-nowrap" [ngClass]="colorClass()">
      <ng-content></ng-content>
    </span>
  `
})
export class BadgeComponent {
  variant = input<BadgeVariant>('gray');

  colorClass = computed(() => {
    switch (this.variant()) {
      case 'purple': return 'bg-purple-100 text-purple-800 border-purple-200 border';
      case 'green': return 'bg-green-100 text-green-800 border-green-200 border';
      case 'red': return 'bg-red-100 text-red-800 border-red-200 border';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200 border';
      case 'gray':
      default: return 'bg-gray-100 text-gray-800 border-gray-200 border';
    }
  });
}
