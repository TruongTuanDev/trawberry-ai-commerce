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
import { RouterLink } from '@angular/router';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { CatalogFacade } from '../catalog/catalog.facade';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';

const BANNER_SLIDES = [
  {
    gradient: 'linear-gradient(135deg, #581c87 0%, #7e22ce 60%, #a21caf 100%)',
    tag: 'Exclusive Deals',
    title: 'Up to 60% off',
    subtitle: 'Top picks from our synchronized marketplace catalog, refreshed every day.',
    cta: 'Shop Deals',
  },
  {
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
    tag: 'New Arrivals',
    title: 'Just Landed',
    subtitle: 'Fresh products imported directly from the live Wildberries catalog.',
    cta: 'Browse New',
  },
  {
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)',
    tag: 'Flash Sale',
    title: 'Limited Time Offers',
    subtitle: 'Grab the best deals before they sell out. Updated continuously.',
    cta: 'View All',
  },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, LoadingSpinnerComponent, NgClass],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  private catalogFacade = inject(CatalogFacade);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLElement>;
  @ViewChild('categoryStrip') categoryStrip?: ElementRef<HTMLElement>;

  products = this.catalogFacade.products;
  loading = this.catalogFacade.loading;
  totalElements = this.catalogFacade.totalElements;
  categories = this.catalogFacade.categories;

  currentPage = signal(0);
  activeCategoryId = signal<number | null>(null);
  currentSlide = signal(0);

  slides = BANNER_SLIDES;
  features = [
    { icon: '✓', label: 'Real-time catalog sync' },
    { icon: '🔒', label: 'Secure payments' },
    { icon: '📦', label: 'Order tracking' },
    { icon: '🚚', label: 'Fast delivery' },
    { icon: '💬', label: '24h support' },
  ];

  private readonly pageSize = 30;
  private slideIntervalId?: ReturnType<typeof setInterval>;
  private observer?: IntersectionObserver;
  private stripDragging = false;
  private dragStartX = 0;
  private dragScrollLeft = 0;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.catalogFacade.loadCategories();
    this.loadProducts(true);

    if (this.isBrowser) {
      this.slideIntervalId = setInterval(() => {
        this.currentSlide.set((this.currentSlide() + 1) % this.slides.length);
      }, 6000);
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    queueMicrotask(() => {
      this.setupInfiniteScroll();
    });
  }

  activeCategoryName(): string {
    const currentId = this.activeCategoryId();
    if (!currentId) return 'Popular Products';
    return this.categories().find(category => category.id === currentId)?.name ?? 'Popular Products';
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

  loadProducts(reset = false): void {
    const page = reset ? 0 : this.currentPage();

    this.catalogFacade.loadProducts({
      categoryId: this.activeCategoryId() ?? undefined,
      page,
      size: this.pageSize,
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

  onCategoryWheel(event: WheelEvent): void {
    const strip = this.categoryStrip?.nativeElement;
    if (!strip) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    strip.scrollLeft += event.deltaY;
  }

  onCategoryPointerDown(event: PointerEvent): void {
    const strip = this.categoryStrip?.nativeElement;
    if (!strip) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, input, textarea, select')) return;
    this.stripDragging = true;
    this.dragStartX = event.clientX;
    this.dragScrollLeft = strip.scrollLeft;
    strip.setPointerCapture(event.pointerId);
  }

  onCategoryPointerMove(event: PointerEvent): void {
    const strip = this.categoryStrip?.nativeElement;
    if (!strip || !this.stripDragging) return;
    const delta = event.clientX - this.dragStartX;
    strip.scrollLeft = this.dragScrollLeft - delta;
  }

  onCategoryPointerUp(event: PointerEvent): void {
    const strip = this.categoryStrip?.nativeElement;
    if (!strip) return;
    this.stripDragging = false;
    if (strip.hasPointerCapture(event.pointerId)) {
      strip.releasePointerCapture(event.pointerId);
    }
  }

  ngOnDestroy(): void {
    if (this.slideIntervalId) clearInterval(this.slideIntervalId);
    this.observer?.disconnect();
  }
}
