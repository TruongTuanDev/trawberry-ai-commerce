package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.CategoryResponseDto;
import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.repository.CategoryRepository;
import com.strawberry.ecommerce.catalog.service.CatalogSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public/catalog/categories")
@RequiredArgsConstructor
@Tag(name = "Storefront Categories", description = "Public endpoints for browsing categories")
public class CategoryPublicController {

    private final CategoryRepository categoryRepository;
    private final CatalogSearchService searchService;

    @GetMapping
    @Operation(summary = "Get all loaded categories with active product counts")
    public ResponseEntity<List<CategoryResponseDto>> getAllCategories() {
        return ResponseEntity.ok(categoryRepository.findActiveCategoriesWithCounts());
    }

    @GetMapping("/{categoryId}/products")
    @Operation(summary = "List all products in a specific category")
    public ResponseEntity<Page<ProductResponseDto>> getCategoryProducts(
            @PathVariable String categoryId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String brand,
            Pageable pageable) {

        return ResponseEntity.ok(searchService.search(
                search,
                null,
                null,
                categoryId,
                brand,
                null,
                null,
                null,
                null,
                pageable
        ));
    }
}
