package com.strawberry.ecommerce.shipping.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ShippingMethodResponseDto {
    private UUID id;
    private String name;
    private String description;
    private Integer estimatedDaysMin;
    private Integer estimatedDaysMax;
    private BigDecimal basePrice;
    private BigDecimal pricePerKg;
}
