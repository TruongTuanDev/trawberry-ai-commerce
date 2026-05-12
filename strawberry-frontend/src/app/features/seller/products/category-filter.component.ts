import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryResponseDto } from '../../../core/models/product-dto.model';

@Component({
  selector: 'app-category-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="category-filter bg-white rounded-lg border border-slate-200 p-4 sticky top-24">
      <h3 class="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wider">Categories</h3>
      
      <!-- Internal Search -->
      <div class="relative mb-4">
        <input 
          type="text" 
          [ngModel]="searchTerm()"
          (ngModelChange)="searchTerm.set($event)"
          placeholder="Search categories..."
          class="w-full text-sm pl-8 pr-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
        <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <!-- Categories List -->
      <div class="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        <div *ngFor="let cat of filteredCategories()" class="flex items-center justify-between group cursor-pointer py-1 px-2 rounded-md hover:bg-slate-50 transition-colors">
          <label class="flex items-center cursor-pointer flex-1">
            <input 
              type="checkbox" 
              [checked]="_selectedIds().includes(cat.id)"
              (change)="toggleCategory(cat.id)"
              class="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            >
            <span class="ml-2.5 text-sm text-slate-600 group-hover:text-slate-900 truncate">
              {{ cat.name }}
            </span>
          </label>
          <span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {{ cat.productCount }}
          </span>
        </div>
        
        <div *ngIf="filteredCategories().length === 0" class="py-10 text-center text-slate-400">
          <p class="text-xs">No categories found</p>
        </div>
      </div>

      <!-- Reset -->
      <button 
        *ngIf="_selectedIds().length > 0"
        (click)="reset()"
        class="mt-4 w-full text-xs text-primary-600 hover:text-primary-700 font-medium py-1.5 border border-primary-100 rounded-md hover:bg-primary-50 transition-colors"
      >
        Clear Selection ({{ _selectedIds().length }})
      </button>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  `]
})
export class CategoryFilterComponent {
  @Input({ required: true }) set categories(val: CategoryResponseDto[]) {
    this._categories.set(val);
  }
  @Input() set selectedIds(val: number[]) {
    this._selectedIds.set(val);
  }
  @Output() selectionChange = new EventEmitter<number[]>();

  _categories = signal<CategoryResponseDto[]>([]);
  _selectedIds = signal<number[]>([]);
  searchTerm = signal<string>('');

  filteredCategories = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this._categories().filter(c => c.name.toLowerCase().includes(term));
  });

  toggleCategory(id: number) {
    const current = this._selectedIds();
    const next = current.includes(id) 
      ? current.filter(i => i !== id) 
      : [...current, id];
    
    this._selectedIds.set(next);
    this.selectionChange.emit(next);
  }

  reset() {
    this._selectedIds.set([]);
    this.selectionChange.emit([]);
  }
}
