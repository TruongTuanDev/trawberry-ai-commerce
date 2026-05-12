package com.strawberry.ecommerce.sync.dto;

import com.strawberry.ecommerce.sync.entity.SyncStatus;
import com.strawberry.ecommerce.sync.entity.SyncType;
import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class SyncJobResponseDto {
    private UUID syncJobId;
    private UUID shopId;
    private SyncType syncType;
    private SyncStatus status;
    private ZonedDateTime startedAt;
}
