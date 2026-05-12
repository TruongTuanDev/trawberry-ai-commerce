package com.strawberry.ecommerce.shipping.controller;

import com.strawberry.ecommerce.shipping.dto.ShippingMethodResponseDto;
import com.strawberry.ecommerce.shipping.dto.ShippingZoneResponseDto;
import com.strawberry.ecommerce.shipping.service.ShippingRateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public/shipping")
@RequiredArgsConstructor
@Tag(name = "Public Shipping", description = "Public endpoints for shipping zones and methods")
public class PublicShippingController {

    private final ShippingRateService shippingRateService;

    @GetMapping("/zones")
    @Operation(summary = "List all active shipping zones")
    public ResponseEntity<List<ShippingZoneResponseDto>> getZones() {
        return ResponseEntity.ok(shippingRateService.getAllZones());
    }

    @GetMapping("/methods")
    @Operation(summary = "List available shipping methods with pricing for a specific zone")
    public ResponseEntity<List<ShippingMethodResponseDto>> getMethodsForZone(
            @RequestParam(required = false) UUID zoneId) {
        if (zoneId != null) {
            return ResponseEntity.ok(shippingRateService.getMethodsForZone(zoneId));
        }
        return ResponseEntity.ok(shippingRateService.getAllMethods());
    }
}
