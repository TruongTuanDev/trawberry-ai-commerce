package com.strawberry.ecommerce.seller.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.seller.dto.SellerWorkspaceResponseDto;
import com.strawberry.ecommerce.seller.service.SellerWorkspaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/workspace")
@RequiredArgsConstructor
@Tag(name = "Seller Workspace", description = "Endpoints for seller workspace entry and active shop context")
@PreAuthorize("hasRole('SELLER')")
public class SellerWorkspaceController {

    private final SellerWorkspaceService sellerWorkspaceService;

    @GetMapping
    @Operation(summary = "Get seller workspace state including approval and current shop")
    public ResponseEntity<SellerWorkspaceResponseDto> getWorkspace(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(sellerWorkspaceService.getWorkspace(userDetails.getId()));
    }

    @PostMapping("/shops/{shopId}/activate")
    @Operation(summary = "Set the current active shop for the seller workspace")
    public ResponseEntity<SellerWorkspaceResponseDto> activateShop(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID shopId) {
        return ResponseEntity.ok(sellerWorkspaceService.activateShop(userDetails.getId(), shopId));
    }
}
