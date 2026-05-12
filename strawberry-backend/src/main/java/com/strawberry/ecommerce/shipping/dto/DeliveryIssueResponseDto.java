package com.strawberry.ecommerce.shipping.dto;

import com.strawberry.ecommerce.shipping.entity.DeliveryIssueStatus;
import com.strawberry.ecommerce.shipping.entity.ShipmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class DeliveryIssueResponseDto {
    private UUID id;
    private UUID orderId;
    private String orderNumber;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private DeliveryIssueStatus status;
    private String customerNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
    private UUID shipmentId;
    private String carrier;
    private String trackingNumber;
    private ShipmentStatus shipmentStatus;
}
