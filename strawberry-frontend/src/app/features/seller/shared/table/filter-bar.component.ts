import { Component, output, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <!-- Search Input -->
      <div class="relative w-full sm:w-96">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
           type="text" 
           [(ngModel)]="query" 
           (ngModelChange)="onSearchChange($event)"
           class="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition-all" 
           [placeholder]="placeholder()" />
      </div>

      <!-- Optional Ng-Content for extra filters (Selects, Toggles, Buttons) -->
      <div class="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto scrollbar-none">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class FilterBarComponent {
  placeholder = input<string>('Search...');
  searchQuery = output<string>();

  query = '';
  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.emit(val);
    });
  }

  onSearchChange(value: string) {
    this.searchSubject.next(value);
  }
}
