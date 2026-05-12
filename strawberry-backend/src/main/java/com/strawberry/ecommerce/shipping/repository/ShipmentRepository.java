package com.strawberry.ecommerce.shipping.repository;

import com.strawberry.ecommerce.shipping.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {
    Optional<Shipment> findByOrderId(UUID orderId);

    @Query("SELECT s FROM Shipment s WHERE s.order.shop.id = :shopId ORDER BY s.createdAt DESC")
    List<Shipment> findByShopId(UUID shopId);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.order.shop.id = :shopId")
    long countByShopId(UUID shopId);
}
