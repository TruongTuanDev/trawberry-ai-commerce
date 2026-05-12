package com.strawberry.ecommerce.shop.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.shop.dto.ShopDashboardResponseDto;
import com.strawberry.ecommerce.shop.service.ShopDashboardService;
import com.strawberry.ecommerce.shop.service.ShopOwnershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/shops/{shopId}/dashboard")
@RequiredArgsConstructor
@Tag(name = "Seller Shop Dashboard", description = "Aggregate metrics for the seller dashboard")
public class SellerShopDashboardController {

    private final ShopDashboardService dashboardService;
    private final ShopOwnershipService shopOwnershipService;

    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get aggregate metrics for the shop dashboard")
    public ResponseEntity<ShopDashboardResponseDto> getDashboardMetrics(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(dashboardService.getDashboardMetrics(shopId));
    }
}
