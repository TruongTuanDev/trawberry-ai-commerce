package com.strawberry.ecommerce.wb.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.wb.dto.IntegrationResponseDto;
import com.strawberry.ecommerce.wb.dto.UpdateIntegrationRequest;
import com.strawberry.ecommerce.wb.service.WbIntegrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

import com.strawberry.ecommerce.shop.service.ShopOwnershipService;

@RestController
@RequestMapping("/api/v1/seller/shops/{shopId}")
@RequiredArgsConstructor
@Tag(name = "WB Integrations", description = "Endpoints to manage WB API Keys")
public class WbIntegrationController {

    private final WbIntegrationService integrationService;
    private final ShopOwnershipService shopOwnershipService;

    @GetMapping("/integration")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get Wildberries Integration settings for a Shop")
    public ResponseEntity<IntegrationResponseDto> getIntegration(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(integrationService.getIntegration(shopId));
    }

    @PutMapping("/api-key")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update Wildberries API Key for a Shop")
    public ResponseEntity<IntegrationResponseDto> updateIntegration(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @Valid @RequestBody UpdateIntegrationRequest request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        IntegrationResponseDto response = integrationService.updateIntegration(shopId, request.getWbApiKey());
        return ResponseEntity.ok(response);
    }
}
