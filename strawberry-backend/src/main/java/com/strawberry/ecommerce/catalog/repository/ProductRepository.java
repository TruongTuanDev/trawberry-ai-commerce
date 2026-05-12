package com.strawberry.ecommerce.catalog.repository;

import com.strawberry.ecommerce.catalog.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {
    Optional<Product> findByShopIdAndWbNmId(UUID shopId, Long wbNmId);
    Optional<Product> findByWbNmId(Long wbNmId);
    Page<Product> findByShopId(UUID shopId, Pageable pageable);
    Optional<Product> findBySeoSlug(String slug);
    long countByShopSlugAndVisibilityAndSeoSlugIsNotNull(String shopSlug, String visibility);
    long countByShopId(UUID shopId);
}

