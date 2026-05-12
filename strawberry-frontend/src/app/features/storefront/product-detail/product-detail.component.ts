import { Component, inject, signal, OnInit, effect, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, NgClass, DatePipe } from '@angular/common';
import { CatalogFacade } from '../catalog/catalog.facade';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ProductVariantVm } from '../../../core/models/product-vm.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, NgClass, DatePipe, LoadingSpinnerComponent, EmptyStateComponent, ProductCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogFacade = inject(CatalogFacade);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private favoritesService = inject(FavoritesService);

  @ViewChild('thumbnailStrip') thumbnailStrip?: ElementRef<HTMLElement>;

  product = this.catalogFacade.productDetail;
  loading = this.catalogFacade.loading;
  reviews = this.catalogFacade.reviews;
  recommendations = this.catalogFacade.recommendations;
  
  selectedVariant = signal<ProductVariantVm | null>(null);
  activeImage = signal<string | null>(null);
  addingToCart = signal(false);
  favoriting = signal(false);
  private stripDragging = false;
  private stripMoved = false;
  private dragStartX = 0;
  private dragScrollLeft = 0;
  private touchIdentifier: number | null = null;
  private imageSwipeStartX = 0;

  allImages() {
    const p = this.product();
    if (!p) return [];
    return p.images || [];
  }

  productFacts() {
    const product = this.product();
    if (!product) return [];

    return [
      { label: 'WB ID', value: product.wbNmId ? String(product.wbNmId) : null },
      { label: 'Category', value: product.categoryName || null },
      { label: 'Gender', value: this.findCharacteristicValue(['gender', 'пол']) },
      { label: 'Material', value: this.findCharacteristicValue(['material', 'материал', 'composition', 'состав']) },
      { label: 'Color', value: this.findCharacteristicValue(['color', 'цвет']) },
    ].filter((fact) => !!fact.value);
  }

  get isFavorited(): boolean {
    const product = this.product();
    return !!product && this.favoritesService.isFavorited(product.id);
  }

  constructor() {
    effect(() => {
      const p = this.product();
      if (p) {
        const firstActive = p.variants?.find(v => v.inStock) ?? p.variants?.[0] ?? null;

        if (!this.selectedVariant()) {
          this.selectedVariant.set(firstActive);
        }

        const imgs = p.images || [];
        if (!this.activeImage()) {
          this.activeImage.set(imgs[0] ?? null);
        }
      }
    });

    // Handle slug changes when navigating between products (e.g. from recommendations)
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.catalogFacade.loadProductDetail(slug);
        this.catalogFacade.loadReviews(slug);
        this.catalogFacade.loadRecommendations(slug);
      }
    });
  }

  ngOnInit(): void {
  }

  onThumbnailWheel(event: WheelEvent): void {
    const strip = this.thumbnailStrip?.nativeElement;
    if (!strip) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    strip.scrollLeft += event.deltaY;
  }

  onThumbnailMouseDown(event: MouseEvent): void {
    const strip = this.thumbnailStrip?.nativeElement;
    if (!strip) return;
    if (event.button !== 0) return;
    this.stripDragging = true;
    this.stripMoved = false;
    this.dragStartX = event.clientX;
    this.dragScrollLeft = strip.scrollLeft;
  }

  onThumbnailMouseMove(event: MouseEvent): void {
    const strip = this.thumbnailStrip?.nativeElement;
    if (!strip || !this.stripDragging) return;
    const delta = event.clientX - this.dragStartX;
    if (Math.abs(delta) > 6) {
      this.stripMoved = true;
    }
    strip.scrollLeft = this.dragScrollLeft - delta;
  }

  onThumbnailMouseUp(): void {
    this.stripDragging = false;
  }

  onThumbnailTouchStart(event: TouchEvent): void {
    const strip = this.thumbnailStrip?.nativeElement;
    const touch = event.changedTouches[0];
    if (!strip || !touch) return;
    this.stripDragging = true;
    this.stripMoved = false;
    this.touchIdentifier = touch.identifier;
    this.dragStartX = touch.clientX;
    this.dragScrollLeft = strip.scrollLeft;
  }

  onThumbnailTouchMove(event: TouchEvent): void {
    const strip = this.thumbnailStrip?.nativeElement;
    if (!strip || !this.stripDragging) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.touchIdentifier);
    if (!touch) return;
    const delta = touch.clientX - this.dragStartX;
    if (Math.abs(delta) > 6) {
      this.stripMoved = true;
    }
    strip.scrollLeft = this.dragScrollLeft - delta;
    if (this.stripMoved) {
      event.preventDefault();
    }
  }

  onThumbnailTouchEnd(): void {
    this.stripDragging = false;
    this.touchIdentifier = null;
  }

  preventNativeImageDrag(event: DragEvent): void {
    event.preventDefault();
  }

  selectThumbnail(image: string, event: Event): void {
    if (this.stripMoved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.activeImage.set(image);
  }

  onMainImagePointerDown(event: PointerEvent): void {
    this.imageSwipeStartX = event.clientX;
  }

  onMainImagePointerUp(event: PointerEvent): void {
    const deltaX = event.clientX - this.imageSwipeStartX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) {
      this.goToNextImage();
    } else {
      this.goToPreviousImage();
    }
  }

  private goToNextImage(): void {
    const images = this.allImages();
    if (images.length <= 1) return;
    const currentIndex = images.findIndex((image) => image === this.activeImage());
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % images.length : 0;
    this.activeImage.set(images[nextIndex]);
  }

  private goToPreviousImage(): void {
    const images = this.allImages();
    if (images.length <= 1) return;
    const currentIndex = images.findIndex((image) => image === this.activeImage());
    const previousIndex = currentIndex >= 0 ? (currentIndex - 1 + images.length) % images.length : 0;
    this.activeImage.set(images[previousIndex]);
  }

  toggleFavorite(): void {
    const product = this.product();
    if (!product) return;

    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'CUSTOMER') {
      this.favoritesService.navigateToLogin();
      return;
    }

    const wasFavorited = this.isFavorited;
    this.favoriting.set(true);
    const request = wasFavorited
      ? this.favoritesService.remove(product.id)
      : this.favoritesService.add(product.id);

    request.subscribe({
      next: () => {
        this.favoriting.set(false);
        this.toast.success(wasFavorited ? 'Removed from favorites' : 'Added to favorites');
      },
      error: (err) => {
        this.favoriting.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to update favorites');
      },
    });
  }

  private findCharacteristicValue(keys: string[]): string | null {
    const characteristics = this.product()?.characteristics || [];
    const match = characteristics.find((characteristic) => {
      const name = characteristic.name.toLowerCase();
      return keys.some((key) => name.includes(key));
    });

    return match?.value || null;
  }

  addToCart(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const v = this.selectedVariant();
    if (!v) return;
    
    this.addingToCart.set(true);
    // Passing amount=1
    this.cartService.addItem(v.id, 1).subscribe({
      next: () => {
        this.toast.success('Added to bag!');
        this.addingToCart.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Failed to add to bag');
        this.addingToCart.set(false);
      }
    });
  }
}
