package com.strawberry.ecommerce.catalog.repository;

import com.strawberry.ecommerce.catalog.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    Page<Review> findByProductIdOrderByCreatedAtDesc(UUID productId, Pageable pageable);
    Page<Review> findByProductSeoSlugOrderByCreatedAtDesc(String slug, Pageable pageable);
    Optional<Review> findByOrderItemId(UUID orderItemId);
    long countByProductId(UUID productId);

    @Query("select coalesce(avg(r.rate), 0) from Review r where r.product.id = :productId")
    BigDecimal findAverageRateByProductId(UUID productId);
}
