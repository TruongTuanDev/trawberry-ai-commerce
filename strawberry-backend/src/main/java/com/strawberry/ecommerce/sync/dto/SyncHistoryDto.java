package com.strawberry.ecommerce.sync.dto;

import com.strawberry.ecommerce.sync.entity.SyncStatus;
import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.entity.TriggerType;
import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class SyncHistoryDto {
    private UUID jobId;
    private SyncStatus status;
    private SyncType syncType;
    private TriggerType triggerType;
    private ZonedDateTime startedAt;
    private ZonedDateTime finishedAt;
    private Long durationMs;
    private Integer totalFetched;
    private Integer totalCreated;
    private Integer totalUpdated;
    private Integer totalFailed;
    private String errorSummary;
}
