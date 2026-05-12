package com.strawberry.ecommerce.order.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class OrderItemResponseDto {
    private UUID id;
    private UUID variantId;
    private Integer quantity;
    private BigDecimal priceAtPurchase;
    private String productTitleSnapshot;
    private String productSlugSnapshot;
    private String variantAttributesSnapshot;
    private String productImageSnapshot;
    private Long wbNmIdSnapshot;
    private UUID reviewId;
    private Integer reviewRate;
    private String reviewContent;
    private LocalDateTime reviewCreatedAt;
}
