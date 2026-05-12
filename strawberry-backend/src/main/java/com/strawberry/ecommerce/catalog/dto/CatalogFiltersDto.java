package com.strawberry.ecommerce.catalog.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class CatalogFiltersDto {
    private List<String> categories;
    private List<String> brands;
}
