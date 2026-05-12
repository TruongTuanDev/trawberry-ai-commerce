package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.service.FavoriteService;
import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/favorites")
@RequiredArgsConstructor
@Tag(name = "Customer Favorites", description = "Customer favorite product management")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerFavoriteController {

    private final FavoriteService favoriteService;

    @GetMapping
    @Operation(summary = "Get my favorite products")
    public ResponseEntity<List<ProductResponseDto>> getFavorites(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(favoriteService.getFavorites(userDetails.getId()));
    }

    @GetMapping("/ids")
    @Operation(summary = "Get my favorite product IDs")
    public ResponseEntity<List<UUID>> getFavoriteProductIds(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(favoriteService.getFavoriteProductIds(userDetails.getId()));
    }

    @PostMapping("/{productId}")
    @Operation(summary = "Add a product to favorites")
    public ResponseEntity<Void> addFavorite(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID productId) {
        favoriteService.addFavorite(userDetails.getId(), productId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{productId}")
    @Operation(summary = "Remove a product from favorites")
    public ResponseEntity<Void> removeFavorite(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID productId) {
        favoriteService.removeFavorite(userDetails.getId(), productId);
        return ResponseEntity.noContent().build();
    }
}
