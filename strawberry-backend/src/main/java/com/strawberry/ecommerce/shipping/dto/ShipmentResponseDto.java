package com.strawberry.ecommerce.shipping.dto;

import com.strawberry.ecommerce.shipping.entity.ShipmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ShipmentResponseDto {
    private UUID id;
    private UUID orderId;
    private String carrier;
    private String trackingNumber;
    private ShipmentStatus shipmentStatus;
    private LocalDateTime shippedAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime createdAt;
}
