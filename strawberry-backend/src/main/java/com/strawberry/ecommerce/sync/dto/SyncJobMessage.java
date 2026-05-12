package com.strawberry.ecommerce.sync.dto;

import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.entity.TriggerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncJobMessage {
    private UUID syncJobId;
    private UUID shopId;
    private UUID integrationId;
    private SyncType syncType;
    private TriggerType triggerType;
    private Long cursor;
    private int attemptNumber;
}
