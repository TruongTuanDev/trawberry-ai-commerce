package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final ProductRepository productRepository;
    private final CatalogSearchService searchService;

    @Transactional(readOnly = true)
    public List<ProductResponseDto> getRecommendations(String slug, int limit) {
        Product product = productRepository.findBySeoSlug(slug)
                .orElseThrow(() -> new ApiException("Product not found", HttpStatus.NOT_FOUND));

        String categoryId = product.getCategory() != null ? product.getCategory().getId().toString() : null;
        String brand = product.getBrand();

        // Strategy: 
        // 1. Try to find products in same category
        // 2. If nothing found, try same brand
        // 3. Exclude current product
        
        Page<ProductResponseDto> results = searchService.search(
                null, 
                null, 
                null, 
                categoryId, 
                brand, 
                null, 
                null, 
                true, // inStockOnly
                product.getId(), // excludeId
                PageRequest.of(0, limit)
        );

        return results.getContent();
    }
}
