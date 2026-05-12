package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.VariantInventoryBulkUpdateRequestDto;
import com.strawberry.ecommerce.catalog.dto.VariantInventoryResponseDto;
import com.strawberry.ecommerce.catalog.dto.VariantPricingBulkUpdateRequestDto;
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
@RequestMapping("/api/v1/seller/shops/{shopId}/variants")
@RequiredArgsConstructor
@Tag(name = "Seller Catalog Variants", description = "Variant-scoped endpoints for inventory management")
public class CatalogVariantSellerController {

    private final CatalogService catalogService;
    private final ShopOwnershipService shopOwnershipService;

    @GetMapping("/inventory")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get a flat list of variants for inventory management")
    public ResponseEntity<Page<VariantInventoryResponseDto>> getInventoryVariants(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, name = "categoryIds") List<Long> categoryIds,
            @RequestParam(required = false) Boolean inStock,
            Pageable pageable) {
        
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(catalogService.getInventoryVariants(shopId, search, categoryIds, inStock, pageable));
    }

    @PostMapping("/bulk-inventory")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Bulk update multiple variant stock quantities")
    public ResponseEntity<Void> bulkUpdateInventory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestBody VariantInventoryBulkUpdateRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        catalogService.bulkUpdateVariantInventory(shopId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-pricing")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Bulk update multiple variant prices")
    public ResponseEntity<Void> bulkUpdatePricing(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestBody VariantPricingBulkUpdateRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        catalogService.bulkUpdateVariantPricing(shopId, request);
        return ResponseEntity.noContent().build();
    }
}
