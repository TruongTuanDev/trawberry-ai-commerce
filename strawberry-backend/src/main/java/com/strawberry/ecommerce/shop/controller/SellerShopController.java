package com.strawberry.ecommerce.shop.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.shop.dto.CreateShopRequest;
import com.strawberry.ecommerce.shop.dto.ShopResponseDto;
import com.strawberry.ecommerce.shop.service.ShopService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/shops")
@RequiredArgsConstructor
@Tag(name = "Seller Shop Management", description = "Endpoints for sellers to manage their shops")
public class SellerShopController {

    private final ShopService shopService;

    @PostMapping
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Create a new shop (Requires APPROVED SELLER)")
    public ResponseEntity<ShopResponseDto> createShop(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody CreateShopRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shopService.createShop(userDetails.getId(), request));
    }

    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get all shops for the authenticated seller")
    public ResponseEntity<List<ShopResponseDto>> getMyShops(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(shopService.getMyShops(userDetails.getId()));
    }

    @GetMapping("/{shopId}")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get detail of a specific shop")
    public ResponseEntity<ShopResponseDto> getShopDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        return ResponseEntity.ok(shopService.getShopDetail(userDetails.getId(), shopId));
    }

    @PutMapping("/{shopId}")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update shop settings")
    public ResponseEntity<ShopResponseDto> updateShop(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @Valid @RequestBody CreateShopRequest request) {
        return ResponseEntity.ok(shopService.updateShop(userDetails.getId(), shopId, request));
    }
}
