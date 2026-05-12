package com.strawberry.ecommerce.shop.service;

import com.strawberry.ecommerce.audit.service.AuditService;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.shop.dto.CreateShopRequest;
import com.strawberry.ecommerce.shop.dto.ShopResponseDto;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.entity.ShopStatus;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.seller.entity.SellerProfile;
import com.strawberry.ecommerce.seller.repository.SellerProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final SellerProfileRepository sellerProfileRepository;
    private final AuditService auditService;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    @Transactional
    public ShopResponseDto createShop(UUID userId, CreateShopRequest request) {
        SellerProfile sellerProfile = sellerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Seller Profile not found", HttpStatus.NOT_FOUND));

        if (!"APPROVED".equals(sellerProfile.getApprovalStatus())) {
            throw new ApiException("Only APPROVED sellers can create a shop", HttpStatus.FORBIDDEN);
        }

        if (shopRepository.existsBySlug(request.getSlug())) {
            throw new ApiException("Shop slug is already taken", HttpStatus.BAD_REQUEST);
        }

        Shop shop = new Shop();
        shop.setSellerProfile(sellerProfile);
        shop.setName(request.getName());
        shop.setSlug(request.getSlug());
        shop.setLogoUrl(request.getLogoUrl());
        shop.setContactInfo(request.getContactInfo());
        shop.setBankName(request.getBankName());
        shop.setAccountNumber(request.getAccountNumber());
        shop.setAccountHolderName(request.getAccountHolderName());
        shop.setBik(request.getBik());
        shop.setCorrespondentAccount(request.getCorrespondentAccount());
        shop.setPaymentInstructions(request.getPaymentInstructions());
        shop.setStatus(ShopStatus.ACTIVE);

        Shop savedShop = shopRepository.save(shop);
        sellerProfile.setCurrentShopId(savedShop.getId());
        sellerProfileRepository.save(sellerProfile);

        auditService.logAction(
                "SHOP_CREATED",
                "Shop",
                savedShop.getId().toString(),
                null,
                "{\"name\":\"" + savedShop.getName() + "\", \"slug\":\"" + savedShop.getSlug() + "\"}");

        return ShopResponseDto.builder()
                .id(savedShop.getId())
                .name(savedShop.getName())
                .slug(savedShop.getSlug())
                .status(savedShop.getStatus().name())
                .build();
    }

    public List<ShopResponseDto> getMyShops(UUID userId) {
        SellerProfile sellerProfile = sellerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException("Seller Profile not found", HttpStatus.NOT_FOUND));
        System.out.println(sellerProfile);

        return shopRepository.findBySellerProfileId(sellerProfile.getId()).stream()
                .map(this::mapToDto)
                .collect(java.util.stream.Collectors.toList());
    }

    public ShopResponseDto getShopDetail(UUID userId, UUID shopId) {
        Shop shop = shopRepository.findByIdAndSellerProfileUserId(shopId, userId)
                .orElseThrow(() -> new ApiException("Shop not found or access denied", HttpStatus.FORBIDDEN));
        return mapToDto(shop);
    }

    @Transactional
    public ShopResponseDto updateShop(UUID userId, UUID shopId, CreateShopRequest request) {
        Shop shop = shopRepository.findByIdAndSellerProfileUserId(shopId, userId)
                .orElseThrow(() -> new ApiException("Shop not found or access denied", HttpStatus.FORBIDDEN));

        if (!shop.getSlug().equals(request.getSlug()) && shopRepository.existsBySlug(request.getSlug())) {
            throw new ApiException("Shop slug is already taken", HttpStatus.BAD_REQUEST);
        }

        shop.setName(request.getName());
        shop.setSlug(request.getSlug());
        shop.setLogoUrl(request.getLogoUrl());
        shop.setContactInfo(request.getContactInfo());
        shop.setBankName(request.getBankName());
        shop.setAccountNumber(request.getAccountNumber());
        shop.setAccountHolderName(request.getAccountHolderName());
        shop.setBik(request.getBik());
        shop.setCorrespondentAccount(request.getCorrespondentAccount());
        shop.setPaymentInstructions(request.getPaymentInstructions());

        Shop saved = shopRepository.save(shop);
        return mapToDto(saved);
    }

    public ShopResponseDto toResponseDto(Shop shop) {
        long productCount = productRepository.countByShopId(shop.getId());
        long newOrderCount = orderRepository.countByShopIdAndStatusIn(shop.getId(), java.util.List.of(OrderStatus.NEW));
        long deliveredOrderCount = orderRepository.countByShopIdAndStatusIn(shop.getId(), java.util.List.of(OrderStatus.DELIVERED));

        return ShopResponseDto.builder()
                .id(shop.getId())
                .name(shop.getName())
                .slug(shop.getSlug())
                .status(shop.getStatus().name())
                .logo(shop.getLogoUrl())
                .contactInfo(shop.getContactInfo())
                .bankName(shop.getBankName())
                .accountNumber(shop.getAccountNumber())
                .accountHolderName(shop.getAccountHolderName())
                .bik(shop.getBik())
                .correspondentAccount(shop.getCorrespondentAccount())
                .paymentInstructions(shop.getPaymentInstructions())
                .productCount(productCount)
                .newOrderCount(newOrderCount)
                .deliveredOrderCount(deliveredOrderCount)
                .build();
    }

    private ShopResponseDto mapToDto(Shop shop) {
        return toResponseDto(shop);
    }
}
