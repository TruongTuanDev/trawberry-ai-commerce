package com.strawberry.ecommerce.sync.dto;

import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;

@Data
@Builder
public class SyncHealthDto {
    private ZonedDateTime lastSuccessfulSyncAt;
    private ZonedDateTime lastFailedSyncAt;
    private String lastSyncStatus;
    private Long lastSyncDurationMs;
    private Integer consecutiveFailureCount;
    private Integer syncIntervalMinutes;
    private Boolean isSyncPaused;
    private ZonedDateTime nextSyncExpectedAt;
}
