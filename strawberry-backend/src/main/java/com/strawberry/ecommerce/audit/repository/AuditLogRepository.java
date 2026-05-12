package com.strawberry.ecommerce.audit.repository;

import com.strawberry.ecommerce.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
}
