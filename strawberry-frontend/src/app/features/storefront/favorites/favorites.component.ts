import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FavoritesService } from '../../../core/services/favorites.service';
import { CatalogFacade } from '../catalog/catalog.facade';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './favorites.component.html',
})
export class FavoritesComponent implements OnInit {
  private favoritesService = inject(FavoritesService);
  private catalogFacade = inject(CatalogFacade);

  loading = this.favoritesService.loadingProducts;
  favoriteProducts = this.favoritesService.favoriteProducts;
  products = computed(() => this.favoriteProducts().map((product) => this.catalogFacade.mapDtoToCardVm(product)));

  ngOnInit(): void {
    this.favoritesService.loadFavorites().subscribe({ error: () => {} });
  }
}
