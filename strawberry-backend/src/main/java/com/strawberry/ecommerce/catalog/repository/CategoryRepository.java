package com.strawberry.ecommerce.catalog.repository;

import com.strawberry.ecommerce.catalog.entity.Category;
import com.strawberry.ecommerce.catalog.dto.CategoryResponseDto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    
    @Query("SELECT new com.strawberry.ecommerce.catalog.dto.CategoryResponseDto(c.id, c.name, COUNT(p.id)) " +
           "FROM Category c JOIN Product p ON p.category = c " +
           "WHERE p.shop.id = :shopId " +
           "GROUP BY c.id, c.name " +
           "ORDER BY c.name ASC")
    List<CategoryResponseDto> findCategoriesByShopId(@Param("shopId") UUID shopId);

    @Query("SELECT new com.strawberry.ecommerce.catalog.dto.CategoryResponseDto(c.id, c.name, COUNT(DISTINCT p.id)) " +
           "FROM Category c JOIN Product p ON p.category = c JOIN p.variants v " +
           "WHERE p.visibility = 'ACTIVE' AND p.seoSlug IS NOT NULL " +
           "AND p.shop.status = 'ACTIVE' " +
           "AND v.isActive = true " +
           "AND v.stockQuantity > 0 " +
           "AND COALESCE(v.discountPrice, v.basePrice) > 0 " +
           "GROUP BY c.id, c.name " +
           "ORDER BY c.name ASC")
    List<CategoryResponseDto> findActiveCategoriesWithCounts();
}
