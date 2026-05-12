import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AdminApiService, PendingSellerDto } from '../../../core/api/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TableWrapperComponent } from '../../seller/shared/table/table-wrapper.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge';

@Component({
  selector: 'app-seller-approvals',
  standalone: true,
  imports: [CommonModule, TableWrapperComponent, BadgeComponent],
  providers: [DatePipe],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Seller Approvals</h1>
        <p class="text-gray-500">Review and approve or reject seller registration applications.</p>
      </div>

      @if (allDone() && !loading()) {
        <div class="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
          <svg class="h-8 w-8 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="font-bold text-green-900">All clear!</p>
            <p class="text-sm text-green-700">No pending seller applications at this time.</p>
          </div>
        </div>
      }

      <app-table-wrapper>
        <thead>
          <tr>
            <th scope="col">Applicant</th>
            <th scope="col">Contact</th>
            <th scope="col">Applied On</th>
            <th scope="col">Status</th>
            <th scope="col" class="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr>
              <td colspan="5" class="text-center py-12">
                <span class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-red-500 animate-spin inline-block"></span>
              </td>
            </tr>
          } @else if (sellers().length === 0) {
            <tr>
              <td colspan="5" class="text-center py-16 text-gray-400">No applications found.</td>
            </tr>
          } @else {
            @for (seller of sellers(); track seller.sellerProfileId) {
              <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {{ seller.fullName.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-bold text-gray-900 text-sm">{{ seller.fullName }}</p>
                      <p class="text-xs text-gray-400 font-mono">{{ seller.sellerProfileId | slice:0:8 }}...</p>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap">
                  <p class="text-sm text-gray-900">{{ seller.email }}</p>
                  @if (seller.phone) {
                    <p class="text-xs text-gray-500">{{ seller.phone }}</p>
                  }
                </td>
                <td class="whitespace-nowrap text-sm text-gray-500">{{ seller.createdAt | date:'mediumDate' }}</td>
                <td class="whitespace-nowrap">
                  <app-badge
                    [variant]="seller.approvalStatus === 'APPROVED' ? 'green' : seller.approvalStatus === 'REJECTED' ? 'red' : 'yellow'">
                    {{ seller.approvalStatus }}
                  </app-badge>
                </td>
                <td class="whitespace-nowrap">
                  @if (seller.approvalStatus === 'PENDING') {
                    <div class="flex items-center justify-center gap-2">
                      <button
                        [disabled]="processingId() === seller.sellerProfileId"
                        (click)="reject(seller)"
                        class="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                        Reject
                      </button>
                      <button
                        [disabled]="processingId() === seller.sellerProfileId"
                        (click)="approve(seller)"
                        class="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
                        Approve
                      </button>
                    </div>
                  } @else {
                    <p class="text-xs text-center text-gray-400">—</p>
                  }
                </td>
              </tr>
            }
          }
        </tbody>
      </app-table-wrapper>

      <!-- Processed Log -->
      @if (processed().length > 0) {
        <div>
          <h2 class="text-lg font-bold text-gray-900 mb-3">Recently Processed This Session</h2>
          <div class="space-y-2">
            @for (item of processed(); track item.id) {
              <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                <p class="text-sm text-gray-700">
                  <span class="font-bold">{{ item.name }}</span> — {{ item.action }}
                </p>
                <app-badge [variant]="item.action === 'approved' ? 'green' : 'red'">{{ item.action }}</app-badge>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SellerApprovalsComponent implements OnInit {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);

  sellers = signal<PendingSellerDto[]>([]);
  loading = signal<boolean>(true);
  processingId = signal<string | null>(null);
  processed = signal<{ id: string; name: string; action: string }[]>([]);

  allDone() {
    return this.sellers().filter(s => s.approvalStatus === 'PENDING').length === 0;
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getPendingSellers().subscribe({
      next: (s) => { this.sellers.set(s); this.loading.set(false); },
      error: () => { this.toast.error('Could not load seller applications'); this.loading.set(false); }
    });
  }

  approve(seller: PendingSellerDto) {
    console.log(seller)
    if (!confirm(`Approve ${seller.fullName} as a seller? They will be able to create a shop immediately.`)) return;
    this.processingId.set(seller.userId);
    this.api.approveSeller(seller.userId).subscribe({
      next: (res) => {
        this.toast.success(`${seller.fullName} approved as seller.`);
        this.processingId.set(null);
        this.processed.update(p => [...p, { id: seller.userId, name: seller.fullName, action: 'approved' }]);
        this.sellers.update(list => list.map(s =>
          s.userId === seller.userId ? { ...s, approvalStatus: res.approvalStatus } : s
        ));
      },
      error: () => { this.toast.error('Approval failed.'); this.processingId.set(null); }
    });
  }

  reject(seller: PendingSellerDto) {
    const reason = prompt(`Reason for rejecting ${seller.fullName} (optional):`);
    if (reason === null) return; // user cancelled
    this.processingId.set(seller.userId);
    this.api.rejectSeller(seller.userId, reason || undefined).subscribe({
      next: (res) => {
        this.toast.success(`${seller.fullName} has been rejected.`);
        this.processingId.set(null);
        this.processed.update(p => [...p, { id: seller.userId, name: seller.fullName, action: 'rejected' }]);
        this.sellers.update(list => list.map(s =>
          s.userId === seller.userId ? { ...s, approvalStatus: res.approvalStatus } : s
        ));
      },
      error: () => { this.toast.error('Rejection failed.'); this.processingId.set(null); }
    });
  }
}
