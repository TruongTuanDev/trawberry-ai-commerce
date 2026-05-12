package com.strawberry.ecommerce.order.dto;

import lombok.Data;

@Data
public class PaymentRejectRequestDto {
    private String reason;
}
