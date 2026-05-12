package com.strawberry.ecommerce.sync.scheduler;

import com.strawberry.ecommerce.sync.dto.SyncJobRequestDto;
import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.entity.TriggerType;
import com.strawberry.ecommerce.sync.service.SyncService;
import com.strawberry.ecommerce.wb.entity.ShopWbIntegration;
import com.strawberry.ecommerce.wb.repository.ShopWbIntegrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class CatalogSyncScheduler {

    private final ShopWbIntegrationRepository integrationRepository;
    private final SyncService syncService;

    @Scheduled(cron = "0 0 */2 * * *")
    public void scheduleIncrementalSyncs() {
        log.debug("Starting scheduled sync check...");
        ZonedDateTime now = ZonedDateTime.now();
        List<ShopWbIntegration> pendingIntegrations = integrationRepository
                .findByIsActiveTrueAndIsSyncPausedFalseAndNextSyncExpectedAtBefore(now);

        for (ShopWbIntegration integration : pendingIntegrations) {
            if (integration != null) {
                processIntegration(integration);
            }
        }
    }

    private void processIntegration(ShopWbIntegration integration) {
        String shopIdStr = integration.getShop().getId().toString();

        // Attempt to acquire advisory lock
        boolean locked = integrationRepository.acquireAdvisoryLock(shopIdStr);
        if (!locked) {
            log.debug("Skip scheduled sync for shop {}: integration is already locked/busy", shopIdStr);
            return;
        }

        try {
            log.info("Triggering scheduled INCREMENTAL sync for shop {}", shopIdStr);

            SyncJobRequestDto request = new SyncJobRequestDto();
            request.setSyncType(SyncType.INCREMENTAL);
            request.setTriggerType(TriggerType.SCHEDULED);

            // triggerSyncInternal saves job and publishes message
            syncService.triggerSyncInternal(integration.getShop().getId(), request);

            // Update next sync time only after successful trigger
            updateNextSyncTime(integration);

        } catch (Exception e) {
            log.error("Failed to trigger scheduled sync for shop {}: {}", shopIdStr, e.getMessage());
        } finally {
            integrationRepository.releaseAdvisoryLock(shopIdStr);
        }
    }

    @Transactional
    protected void updateNextSyncTime(ShopWbIntegration integration) {
        int interval = integration.getSyncIntervalMinutes();
        ZonedDateTime nextSync = ZonedDateTime.now().plusMinutes(interval);
        integration.setNextSyncExpectedAt(nextSync);
        integrationRepository.save(integration);
    }
}
