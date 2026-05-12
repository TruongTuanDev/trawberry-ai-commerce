package com.strawberry.ecommerce.seller.service;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.seller.dto.SellerWorkspaceResponseDto;
import com.strawberry.ecommerce.seller.entity.SellerProfile;
import com.strawberry.ecommerce.seller.repository.SellerProfileRepository;
import com.strawberry.ecommerce.shop.dto.ShopResponseDto;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import com.strawberry.ecommerce.shop.service.ShopService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SellerWorkspaceService {

    private final SellerProfileRepository sellerProfileRepository;
    private final ShopRepository shopRepository;
    private final ShopService shopService;

    @Transactional
    public SellerWorkspaceResponseDto getWorkspace(UUID userId) {
        SellerProfile sellerProfile = getSellerProfile(userId);
        List<Shop> shops = shopRepository.findBySellerProfileId(sellerProfile.getId());
        Shop currentShop = resolveCurrentShop(sellerProfile, shops);

        if (currentShop != null && !currentShop.getId().equals(sellerProfile.getCurrentShopId())) {
            sellerProfile.setCurrentShopId(currentShop.getId());
            sellerProfileRepository.save(sellerProfile);
        }

        return SellerWorkspaceResponseDto.builder()
                .approvalStatus(sellerProfile.getApprovalStatus())
                .reviewNote(sellerProfile.getReviewNote())
                .hasShops(!shops.isEmpty())
                .shopCount(shops.size())
                .currentShop(currentShop != null ? shopService.toResponseDto(currentShop) : null)
                .build();
    }

    @Transactional
    public SellerWorkspaceResponseDto activateShop(UUID userId, UUID shopId) {
        SellerProfile sellerProfile = getSellerProfile(userId);
        Shop shop = shopRepository.findByIdAndSellerProfileUserId(shopId, userId)
                .orElseThrow(() -> new ApiException("Shop not found or access denied", HttpStatus.FORBIDDEN));

        sellerProfile.setCurrentShopId(shop.getId());
        sellerProfileRepository.save(sellerProfile);

        return SellerWorkspaceResponseDto.builder()
                .approvalStatus(sellerProfile.getApprovalStatus())
                .reviewNote(sellerProfile.getReviewNote())
                .hasShops(true)
                .shopCount(shopRepository.findBySellerProfileId(sellerProfile.getId()).size())
                .currentShop(shopService.toResponseDto(shop))
                .build();
    }

    private SellerProfile getSellerProfile(UUID userId) {
        return sellerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Seller Profile not found", HttpStatus.NOT_FOUND));
    }

    private Shop resolveCurrentShop(SellerProfile sellerProfile, List<Shop> shops) {
        if (shops.isEmpty()) {
            return null;
        }

        UUID currentShopId = sellerProfile.getCurrentShopId();
        if (currentShopId != null) {
            return shops.stream()
                    .filter(shop -> shop.getId().equals(currentShopId))
                    .findFirst()
                    .orElse(shops.get(0));
        }

        return shops.get(0);
    }
}
