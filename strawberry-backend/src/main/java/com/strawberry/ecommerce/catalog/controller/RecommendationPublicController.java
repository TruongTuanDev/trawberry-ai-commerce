package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public/catalog/products/{slug}/recommendations")
@RequiredArgsConstructor
@Tag(name = "Storefront Recommendations", description = "Public endpoints for product recommendations")
public class RecommendationPublicController {

    private final RecommendationService recommendationService;

    @GetMapping
    @Operation(summary = "Get recommended products based on the current product")
    public ResponseEntity<List<ProductResponseDto>> getRecommendations(
            @PathVariable String slug,
            @RequestParam(defaultValue = "4") int limit) {
        return ResponseEntity.ok(recommendationService.getRecommendations(slug, limit));
    }
}
