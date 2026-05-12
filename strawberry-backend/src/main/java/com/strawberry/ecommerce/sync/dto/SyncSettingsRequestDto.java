package com.strawberry.ecommerce.sync.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class SyncSettingsRequestDto {
    @Min(15)
    @Max(1440)
    private Integer syncIntervalMinutes;
    
    private Boolean isSyncPaused;
}
