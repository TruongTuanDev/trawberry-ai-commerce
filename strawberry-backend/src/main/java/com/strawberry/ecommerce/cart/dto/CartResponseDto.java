package com.strawberry.ecommerce.cart.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CartResponseDto {
    private UUID id;
    private List<CartItemResponseDto> items;
    private int totalItems;
    private BigDecimal totalPrice;
}
