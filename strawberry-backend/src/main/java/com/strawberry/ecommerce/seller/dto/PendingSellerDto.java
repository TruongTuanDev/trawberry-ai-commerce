package com.strawberry.ecommerce.seller.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PendingSellerDto {
    private UUID userId;
    private String email;
    private String fullName;
    private String phone;
    private UUID sellerProfileId;
    private String approvalStatus;
    private LocalDateTime createdAt;
}
