package com.strawberry.ecommerce.shop.controller;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.service.CatalogSearchService;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.shop.dto.ShopResponseDto;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.entity.ShopStatus;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/public/shops")
@RequiredArgsConstructor
@Tag(name = "Storefront Shops", description = "Public endpoints for shop browsing")
public class ShopPublicController {

    private final ShopRepository shopRepository;
    private final ProductRepository productRepository;
    private final CatalogSearchService searchService;

    @GetMapping("/{shopSlug}")
    @Operation(summary = "Get detailed shop information")
    public ResponseEntity<ShopResponseDto> getShopDetails(@PathVariable String shopSlug) {
        Shop shop = shopRepository.findBySlug(shopSlug)
                .orElseThrow(() -> new ApiException("Shop not found", HttpStatus.NOT_FOUND));

        if (shop.getStatus() != ShopStatus.ACTIVE) {
             throw new ApiException("Shop not found", HttpStatus.NOT_FOUND);
        }

        long productCount = productRepository.countByShopSlugAndVisibilityAndSeoSlugIsNotNull(shopSlug, "ACTIVE");

        ShopResponseDto dto = ShopResponseDto.builder()
                .id(shop.getId())
                .slug(shop.getSlug())
                .name(shop.getName())
                .logo(shop.getLogoUrl())
                .description(shop.getContactInfo()) // Map contact info or any available details to description
                .productCount(productCount)
                .status(shop.getStatus().name())
                .build();

        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{shopSlug}/products")
    @Operation(summary = "Get products for a specific shop")
    public ResponseEntity<Page<ProductResponseDto>> getShopProducts(
            @PathVariable String shopSlug,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean inStock,
            Pageable pageable) {

        return ResponseEntity.ok(searchService.search(
                search,
                null,
                shopSlug,
                categoryId,
                brand,
                minPrice,
                maxPrice,
                inStock,
                null,
                pageable
        ));
    }
}
