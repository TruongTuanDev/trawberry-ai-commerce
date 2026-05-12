package com.strawberry.ecommerce.catalog.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class VariantPricingRequestDto {
    private BigDecimal basePrice;
    private BigDecimal discountPrice;
}
