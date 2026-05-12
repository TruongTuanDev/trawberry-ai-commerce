package com.strawberry.ecommerce.shop.dto;

import lombok.Builder;
import lombok.Data;
import java.time.ZonedDateTime;

@Data
@Builder
public class ShopDashboardResponseDto {
    private Long productCount;
    private Long orderCount;
    private Long pendingPaymentCount;
    private Long shipmentCount;
    
    // Sync related
    private String lastSyncStatus;
    private ZonedDateTime lastSuccessfulSyncAt;
    private Integer syncIntervalMinutes;
    private Boolean isSyncPaused;
}
