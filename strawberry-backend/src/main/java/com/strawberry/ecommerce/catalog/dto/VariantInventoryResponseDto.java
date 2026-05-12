package com.strawberry.ecommerce.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VariantInventoryResponseDto {
    private UUID variantId;
    private UUID productId;
    private String productTitle;
    private Long wbNmId;
    private String vendorCode;
    private String categoryName;
    private String mainImage;
    private String techSize;
    private String wbSize;
    private Integer stockQuantity;
    private Integer reservedStock;
}
