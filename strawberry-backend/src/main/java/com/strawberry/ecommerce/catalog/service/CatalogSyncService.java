package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.entity.*;
import com.strawberry.ecommerce.catalog.mapper.WbCatalogMapper;
import com.strawberry.ecommerce.catalog.repository.CategoryRepository;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.common.crypto.EncryptionUtils;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.sync.entity.SyncJob;
import com.strawberry.ecommerce.sync.entity.SyncStatus;
import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.dto.SyncJobMessage;
import com.strawberry.ecommerce.sync.repository.SyncJobRepository;
import com.strawberry.ecommerce.sync.service.SyncMessageProducer;
import com.strawberry.ecommerce.wb.client.WildberriesApiClient;
import com.strawberry.ecommerce.wb.dto.WbCardsRequestDto;
import com.strawberry.ecommerce.wb.dto.WbCardsResponseDto;
import com.strawberry.ecommerce.wb.entity.ShopWbIntegration;
import com.strawberry.ecommerce.wb.repository.ShopWbIntegrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CatalogSyncService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    private final ShopWbIntegrationRepository integrationRepository;
    private final SyncJobRepository syncJobRepository;
    private final WildberriesApiClient apiClient;
    private final WbCatalogMapper mapper;
    private final EncryptionUtils encryptionUtils;
    private final SyncMessageProducer producer;
    private final SlugService slugService;

    @Transactional
    public void processSyncJob(SyncJobMessage message) {
        long startTime = System.currentTimeMillis();
        SyncJob job = syncJobRepository.findById(message.getSyncJobId())
                .orElseThrow(() -> new IllegalArgumentException("SyncJob not found: " + message.getSyncJobId()));

        ShopWbIntegration integration = integrationRepository.findById(message.getIntegrationId())
                .orElseThrow(() -> new IllegalStateException("Integration not found for shop"));

        try {
            job.setStatus(SyncStatus.RUNNING);
            job.setStartedAt(ZonedDateTime.now());
            syncJobRepository.save(job);

            executeSyncWithMetrics(job, integration, message);

            // Success: update job status
            job.setFinishedAt(ZonedDateTime.now());
            job.setDurationMs(System.currentTimeMillis() - startTime);
            
            if (job.getTotalFailed() > 0 && (job.getTotalCreated() > 0 || job.getTotalUpdated() > 0)) {
                job.setStatus(SyncStatus.PARTIAL_SUCCESS);
                integration.setLastSyncStatus("PARTIAL_SUCCESS");
            } else if (job.getTotalFailed() > 0 && job.getTotalCreated() == 0 && job.getTotalUpdated() == 0) {
                job.setStatus(SyncStatus.FAILED);
                job.setErrorSummary("All rows failed to insert");
                integration.setLastSyncStatus("FAILED");
            } else {
                job.setStatus(SyncStatus.SUCCESS);
                integration.setLastSyncStatus("SUCCESS");
                integration.setConsecutiveFailureCount(0); // Reset on success
            }

            syncJobRepository.save(job);

            // Update Integration metrics
            integration.setLastSyncAt(ZonedDateTime.now());
            integration.setLastSyncDurationMs(job.getDurationMs());
            integrationRepository.save(integration);

            log.info("Sync Job {} completed with status {} in {}ms", job.getId(), job.getStatus(), job.getDurationMs());

        } catch (Exception e) {
            handleSyncFailure(job, integration, message, e, startTime);
        }
    }

    private void executeSyncWithMetrics(SyncJob job, ShopWbIntegration integration, SyncJobMessage message) throws Exception {
        String apiKey = encryptionUtils.decrypt(integration.getApiKeyEncrypted());
        WbCardsRequestDto requestDto = buildRequest(message.getSyncType(), integration);

        int totalFetched = 0, totalCreated = 0, totalUpdated = 0, totalFailed = 0;
        WbCardsResponseDto.Cursor lastCursor = null;

        while (true) {
            WbCardsResponseDto response = apiClient.fetchCards(apiKey, requestDto);
            List<WbCardsResponseDto.Card> cards = response.getCards();

            if (cards == null || cards.isEmpty()) {
                break;
            }

            totalFetched += cards.size();

            for (WbCardsResponseDto.Card card : cards) {
                try {
                    boolean isNew = upsertProduct(job.getShop(), card);
                    if (isNew) totalCreated++;
                    else totalUpdated++;
                } catch (Exception e) {
                    log.error("Failed to upsert product {}: {}", card.getNmID(), e.getMessage());
                    totalFailed++;
                }
            }

            lastCursor = response.getCursor();
            if (cards.size() < requestDto.getSettings().getCursor().getLimit()) {
                break;
            }

            requestDto.getSettings().getCursor().setUpdatedAt(lastCursor.getUpdatedAt());
            requestDto.getSettings().getCursor().setNmID(lastCursor.getNmID());

            Thread.sleep(600);
        }

        // Update counts in job object
        job.setTotalFetched(totalFetched);
        job.setTotalCreated(totalCreated);
        job.setTotalUpdated(totalUpdated);
        job.setTotalFailed(totalFailed);

        // Update Integration Cursor
        if (lastCursor != null && lastCursor.getUpdatedAt() != null) {
            integration.setLastCursorNmId(lastCursor.getNmID());
            integration.setLastCursorUpdatedAt(ZonedDateTime.parse(lastCursor.getUpdatedAt()));
        }
    }

    private void handleSyncFailure(SyncJob job, ShopWbIntegration integration, SyncJobMessage message, Exception e, long startTime) {
        log.error("Sync Job {} Failed: {}", job.getId(), e.getMessage(), e);
        
        boolean isTransient = isTransientError(e);
        int maxAttempts = 3;

        if (isTransient && message.getAttemptNumber() < maxAttempts) {
            log.info("Retrying transient error for sync job {} (Attempt {})", job.getId(), message.getAttemptNumber() + 1);
            message.setAttemptNumber(message.getAttemptNumber() + 1);
            producer.publishSyncJob(message);
        } else {
            job.setStatus(SyncStatus.FAILED);
            job.setErrorSummary(e.getMessage());
            job.setFinishedAt(ZonedDateTime.now());
            job.setDurationMs(System.currentTimeMillis() - startTime);
            syncJobRepository.save(job);

            integration.setLastSyncAt(ZonedDateTime.now());
            integration.setLastSyncStatus("FAILED");
            integration.setLastErrorMessage(e.getMessage());
            integration.setConsecutiveFailureCount(integration.getConsecutiveFailureCount() + 1);
            integration.setLastSyncDurationMs(job.getDurationMs());
            integrationRepository.save(integration);
        }
    }

    private boolean isTransientError(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
        if (msg.contains("429") || msg.contains("too many requests")) return true;
        if (msg.contains("502") || msg.contains("503") || msg.contains("504")) return true;
        if (msg.contains("timeout") || msg.contains("connection refused")) return true;
        return false;
    }

    private WbCardsRequestDto buildRequest(SyncType type, ShopWbIntegration integration) {
        WbCardsRequestDto req = WbCardsRequestDto.builder()
                .settings(WbCardsRequestDto.Settings.builder()
                        .cursor(WbCardsRequestDto.Cursor.builder().build())
                        .build())
                .build();
        if (type == SyncType.INCREMENTAL) {
            if (integration.getLastCursorUpdatedAt() != null) {
                // Must convert ZonedDateTime to whatever string WB expects, or just let it use
                // typical ISO formatting
                req.getSettings().getCursor().setUpdatedAt(integration.getLastCursorUpdatedAt().toString());
                req.getSettings().getCursor().setNmID(integration.getLastCursorNmId());
            }
        }
        return req;
    }

    /**
     * @return true if new product created, false if updated
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean upsertProduct(Shop shop, WbCardsResponseDto.Card card) {
        Optional<Product> existingOpt = productRepository.findByShopIdAndWbNmId(shop.getId(), card.getNmID());
        Product product;
        boolean isNew = false;

        if (existingOpt.isPresent()) {
            product = existingOpt.get();
            mapper.updateProductCoreFields(product, card);
        } else {
            product = mapper.mapToNewProduct(shop, card);
            if (product.getSeoSlug() == null || product.getSeoSlug().isEmpty()) {
                String baseTitle = product.getLocalTitle() != null ? product.getLocalTitle() : product.getWbTitle();
                product.setSeoSlug(slugService.makeUniqueSlug(baseTitle, card.getNmID().toString()));
            }
            isNew = true;
        }

        // Link Category
        if (card.getSubjectID() != null) {
            Category category = categoryRepository.findById(card.getSubjectID())
                    .orElseGet(() -> {
                        Category newCat = Category.builder()
                                .id(card.getSubjectID())
                                .name(card.getSubjectName() != null ? card.getSubjectName() : "Unknown")
                                .build();
                        return categoryRepository.save(newCat);
                    });
            product.setCategory(category);
        }

        // Reconciliation for Images
        List<String> incomingPhotoUrls = card.getPhotos() != null ? card.getPhotos().stream()
                .map(p -> p.getBig() != null ? p.getBig() : (p.getHq() != null ? p.getHq() : p.getC516x688()))
                .filter(url -> url != null)
                .distinct()
                .collect(Collectors.toList()) : List.of();
        product.getImages().removeIf(img -> !incomingPhotoUrls.contains(img.getWbUrl()));
        List<String> existingPhotoUrls = product.getImages().stream().map(ProductImage::getWbUrl)
                .collect(Collectors.toList());
        for (String photoUrl : incomingPhotoUrls) {
            if (!existingPhotoUrls.contains(photoUrl)) {
                product.getImages().add(ProductImage.builder()
                        .product(product)
                        .wbUrl(photoUrl)
                        .sortOrder(incomingPhotoUrls.indexOf(photoUrl))
                        .build());
            }
        }

        // Reconciliation for Characteristics
        product.getCharacteristics().clear(); // These are simple value objects, clear and add is usually fine if no
                                              // unique constraint
        product.getCharacteristics().addAll(mapper.mapCharacteristics(product, card.getCharacteristics()));

        // Safely Merge Variants
        mergeVariantsSafe(product, card.getSizes());

        // Reconciliation for Tags
        if (card.getTags() != null) {
            product.getTags().clear(); // Simple for tags
            product.getTags().addAll(card.getTags().stream()
                    .map(t -> ProductTag.builder()
                            .product(product)
                            .wbTagId(t.getId())
                            .name(t.getName())
                            .color(t.getColor())
                            .build())
                    .collect(Collectors.toList()));
        }

        productRepository.save(product);
        return isNew;
    }

    private void mergeVariantsSafe(Product product, List<WbCardsResponseDto.Size> sizeDtos) {
        if (sizeDtos == null)
            return;

        Map<Long, ProductVariant> existingVariants = product.getVariants().stream()
                .collect(Collectors.toMap(ProductVariant::getChrtId, v -> v));

        for (WbCardsResponseDto.Size sizeDto : sizeDtos) {
            ProductVariant variant = existingVariants.remove(sizeDto.getChrtID());
            if (variant != null) {
                // Update simple WB fields
                variant.setTechSize(sizeDto.getTechSize());
                variant.setWbSize(sizeDto.getWbSize());
                variant.setIsActive(true);

                // SKUs reconciliation
                List<String> incomingSkus = sizeDto.getSkus() != null
                        ? sizeDto.getSkus().stream().distinct().collect(Collectors.toList())
                        : List.of();

                variant.getSkus().removeIf(s -> !incomingSkus.contains(s.getSku()));

                List<String> existingSkus = variant.getSkus().stream()
                        .map(ProductVariantSku::getSku)
                        .collect(Collectors.toList());

                for (String s : incomingSkus) {
                    if (!existingSkus.contains(s)) {
                        ProductVariantSku sku = new ProductVariantSku();
                        sku.setVariant(variant);
                        sku.setSku(s);
                        variant.getSkus().add(sku);
                    }
                }
            } else {
                // Completely new variant
                variant = mapper.mapToNewVariant(product, sizeDto);
                product.getVariants().add(variant);
            }
        }

        // Soft delete missing variants
        existingVariants.values().forEach(v -> v.setIsActive(false));
    }
}
