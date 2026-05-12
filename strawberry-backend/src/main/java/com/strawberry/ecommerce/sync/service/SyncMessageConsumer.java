package com.strawberry.ecommerce.sync.service;

import com.strawberry.ecommerce.catalog.service.CatalogSyncService;
import com.strawberry.ecommerce.sync.dto.SyncJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SyncMessageConsumer {

    private final CatalogSyncService catalogSyncService;

    @RabbitListener(queues = com.strawberry.ecommerce.sync.config.RabbitMQConfig.QUEUE_SYNC_JOBS)
    public void consume(SyncJobMessage message) {
        log.info("Received SyncJobMessage from queue: JobId={}, ShopId={}, Type={}",
                message.getSyncJobId(), message.getShopId(), message.getSyncType());

        try {
            catalogSyncService.processSyncJob(message);
        } catch (Exception e) {
            log.error("Error processing sync job message: {}", e.getMessage(), e);
            // In a production environment, we should dead-letter this or retry
            // For MVP Phase 2, we just log and drop from the queue because it's
            // non-recoverable parsing error
        }
    }
}
