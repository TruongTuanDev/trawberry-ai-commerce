package com.strawberry.ecommerce.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductResponseDto {
    private UUID id;
    private String slug;
    private String title;
    private String brand;
    private String mainImage;
    private BigDecimal basePrice;
    private BigDecimal minPrice;
    private BigDecimal discountPrice;
    private Boolean inStock;
    private String shopName;
    private String shopSlug;
    private Long categoryId;
    private String categoryName;
    private Long wbNmId;
    private String vendorCode;
    private UUID defaultVariantId;
    private BigDecimal averageRate;
    private Integer reviewCount;
}
