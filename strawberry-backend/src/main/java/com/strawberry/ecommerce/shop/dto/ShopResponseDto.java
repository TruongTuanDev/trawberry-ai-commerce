package com.strawberry.ecommerce.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopResponseDto {
    private UUID id;
    private String slug;
    private String name;
    private String logo;
    private String description;
    private String contactInfo;
    private String bankName;
    private String accountNumber;
    private String bankBranch;
    private String accountHolderName;
    private String bik;
    private String correspondentAccount;
    private String paymentInstructions;
    private Long productCount;
    private Long newOrderCount;
    private Long deliveredOrderCount;
    private String status;
}
