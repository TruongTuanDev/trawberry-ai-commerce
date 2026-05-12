import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { CatalogFacade } from '../catalog/catalog.facade';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink, NgClass, ProductCardComponent, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './brand.component.html',
})
export class BrandComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private catalogFacade = inject(CatalogFacade);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLElement>;

  products = this.catalogFacade.products;
  categories = this.catalogFacade.categories;
  loading = this.catalogFacade.loading;
  totalElements = this.catalogFacade.totalElements;

  brandName = signal('');
  currentPage = signal(0);
  selectedCategoryId = signal<number | null>(null);

  private observer?: IntersectionObserver;
  private readonly pageSize = 30;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.catalogFacade.loadCategories();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.brandName.set(params.get('brandName') ?? '');
      this.selectedCategoryId.set(null);
      this.resetAndLoad();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    queueMicrotask(() => {
      this.setupInfiniteScroll();
    });
  }

  private setupInfiniteScroll(): void {
    if (!this.isBrowser) return;
    if (!this.scrollAnchor?.nativeElement) return;
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        if (this.loading()) return;
        if (!this.hasMore()) return;
        this.loadMore();
      },
      { rootMargin: '400px 0px' },
    );

    this.observer.observe(this.scrollAnchor.nativeElement);
  }

  setCategory(categoryId: number | null): void {
    this.selectedCategoryId.set(this.selectedCategoryId() === categoryId ? null : categoryId);
    this.resetAndLoad();
  }

  resetAndLoad(): void {
    this.currentPage.set(0);
    this.loadProducts(true);
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.currentPage.update((page) => page + 1);
    this.loadProducts(false);
  }

  hasMore(): boolean {
    return this.products().length < this.totalElements();
  }

  private loadProducts(reset = false): void {
    const brand = this.brandName().trim();
    if (!brand) {
      this.catalogFacade.loadProducts({ page: 0, size: this.pageSize, reset: true });
      return;
    }

    this.catalogFacade.loadProducts({
      brand,
      categoryId: this.selectedCategoryId() ?? undefined,
      page: reset ? 0 : this.currentPage(),
      size: this.pageSize,
      reset,
    });

    if (reset) this.currentPage.set(0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.observer?.disconnect();
  }
}
