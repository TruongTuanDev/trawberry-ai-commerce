package com.strawberry.ecommerce.sync.repository;

import com.strawberry.ecommerce.sync.entity.SyncJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SyncJobRepository extends JpaRepository<SyncJob, UUID> {
    Page<SyncJob> findByShopId(UUID shopId, Pageable pageable);
    List<SyncJob> findByShopIdOrderByCreatedAtDesc(UUID shopId);
}
