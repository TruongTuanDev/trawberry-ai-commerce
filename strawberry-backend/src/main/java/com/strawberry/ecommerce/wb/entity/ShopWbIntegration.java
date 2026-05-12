package com.strawberry.ecommerce.wb.entity;

import com.strawberry.ecommerce.shop.entity.Shop;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "shop_wb_integrations")
@Getter
@Setter
public class ShopWbIntegration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false, unique = true)
    private Shop shop;

    @Column(name = "api_key_encrypted", nullable = false, length = 1024)
    private String apiKeyEncrypted;

    @Column(length = 20)
    private String locale = "ru";

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_cursor_updated_at")
    private ZonedDateTime lastCursorUpdatedAt;

    @Column(name = "last_cursor_nm_id")
    private Long lastCursorNmId;

    @Column(name = "last_sync_at")
    private ZonedDateTime lastSyncAt;

    @Column(name = "last_sync_status", length = 50)
    private String lastSyncStatus;

    @Column(name = "last_error_message", columnDefinition = "TEXT")
    private String lastErrorMessage;

    @Column(name = "sync_interval_minutes", nullable = false)
    private Integer syncIntervalMinutes = 360;

    @Column(name = "is_sync_paused", nullable = false)
    private Boolean isSyncPaused = false;

    @Column(name = "next_sync_expected_at")
    private ZonedDateTime nextSyncExpectedAt;

    @Column(name = "consecutive_failure_count", nullable = false)
    private Integer consecutiveFailureCount = 0;

    @Column(name = "last_sync_duration_ms")
    private Long lastSyncDurationMs;

    @Column(name = "created_at", insertable = false, updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = ZonedDateTime.now();
    }
}
