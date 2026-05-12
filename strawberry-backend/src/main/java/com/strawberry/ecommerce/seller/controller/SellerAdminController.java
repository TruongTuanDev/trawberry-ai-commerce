package com.strawberry.ecommerce.seller.controller;

import com.strawberry.ecommerce.seller.dto.ApprovalResponseDto;
import com.strawberry.ecommerce.seller.dto.PendingSellerDto;
import com.strawberry.ecommerce.seller.service.SellerAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/sellers")
@RequiredArgsConstructor
@Tag(name = "Admin Seller Management", description = "Endpoints for ADMIN to manage sellers")
@PreAuthorize("hasRole('ADMIN')")
public class SellerAdminController {

    private final SellerAdminService sellerAdminService;

    @GetMapping("/pending")
    @Operation(summary = "Get a list of all pending seller registrations")
    public ResponseEntity<List<PendingSellerDto>> getPendingSellers() {
        return ResponseEntity.ok(sellerAdminService.getPendingSellers());
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve a pending seller")
    public ResponseEntity<ApprovalResponseDto> approveSeller(@PathVariable UUID id) {
        return ResponseEntity.ok(sellerAdminService.approveSeller(id));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a pending seller")
    public ResponseEntity<ApprovalResponseDto> rejectSeller(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> payload) {
        String reason = payload != null ? payload.get("reason") : null;
        return ResponseEntity.ok(sellerAdminService.rejectSeller(id, reason));
    }
}
