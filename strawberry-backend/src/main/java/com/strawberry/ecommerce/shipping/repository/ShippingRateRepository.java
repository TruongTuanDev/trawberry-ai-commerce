package com.strawberry.ecommerce.shipping.repository;

import com.strawberry.ecommerce.shipping.entity.ShippingRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShippingRateRepository extends JpaRepository<ShippingRate, UUID> {
    List<ShippingRate> findByZoneId(UUID zoneId);
    Optional<ShippingRate> findByZoneIdAndMethodId(UUID zoneId, UUID methodId);
}
