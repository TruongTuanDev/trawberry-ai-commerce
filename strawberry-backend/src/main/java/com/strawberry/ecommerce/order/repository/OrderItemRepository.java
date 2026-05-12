package com.strawberry.ecommerce.order.repository;

import com.strawberry.ecommerce.order.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    Optional<OrderItem> findByIdAndOrderId(UUID id, UUID orderId);
}
