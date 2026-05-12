package com.strawberry.ecommerce.sync.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.sync.dto.*;
import com.strawberry.ecommerce.sync.service.SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

import com.strawberry.ecommerce.shop.service.ShopOwnershipService;

@RestController
@RequestMapping("/api/v1/seller/shops/{shopId}/sync")
@RequiredArgsConstructor
@Tag(name = "Wildberries Sync", description = "Endpoints to trigger catalog synchronizations")
public class SyncController {

    private final SyncService syncService;
    private final ShopOwnershipService shopOwnershipService;

    @PostMapping("/full")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Trigger a full Wildberries sync job")
    public ResponseEntity<SyncJobResponseDto> triggerFullSync(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {

        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        SyncJobRequestDto request = new SyncJobRequestDto();
        request.setSyncType(com.strawberry.ecommerce.sync.entity.SyncType.FULL);
        SyncJobResponseDto response = syncService.triggerSync(shopId, request);
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/update")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Trigger incremental catalog sync from Wildberries")
    public ResponseEntity<SyncJobResponseDto> triggerIncrementalSync(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestBody @Valid SyncJobRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        if (request.getSyncType() == null) {
            request.setSyncType(com.strawberry.ecommerce.sync.entity.SyncType.INCREMENTAL);
        }
        return ResponseEntity.ok(syncService.triggerSync(shopId, request));
    }

    @PutMapping("/settings")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Update sync settings for a shop")
    public ResponseEntity<Void> updateSyncSettings(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestBody @Valid SyncSettingsRequestDto request) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        syncService.updateSyncSettings(shopId, request.getSyncIntervalMinutes(), request.getIsSyncPaused());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/history")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get sync history for a shop")
    public ResponseEntity<List<SyncHistoryDto>> getSyncHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId,
            @RequestParam(defaultValue = "10") int limit) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(syncService.getSyncHistory(shopId, limit));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Get sync health and statistics for a shop")
    public ResponseEntity<SyncHealthDto> getSyncHealth(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        shopOwnershipService.validateAndGetShop(shopId, userDetails.getId());
        return ResponseEntity.ok(syncService.getSyncHealth(shopId));
    }
}
