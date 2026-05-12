package com.strawberry.ecommerce.sync.repository;

import com.strawberry.ecommerce.sync.entity.SyncJobLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SyncJobLogRepository extends JpaRepository<SyncJobLog, UUID> {
}
