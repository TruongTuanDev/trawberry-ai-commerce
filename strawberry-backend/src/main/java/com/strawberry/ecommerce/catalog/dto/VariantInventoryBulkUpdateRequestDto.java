package com.strawberry.ecommerce.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VariantInventoryBulkUpdateRequestDto {
    private List<VariantInventoryUpdate> updates;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VariantInventoryUpdate {
        private UUID variantId;
        private Integer stockQuantity;
    }
}
