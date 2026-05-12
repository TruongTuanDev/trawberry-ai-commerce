package com.strawberry.ecommerce.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CheckoutRequestDto {
    @NotBlank(message = "Shipping address is required")
    private String shippingAddress;
    
    @NotBlank(message = "Full name is required")
    private String customerName;
    
    @NotBlank(message = "Phone number is required")
    private String customerPhone;
    
    private String customerEmail;
    
    private String customerNote;

    @NotNull(message = "Shipping method ID cannot be null")
    private UUID shippingMethodId;

    @NotNull(message = "Shipping zone ID cannot be null")
    private UUID shippingZoneId;
}
