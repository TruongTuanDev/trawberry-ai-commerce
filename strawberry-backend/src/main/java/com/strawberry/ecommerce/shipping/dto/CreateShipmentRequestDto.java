package com.strawberry.ecommerce.shipping.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateShipmentRequestDto {
    @NotBlank
    private String carrier;

    private String trackingNumber;
}
