import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SellerSyncFacade } from './seller-sync.facade';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge';

@Component({
  selector: 'app-seller-sync-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableWrapperComponent, BadgeComponent],
  providers: [DatePipe],
  // ... (keep template same as before but ensure facade.loadAll is used if needed)
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Sync Dashboard</h1>
        <p class="text-gray-500">Monitor your Wildberries catalog sync health, history, and run manual fetches.</p>
      </div>

      <!-- Health Cards -->
      @if (facade.health(); as h) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Status</p>
            <app-badge [variant]="h.lastSyncStatus === 'SUCCESS' ? 'green' : h.lastSyncStatus === 'FAILED' ? 'red' : 'yellow'" class="mt-1">
              {{ h.lastSyncStatus || 'N/A' }}
            </app-badge>
          </div>
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Failures</p>
            <p class="text-2xl font-black mt-1" [class.text-red-600]="(h.consecutiveFailureCount ?? 0) > 0" [class.text-gray-900]="(h.consecutiveFailureCount ?? 0) === 0">
              {{ h.consecutiveFailureCount ?? 0 }}
            </p>
          </div>
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Sync Interval</p>
            <p class="text-2xl font-black text-gray-900 mt-1">{{ h.syncIntervalMinutes ?? '—' }} <span class="text-sm font-normal text-gray-500">min</span></p>
          </div>
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Sync Paused</p>
            <p class="text-2xl font-black mt-1" [class.text-red-500]="h.isSyncPaused" [class.text-green-600]="!h.isSyncPaused">
              {{ h.isSyncPaused ? 'Yes' : 'No' }}
            </p>
          </div>
        </div>
      }

      <!-- Manual Controls + Settings -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Manual Triggers -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Manual Sync Controls</h2>
          <p class="text-sm text-gray-500 mb-4">Run a sync manually outside the scheduled window. Full sync re-fetches all products from Wildberries. Incremental only fetches updates since last sync.</p>
          <div class="flex gap-3">
            <button (click)="facade.triggerFull()" [disabled]="facade.triggering()"
              class="flex-1 px-4 py-2.5 border-2 border-purple-600 text-purple-600 text-sm font-bold rounded-xl hover:bg-purple-50 disabled:opacity-50 transition-colors">
              {{ facade.triggering() ? 'Triggering...' : 'Full Sync' }}
            </button>
            <button (click)="facade.triggerIncremental()" [disabled]="facade.triggering()"
              class="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {{ facade.triggering() ? 'Triggering...' : 'Incremental Sync' }}
            </button>
          </div>
        </div>

        <!-- Sync Settings -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Sync Settings</h2>
          <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sync Interval (minutes)</label>
              <input formControlName="syncIntervalMinutes" type="number" min="5"
                class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div class="flex items-center gap-3">
              <input formControlName="isSyncPaused" type="checkbox" id="synPauseToggle" class="h-4 w-4 text-purple-600 rounded" />
              <label for="synPauseToggle" class="text-sm font-medium text-gray-700">Pause automatic sync</label>
            </div>
            <div class="flex justify-end">
              <button type="submit" [disabled]="facade.savingSettings()"
                class="px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {{ facade.savingSettings() ? 'Saving...' : 'Save Settings' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sync History Table -->
      <div>
        <h2 class="text-xl font-bold text-gray-900 mb-4">Recent Sync History</h2>
        <app-table-wrapper>
          <thead>
            <tr>
              <th scope="col">Job ID</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Started At</th>
            </tr>
          </thead>
          <tbody>
            @if (facade.loading()) {
              <tr>
                <td colspan="4" class="text-center py-12">
                  <span class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-purple-600 animate-spin inline-block"></span>
                </td>
              </tr>
            } @else if (facade.history().length === 0) {
              <tr>
                <td colspan="4" class="text-center py-12 text-gray-500">No sync history yet. Trigger a sync to get started.</td>
              </tr>
            } @else {
              @for (job of facade.history(); track job.syncJobId) {
                <tr class="hover:bg-gray-50/50 transition-colors">
                  <td class="whitespace-nowrap font-mono text-xs text-gray-500">{{ job.syncJobId | slice:0:8 }}...</td>
                  <td class="whitespace-nowrap"><app-badge variant="gray">{{ job.syncType }}</app-badge></td>
                  <td class="whitespace-nowrap">
                    <app-badge [variant]="job.status === 'SUCCESS' ? 'green' : job.status === 'FAILED' ? 'red' : 'yellow'">{{ job.status }}</app-badge>
                  </td>
                  <td class="whitespace-nowrap text-sm text-gray-500">{{ job.startedAt | date:'short' }}</td>
                </tr>
              }
            }
          </tbody>
        </app-table-wrapper>
      </div>
    </div>
  `
})
export class SyncDashboardComponent implements OnInit {
  facade = inject(SellerSyncFacade);
  private context = inject(ShopContextService);
  private fb = inject(FormBuilder);

  settingsForm = this.fb.group({
    syncIntervalMinutes: [60, [Validators.required, Validators.min(5)]],
    isSyncPaused: [false]
  });

  private reloadEffect = effect(() => {
    if (this.context.currentShopId()) {
      this.facade.loadAll();
    }
  });

  // Also sync form values when health data is loaded
  private fillFormEffect = effect(() => {
    const health = this.facade.health();
    if (health) {
      this.settingsForm.patchValue({
        syncIntervalMinutes: health.syncIntervalMinutes ?? 60,
        isSyncPaused: health.isSyncPaused ?? false
      }, { emitEvent: false });
    }
  });

  ngOnInit() {
    // Initial load handled by reloadEffect
  }

  saveSettings() {
    if (this.settingsForm.invalid) return;
    const { syncIntervalMinutes, isSyncPaused } = this.settingsForm.value;
    this.facade.saveSettings(syncIntervalMinutes!, isSyncPaused ?? false);
  }
}
