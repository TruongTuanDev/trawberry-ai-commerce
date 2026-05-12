package com.strawberry.ecommerce.catalog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewCreateRequestDto {
    @NotNull
    @Min(1)
    @Max(5)
    private Integer rate;

    private String content;
}
