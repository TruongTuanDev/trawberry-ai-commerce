package com.strawberry.ecommerce.wb.repository;

import com.strawberry.ecommerce.wb.entity.ShopWbIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShopWbIntegrationRepository extends JpaRepository<ShopWbIntegration, UUID> {
    Optional<ShopWbIntegration> findByShopId(UUID shopId);

    List<ShopWbIntegration> findByIsActiveTrueAndIsSyncPausedFalseAndNextSyncExpectedAtBefore(ZonedDateTime now);

    @Query(value = "SELECT pg_try_advisory_lock(hashtext(:shopIdStr))", nativeQuery = true)
    boolean acquireAdvisoryLock(@Param("shopIdStr") String shopIdStr);

    @Query(value = "SELECT pg_advisory_unlock(hashtext(:shopIdStr))", nativeQuery = true)
    void releaseAdvisoryLock(@Param("shopIdStr") String shopIdStr);
}
