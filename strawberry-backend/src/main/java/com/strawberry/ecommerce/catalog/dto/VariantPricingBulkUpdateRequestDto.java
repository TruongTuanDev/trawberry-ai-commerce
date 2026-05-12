package com.strawberry.ecommerce.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class VariantPricingBulkUpdateRequestDto {
    private List<VariantPriceUpdate> updates;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VariantPriceUpdate {
        private UUID variantId;
        private BigDecimal basePrice;
        private BigDecimal discountPrice;
    }
}
