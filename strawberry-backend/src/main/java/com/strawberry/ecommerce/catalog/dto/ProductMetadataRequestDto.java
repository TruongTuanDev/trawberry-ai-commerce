package com.strawberry.ecommerce.catalog.dto;

import lombok.Data;

@Data
public class ProductMetadataRequestDto {
    private String localTitle;
    private String localDescription;
    private String visibility;
    private String slugOverride;
}
