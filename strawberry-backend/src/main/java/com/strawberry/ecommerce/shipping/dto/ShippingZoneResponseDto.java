package com.strawberry.ecommerce.shipping.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ShippingZoneResponseDto {
    private UUID id;
    private String name;
    private String country;
    private String region;
}
