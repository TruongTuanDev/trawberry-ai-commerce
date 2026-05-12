package com.strawberry.ecommerce.shop.service;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopOwnershipService {

    private final ShopRepository shopRepository;

    /**
     * Validates that the shop exists and belongs to the specified seller.
     * 
     * @param shopId The ID of the shop to validate
     * @param userId The User ID of the seller (from AuthenticationPrincipal)
     * @return The validated Shop entity
     * @throws ApiException if the shop is not found or the seller is not the owner
     */
    public Shop validateAndGetShop(UUID shopId, UUID userId) {
        return shopRepository.findByIdAndSellerProfileUserId(shopId, userId)
                .orElseThrow(() -> new ApiException(
                        "Shop not found or you do not have permission to manage this shop.", 
                        HttpStatus.FORBIDDEN
                ));
    }
}
