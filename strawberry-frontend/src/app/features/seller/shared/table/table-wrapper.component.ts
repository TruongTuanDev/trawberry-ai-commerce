import { Component } from '@angular/core';

@Component({
  selector: 'app-table-wrapper',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600">
          <ng-content></ng-content>
        </table>
      </div>
    </div>
  `,
  styles: [`
    /* 
      Generic table styling that applies to the projected content.
      We assume the user projects <thead><tr><th>... and <tbody><tr><td>...
    */
    :host ::ng-deep thead {
      background-color: #f9fafb; /* gray-50 */
      border-bottom: 1px solid #e5e7eb; /* gray-200 */
    }
    :host ::ng-deep th {
      padding: 1rem 1.25rem;
      font-weight: 700;
      color: #374151; /* gray-700 */
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    :host ::ng-deep td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f3f4f6; /* gray-100 */
      vertical-align: middle;
    }
    :host ::ng-deep tbody tr:last-child td {
      border-bottom: none;
    }
    :host ::ng-deep tbody tr:hover {
      background-color: #fcfcfc;
    }
  `]
})
export class TableWrapperComponent {}
