package com.strawberry.ecommerce.sync.dto;

import com.strawberry.ecommerce.sync.entity.SyncType;
import com.strawberry.ecommerce.sync.entity.TriggerType;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SyncJobRequestDto {
    @NotNull
    private SyncType syncType;

    private TriggerType triggerType;
}
