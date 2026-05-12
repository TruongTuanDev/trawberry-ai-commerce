package com.strawberry.ecommerce.wb.service;

import com.strawberry.ecommerce.audit.service.AuditService;
import com.strawberry.ecommerce.common.crypto.EncryptionUtils;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import com.strawberry.ecommerce.wb.dto.IntegrationResponseDto;
import com.strawberry.ecommerce.wb.entity.ShopWbIntegration;
import com.strawberry.ecommerce.wb.repository.ShopWbIntegrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WbIntegrationService {

    private final ShopRepository shopRepository;
    private final ShopWbIntegrationRepository integrationRepository;
    private final EncryptionUtils encryptionUtils;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public IntegrationResponseDto getIntegration(UUID shopId) {
        ShopWbIntegration integration = integrationRepository.findByShopId(shopId)
                .orElseThrow(() -> new ApiException("Integration not found for this shop", HttpStatus.NOT_FOUND));

        return mapToDto(integration);
    }

    @Transactional
    public IntegrationResponseDto updateIntegration(UUID shopId, String plainTextApiKey) {
        
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ApiException("Shop not found", HttpStatus.NOT_FOUND));

        String encryptedKey = encryptionUtils.encrypt(plainTextApiKey);

        ShopWbIntegration integration = integrationRepository.findByShopId(shopId)
                .orElseGet(() -> {
                    ShopWbIntegration newIntegration = new ShopWbIntegration();
                    newIntegration.setShop(shop);
                    return newIntegration;
                });

        integration.setApiKeyEncrypted(encryptedKey);
        integration.setIsActive(true);
        ShopWbIntegration savedIntegration = integrationRepository.save(integration);

        auditService.logAction(
                "WB_API_KEY_UPDATED",
                "ShopWbIntegration",
                savedIntegration.getId().toString(),
                null,
                "{\"shopId\":\"" + shop.getId() + "\"}"
        );

        return mapToDto(savedIntegration);
    }

    private IntegrationResponseDto mapToDto(ShopWbIntegration integration) {
        return IntegrationResponseDto.builder()
                .integrationId(integration.getId())
                .shopId(integration.getShop().getId())
                .isActive(integration.getIsActive())
                .updatedAt(integration.getUpdatedAt())
                .build();
    }
}
