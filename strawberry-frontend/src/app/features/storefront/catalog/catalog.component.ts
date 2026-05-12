import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import { CatalogFacade } from './catalog.facade';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ProductCardComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    NgClass,
  ],
  templateUrl: './catalog.component.html',
})
export class CatalogComponent implements OnInit, OnDestroy, AfterViewInit {
  private catalogFacade = inject(CatalogFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLElement>;

  products = this.catalogFacade.products;
  categories = this.catalogFacade.categories;
  loading = this.catalogFacade.loading;
  totalElements = this.catalogFacade.totalElements;

  currentPage = signal(0);
  selectedCategoryId = signal<number | null>(null);
  inStockOnly = signal(false);
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);

  searchControl = new FormControl('');
  private observer?: IntersectionObserver;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.catalogFacade.loadCategories();

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.updateQueryParams({ search: value || null });
      });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.searchControl.setValue(params['search'] ?? '', { emitEvent: false });
      this.selectedCategoryId.set(params['categoryId'] ? Number(params['categoryId']) : null);
      this.inStockOnly.set(params['inStock'] === 'true');
      this.minPrice.set(params['minPrice'] ? Number(params['minPrice']) : null);
      this.maxPrice.set(params['maxPrice'] ? Number(params['maxPrice']) : null);
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
    if (typeof IntersectionObserver === 'undefined') return;
    if (!this.scrollAnchor?.nativeElement) return;

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

  resetAndLoad(): void {
    this.currentPage.set(0);
    this.loadProducts(true);
  }

  loadProducts(reset = false): void {
    this.catalogFacade.loadProducts({
      search: this.searchControl.value?.trim() || undefined,
      categoryId: this.selectedCategoryId() ?? undefined,
      inStock: this.inStockOnly() || undefined,
      minPrice: this.minPrice() ?? undefined,
      maxPrice: this.maxPrice() ?? undefined,
      page: reset ? 0 : this.currentPage(),
      size: 30,
      reset,
    });

    if (reset) this.currentPage.set(0);
  }

  hasMore(): boolean {
    return this.products().length < this.totalElements();
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.currentPage.update((page) => page + 1);
    this.loadProducts(false);
  }

  setCategory(categoryId: number | null): void {
    this.selectedCategoryId.set(this.selectedCategoryId() === categoryId ? null : categoryId);
    this.updateQueryParams({ categoryId: this.selectedCategoryId() ?? null });
  }

  onStockFilter(event: Event): void {
    this.inStockOnly.set((event.target as HTMLInputElement).checked);
    this.updateQueryParams({ inStock: this.inStockOnly() ? 'true' : null });
  }

  setMinPrice(event: Event): void {
    this.minPrice.set(Number((event.target as HTMLInputElement).value) || null);
    this.updateQueryParams({ minPrice: this.minPrice() ?? null });
  }

  setMaxPrice(event: Event): void {
    this.maxPrice.set(Number((event.target as HTMLInputElement).value) || null);
    this.updateQueryParams({ maxPrice: this.maxPrice() ?? null });
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.selectedCategoryId.set(null);
    this.inStockOnly.set(false);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.updateQueryParams({
      search: null,
      categoryId: null,
      inStock: null,
      minPrice: null,
      maxPrice: null,
    });
  }

  private updateQueryParams(params: Record<string, string | number | null>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.observer?.disconnect();
  }
}
