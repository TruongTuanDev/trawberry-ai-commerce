package com.strawberry.ecommerce.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductPricingResponseDto {
    private UUID id;
    private String title;
    private Long wbNmId;
    private String vendorCode;
    private String categoryName;
    private String mainImage;
    
    // Summary prices across all variants
    private BigDecimal minBasePrice;
    private BigDecimal maxBasePrice;
    private BigDecimal minDiscountPrice;
    private BigDecimal maxDiscountPrice;
    private boolean hasPriceRange;

    private List<ProductDetailResponseDto.VariantDto> variants;
}
