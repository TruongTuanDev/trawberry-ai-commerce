package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.CatalogFiltersDto;
import com.strawberry.ecommerce.catalog.dto.ProductDetailResponseDto;
import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.service.CatalogSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public/catalog")
@RequiredArgsConstructor
@Tag(name = "Storefront Catalog", description = "Public endpoints for browsing the catalog")
public class CatalogPublicController {

    private final CatalogSearchService searchService;

    @GetMapping({"/search", "/products"})
    @Operation(summary = "Multi-faceted product search (canonical listing)")
    public ResponseEntity<Page<ProductResponseDto>> search(
            @RequestParam(required = false) String search, // Renamed from q to search matching user requirement
            @RequestParam(required = false) UUID shopId,
            @RequestParam(required = false) String shopSlug,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean inStock,
            Pageable pageable) {
        
        return ResponseEntity.ok(searchService.search(search, shopId, shopSlug, categoryId, brand, minPrice, maxPrice, inStock, null, pageable));
    }

    @GetMapping("/products/{slug}")
    @Operation(summary = "Get detailed product information by SEO slug")
    public ResponseEntity<ProductDetailResponseDto> getProductBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(searchService.getProductBySlug(slug));
    }

    @GetMapping("/products/by-wb-id/{nmId}")
    @Operation(summary = "Get detailed product information by Wildberries NM ID")
    public ResponseEntity<ProductDetailResponseDto> getProductByWbId(@PathVariable Long nmId) {
        return ResponseEntity.ok(searchService.getProductByWbId(nmId));
    }

    @GetMapping("/filters")
    @Operation(summary = "Get unique categories and brands from the currently visible catalog")
    public ResponseEntity<CatalogFiltersDto> getFilters() {
        return ResponseEntity.ok(searchService.getFilters());
    }
}
