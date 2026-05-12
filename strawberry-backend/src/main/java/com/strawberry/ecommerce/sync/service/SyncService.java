package com.strawberry.ecommerce.sync.service;

import com.strawberry.ecommerce.audit.service.AuditService;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import com.strawberry.ecommerce.sync.dto.SyncJobMessage;
import com.strawberry.ecommerce.sync.dto.SyncJobRequestDto;
import com.strawberry.ecommerce.sync.dto.SyncJobResponseDto;
import com.strawberry.ecommerce.sync.dto.*;
import com.strawberry.ecommerce.sync.entity.SyncJob;
import com.strawberry.ecommerce.sync.entity.SyncStatus;
import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.entity.TriggerType;
import com.strawberry.ecommerce.sync.repository.SyncJobRepository;
import com.strawberry.ecommerce.wb.entity.ShopWbIntegration;
import com.strawberry.ecommerce.wb.repository.ShopWbIntegrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final ShopRepository shopRepository;
    private final ShopWbIntegrationRepository integrationRepository;
    private final SyncJobRepository syncJobRepository;
    private final SyncMessageProducer syncMessageProducer;
    private final AuditService auditService;

    @Transactional
    public SyncJobResponseDto triggerSync(UUID shopId, SyncJobRequestDto request) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ApiException("Shop not found", HttpStatus.NOT_FOUND));

        return executeTriggerSync(shop, request);
    }

    @Transactional
    public SyncJobResponseDto triggerSyncInternal(UUID shopId, SyncJobRequestDto request) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ApiException("Shop not found", HttpStatus.NOT_FOUND));

        return executeTriggerSync(shop, request);
    }

    private SyncJobResponseDto executeTriggerSync(Shop shop, SyncJobRequestDto request) {
        ShopWbIntegration integration = integrationRepository.findByShopId(shop.getId())
                .orElseThrow(() -> new ApiException("Wildberries Integration not configured for this shop", HttpStatus.BAD_REQUEST));

        if (!Boolean.TRUE.equals(integration.getIsActive())) {
            throw new ApiException("Wildberries Integration is disabled", HttpStatus.BAD_REQUEST);
        }

        SyncType syncType = request.getSyncType();
        TriggerType triggerType = request.getTriggerType() != null ? request.getTriggerType() : TriggerType.MANUAL;

        // Rule: SCHEDULED must use INCREMENTAL only
        if (triggerType == TriggerType.SCHEDULED) {
            syncType = SyncType.INCREMENTAL;
        }

        SyncJob syncJob = new SyncJob();
        syncJob.setShop(shop);
        syncJob.setStatus(SyncStatus.QUEUED);
        syncJob.setSyncType(syncType);
        syncJob.setTriggerType(triggerType);
        syncJob.setStartedAt(ZonedDateTime.now());
        
        SyncJob savedJob = syncJobRepository.save(syncJob);

        SyncJobMessage message = SyncJobMessage.builder()
                .syncJobId(savedJob.getId())
                .shopId(shop.getId())
                .integrationId(integration.getId())
                .syncType(savedJob.getSyncType())
                .triggerType(savedJob.getTriggerType())
                .cursor(integration.getLastCursorNmId())
                .attemptNumber(1)
                .build();

        syncMessageProducer.publishSyncJob(message);

        auditService.logAction(
                "SYNC_JOB_TRIGGERED",
                "SyncJob",
                savedJob.getId().toString(),
                null,
                "{\"syncType\":\"" + savedJob.getSyncType().name() + "\",\"triggerType\":\"" + savedJob.getTriggerType().name() + "\"}"
        );

        return SyncJobResponseDto.builder()
                .syncJobId(savedJob.getId())
                .shopId(shop.getId())
                .syncType(savedJob.getSyncType())
                .status(savedJob.getStatus())
                .startedAt(savedJob.getStartedAt())
                .build();
    }

    @Transactional
    public void updateSyncSettings(UUID shopId, Integer intervalMinutes, Boolean isPaused) {
        ShopWbIntegration integration = integrationRepository.findByShopId(shopId)
                .orElseThrow(() -> new ApiException("Integration not found", HttpStatus.NOT_FOUND));

        if (intervalMinutes != null) {
            if (intervalMinutes < 15 || intervalMinutes > 1440) {
                throw new ApiException("Interval must be between 15 and 1440 minutes", HttpStatus.BAD_REQUEST);
            }
            integration.setSyncIntervalMinutes(intervalMinutes);
        }

        if (isPaused != null) {
            integration.setIsSyncPaused(isPaused);
        }

        integrationRepository.save(integration);
    }

    @Transactional(readOnly = true)
    public List<SyncHistoryDto> getSyncHistory(UUID shopId, int limit) {
        ShopWbIntegration integration = integrationRepository.findByShopId(shopId)
                .orElseThrow(() -> new ApiException("Integration not found", HttpStatus.NOT_FOUND));

        return syncJobRepository.findByShopId(shopId, PageRequest.of(0, limit, Sort.by("startedAt").descending()))
                .stream()
                .map(job -> SyncHistoryDto.builder()
                        .jobId(job.getId())
                        .status(job.getStatus())
                        .syncType(job.getSyncType())
                        .triggerType(job.getTriggerType())
                        .startedAt(job.getStartedAt())
                        .finishedAt(job.getFinishedAt())
                        .durationMs(job.getDurationMs())
                        .totalFetched(job.getTotalFetched())
                        .totalCreated(job.getTotalCreated())
                        .totalUpdated(job.getTotalUpdated())
                        .totalFailed(job.getTotalFailed())
                        .errorSummary(job.getErrorSummary())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SyncHealthDto getSyncHealth(UUID shopId) {
        ShopWbIntegration integration = integrationRepository.findByShopId(shopId)
                .orElseThrow(() -> new ApiException("Integration not found", HttpStatus.NOT_FOUND));

        return SyncHealthDto.builder()
                .lastSuccessfulSyncAt(integration.getLastSyncAt()) // Note: for MVP we use lastSyncAt as a base
                .lastSyncStatus(integration.getLastSyncStatus())
                .lastSyncDurationMs(integration.getLastSyncDurationMs())
                .consecutiveFailureCount(integration.getConsecutiveFailureCount())
                .syncIntervalMinutes(integration.getSyncIntervalMinutes())
                .isSyncPaused(integration.getIsSyncPaused())
                .nextSyncExpectedAt(integration.getNextSyncExpectedAt())
                .build();
    }
}
