package com.strawberry.ecommerce.catalog.controller;

import com.strawberry.ecommerce.catalog.dto.ReviewResponseDto;
import com.strawberry.ecommerce.catalog.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public/catalog/products/{slug}/reviews")
@RequiredArgsConstructor
@Tag(name = "Storefront Reviews", description = "Public endpoints for product reviews")
public class ReviewPublicController {

    private final ReviewService reviewService;

    @GetMapping
    @Operation(summary = "Get reviews for a specific product")
    public ResponseEntity<Page<ReviewResponseDto>> getReviews(
            @PathVariable String slug,
            Pageable pageable) {
        return ResponseEntity.ok(reviewService.getProductReviews(slug, pageable));
    }
}
