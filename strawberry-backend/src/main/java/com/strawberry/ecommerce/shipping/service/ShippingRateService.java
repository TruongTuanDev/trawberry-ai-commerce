package com.strawberry.ecommerce.shipping.service;

import com.strawberry.ecommerce.shipping.dto.ShippingMethodResponseDto;
import com.strawberry.ecommerce.shipping.dto.ShippingZoneResponseDto;
import com.strawberry.ecommerce.shipping.entity.ShippingRate;
import com.strawberry.ecommerce.shipping.entity.ShippingZone;
import com.strawberry.ecommerce.shipping.repository.ShippingMethodRepository;
import com.strawberry.ecommerce.shipping.repository.ShippingRateRepository;
import com.strawberry.ecommerce.shipping.repository.ShippingZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShippingRateService {

    private final ShippingZoneRepository zoneRepository;
    private final ShippingMethodRepository methodRepository;
    private final ShippingRateRepository rateRepository;

    public List<ShippingZoneResponseDto> getAllZones() {
        return zoneRepository.findByIsActiveTrue().stream()
                .map(this::toZoneDto)
                .toList();
    }

    public List<ShippingMethodResponseDto> getMethodsForZone(UUID zoneId) {
        List<ShippingRate> rates = rateRepository.findByZoneId(zoneId);
        return rates.stream()
                .filter(r -> r.getMethod().getIsActive())
                .map(r -> ShippingMethodResponseDto.builder()
                        .id(r.getMethod().getId())
                        .name(r.getMethod().getName())
                        .description(r.getMethod().getDescription())
                        .estimatedDaysMin(r.getMethod().getEstimatedDaysMin())
                        .estimatedDaysMax(r.getMethod().getEstimatedDaysMax())
                        .basePrice(r.getBasePrice())
                        .pricePerKg(r.getPricePerKg())
                        .build())
                .toList();
    }

    public List<ShippingMethodResponseDto> getAllMethods() {
        return methodRepository.findByIsActiveTrue().stream()
                .map(m -> ShippingMethodResponseDto.builder()
                        .id(m.getId())
                        .name(m.getName())
                        .description(m.getDescription())
                        .estimatedDaysMin(m.getEstimatedDaysMin())
                        .estimatedDaysMax(m.getEstimatedDaysMax())
                        .basePrice(BigDecimal.ZERO)
                        .pricePerKg(BigDecimal.ZERO)
                        .build())
                .toList();
    }

    /**
     * Calculate shipping cost for a given zone + method.
     * Falls back to ZERO if no rate is configured (e.g. Pickup).
     */
    public BigDecimal calculateShippingCost(UUID zoneId, UUID methodId) {
        return rateRepository.findByZoneIdAndMethodId(zoneId, methodId)
                .map(ShippingRate::getBasePrice)
                .orElse(BigDecimal.ZERO);
    }

    public ShippingZone getZoneOrThrow(UUID zoneId) {
        return zoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("Shipping zone not found: " + zoneId));
    }

    private ShippingZoneResponseDto toZoneDto(ShippingZone z) {
        return ShippingZoneResponseDto.builder()
                .id(z.getId())
                .name(z.getName())
                .country(z.getCountry())
                .region(z.getRegion())
                .build();
    }
}
