package com.strawberry.ecommerce.order.entity;

public enum PaymentStatus {
    PENDING,
    WAITING_CONFIRMATION,
    APPROVED,
    REJECTED,
    REFUNDED
}
