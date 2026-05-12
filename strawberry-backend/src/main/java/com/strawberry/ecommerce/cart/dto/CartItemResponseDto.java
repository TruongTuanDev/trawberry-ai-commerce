package com.strawberry.ecommerce.cart.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class CartItemResponseDto {
    private UUID id;
    private UUID variantId;
    private UUID productId;
    private String productTitle;
    private String productSlug;
    private String shopName;
    private UUID shopId;
    private String productImage;
    private String techSize;
    private String wbSize;
    private Integer quantity;
    private BigDecimal price;
    private boolean isAvailable;
}
