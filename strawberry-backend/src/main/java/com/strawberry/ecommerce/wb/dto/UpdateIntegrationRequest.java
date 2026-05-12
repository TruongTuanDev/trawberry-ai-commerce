package com.strawberry.ecommerce.wb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateIntegrationRequest {
    @NotBlank
    private String wbApiKey;
}
