package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.*;
import com.strawberry.ecommerce.catalog.service.CatalogService;
import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.shop.service.ShopOwnershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/shops/{shopId}/products")
@RequiredArgsConstructor
@Tag(name = "Seller Catalog", description = "Endpoints for sellers to manage their synced products")
public class CatalogSellerController {

    private final CatalogService catalogService;
    private final ShopOwnershipService shopOwnershipService;

    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get all products for the authenticated seller's shop with filtering")
    public ResponseEntity<Page<ProductResponseDto>> getMyProducts(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long wbId,
            @RequestParam(required = false, name = "categoryIds") List<Long> categoryIds,
            @RequestParam(required = false) String visibility,
            @RequestParam(required = false) Boolean inStock,
            Pageable pageable) {
        
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(catalogService.getMyProducts(shopId, search, wbId, categoryIds, visibility, inStock, pageable));
    }

    @GetMapping("/pricing")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get products for the authenticated seller's shop with rich pricing data for management")
    public ResponseEntity<Page<ProductPricingResponseDto>> getPricingProducts(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, name = "categoryIds") List<Long> categoryIds,
            @RequestParam(required = false) String visibility,
            @RequestParam(required = false) Boolean inStock,
            Pageable pageable) {
        
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(catalogService.getPricingProducts(shopId, search, categoryIds, visibility, inStock, pageable));
    }

    @GetMapping("/categories")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get distinct categories with product counts for a specific shop")
    public ResponseEntity<List<CategoryResponseDto>> getShopCategories(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(catalogService.getShopCategories(shopId));
    }

    @GetMapping("/{productId}")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get detailed product information")
    public ResponseEntity<ProductDetailResponseDto> getProductDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @PathVariable UUID productId) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(catalogService.getProductDetailDto(shopId, productId));
    }

    @PutMapping("/{productId}/metadata")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update product metadata (local title, description, visibility)")
    public ResponseEntity<Void> updateMetadata(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @PathVariable UUID productId,
            @RequestBody ProductMetadataRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        catalogService.updateProductMetadata(shopId, productId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/variants/{variantId}/pricing")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update variant pricing")
    public ResponseEntity<Void> updatePricing(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @PathVariable UUID variantId,
            @RequestBody VariantPricingRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        catalogService.updateVariantPricing(shopId, variantId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/variants/{variantId}/inventory")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update variant inventory")
    public ResponseEntity<Void> updateInventory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @PathVariable UUID variantId,
            @RequestBody VariantInventoryRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        catalogService.updateVariantInventory(shopId, variantId, request);
        return ResponseEntity.noContent().build();
    }
}
