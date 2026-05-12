package com.strawberry.ecommerce.catalog.repository;

import com.strawberry.ecommerce.catalog.entity.FavoriteProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FavoriteProductRepository extends JpaRepository<FavoriteProduct, UUID> {

    List<FavoriteProduct> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    Optional<FavoriteProduct> findByCustomerIdAndProductId(UUID customerId, UUID productId);

    List<FavoriteProduct> findByCustomerId(UUID customerId);
}
