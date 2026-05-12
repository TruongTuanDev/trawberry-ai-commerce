package com.strawberry.ecommerce.order.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class PaymentDetailResponseDto {
    private UUID orderId;
    private String orderNumber;
    private LocalDateTime orderCreatedAt;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String paymentStatus;
    private BigDecimal transferAmount;
    private LocalDateTime transferTime;
    private String receiptImageUrl;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private BigDecimal orderTotal;
    private String payerName;
    private String reviewNote;
}
