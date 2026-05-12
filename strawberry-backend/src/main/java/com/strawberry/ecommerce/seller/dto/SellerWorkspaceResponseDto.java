package com.strawberry.ecommerce.seller.dto;

import com.strawberry.ecommerce.shop.dto.ShopResponseDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerWorkspaceResponseDto {
    private String approvalStatus;
    private String reviewNote;
    private boolean hasShops;
    private int shopCount;
    private ShopResponseDto currentShop;
}
