package com.strawberry.ecommerce.shop.repository;

import com.strawberry.ecommerce.shop.entity.Shop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShopRepository extends JpaRepository<Shop, UUID> {
    Optional<Shop> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Shop> findBySellerProfileId(UUID sellerProfileId);

    List<Shop> findBySellerProfileUserId(UUID userId);

    Optional<Shop> findByIdAndSellerProfileUserId(UUID id, UUID userId);
}
