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
public class ProductDetailResponseDto {

    private UUID id;
    private String slug;
    private String title;
    private String description;
    private String brand;
    private CategoryDto category;
    private ShopDto shop;
    private List<String> images;
    private List<CharacteristicDto> characteristics;
    private List<VariantDto> variants;
    private Long wbNmId;
    
    // Future compatibility fields
    private Integer reviewCount;
    private BigDecimal averageRate;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryDto {
        private Long id;
        private String name;
        private String slug;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShopDto {
        private UUID id;
        private String name;
        private String slug;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CharacteristicDto {
        private String name;
        private String value;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VariantDto {
        private UUID id;
        private String techSize;
        private String wbSize;
        private BigDecimal basePrice;
        private BigDecimal discountPrice;
        private Integer stockQuantity;
        private Boolean inStock;
    }
}
