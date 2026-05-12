package com.strawberry.ecommerce.order.repository;

import com.strawberry.ecommerce.order.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.entity.PaymentStatus;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {
    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);
    Optional<Order> findByIdAndCustomerId(UUID id, UUID customerId);
    Optional<Order> findByIdAndShopId(UUID id, UUID shopId);
    long countByShopId(UUID shopId);
    long countByShopIdAndPaymentStatus(UUID shopId, PaymentStatus status);
    long countByShopIdAndStatusIn(UUID shopId, List<OrderStatus> statuses);
    List<Order> findByShopIdOrderByCreatedAtDesc(UUID shopId, Pageable pageable);
}
