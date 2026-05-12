package com.strawberry.ecommerce.shipping.repository;

import com.strawberry.ecommerce.shipping.entity.DeliveryIssueReport;
import com.strawberry.ecommerce.shipping.entity.DeliveryIssueStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryIssueReportRepository extends JpaRepository<DeliveryIssueReport, UUID> {
    Optional<DeliveryIssueReport> findFirstByOrderIdOrderByCreatedAtDesc(UUID orderId);
    boolean existsByOrderIdAndStatusIn(UUID orderId, List<DeliveryIssueStatus> statuses);
    List<DeliveryIssueReport> findByOrderShopIdOrderByCreatedAtDesc(UUID shopId);
}
