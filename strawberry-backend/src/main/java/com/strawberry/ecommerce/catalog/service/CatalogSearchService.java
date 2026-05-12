package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.dto.CatalogFiltersDto;
import com.strawberry.ecommerce.catalog.dto.ProductDetailResponseDto;
import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogSearchService {

    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public Page<ProductResponseDto> search(
            String query,
            UUID shopId,
            String shopSlug,
            String categoryId,
            String brand,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Boolean inStockOnly,
            UUID excludeId,
            Pageable pageable) {

        Specification<Product> spec = (root, q, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Core Visibility Rules (Readiness Governance)
            predicates.add(cb.equal(root.get("visibility"), "ACTIVE"));
            predicates.add(cb.isNotNull(root.get("seoSlug")));
            predicates.add(cb.isNotEmpty(root.get("variants")));
            
            // Shop must be ACTIVE
            predicates.add(cb.equal(root.get("shop").get("status"), "ACTIVE"));

            // Join variants for price and stock filters
            Join<Product, ProductVariant> variants = root.join("variants");
            predicates.add(cb.isTrue(variants.get("isActive")));

            // Readiness Rule: Effective Price > 0
            // logic: coalesce(discountPrice, basePrice) > 0
            predicates.add(cb.greaterThan(
                cb.coalesce(variants.get("discountPrice"), variants.get("basePrice")), 
                BigDecimal.ZERO
            ));

            // 2. Filters
            if (query != null && !query.isEmpty()) {
                String lq = "%" + query.toLowerCase() + "%";
                if (query.matches("\\d+")) {
                    // If numeric, also search by wbNmId
                    try {
                        Long nmId = Long.parseLong(query);
                        predicates.add(cb.or(
                                cb.like(cb.lower(root.get("localTitle")), lq),
                                cb.like(cb.lower(root.get("wbTitle")), lq),
                                cb.like(cb.lower(root.get("brand")), lq),
                                cb.like(cb.lower(root.get("wbVendorCode")), lq),
                                cb.equal(root.get("wbNmId"), nmId)
                        ));
                    } catch (NumberFormatException e) {
                        predicates.add(cb.or(
                                cb.like(cb.lower(root.get("localTitle")), lq),
                                cb.like(cb.lower(root.get("wbTitle")), lq),
                                cb.like(cb.lower(root.get("brand")), lq),
                                cb.like(cb.lower(root.get("wbVendorCode")), lq)
                        ));
                    }
                } else {
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.get("localTitle")), lq),
                            cb.like(cb.lower(root.get("wbTitle")), lq),
                            cb.like(cb.lower(root.get("brand")), lq),
                            cb.like(cb.lower(root.get("wbVendorCode")), lq)
                    ));
                }
            }

            if (shopId != null) {
                predicates.add(cb.equal(root.get("shop").get("id"), shopId));
            } else if (shopSlug != null) {
                predicates.add(cb.equal(root.get("shop").get("slug"), shopSlug));
            }

            if (categoryId != null && !categoryId.isEmpty()) {
                try {
                    Long cid = Long.parseLong(categoryId);
                    predicates.add(cb.equal(root.get("category").get("id"), cid));
                } catch (NumberFormatException e) {
                    // fallback to string match if they pass category name by accident
                    predicates.add(cb.equal(root.get("wbCategoryName"), categoryId));
                }
            }

            if (brand != null) {
                predicates.add(cb.equal(root.get("brand"), brand));
            }

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(cb.coalesce(variants.get("discountPrice"), variants.get("basePrice")), minPrice));
            }
            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(cb.coalesce(variants.get("discountPrice"), variants.get("basePrice")), maxPrice));
            }

            // By default, search endpoint only returns products in stock for customer feeds
            // Unless explicitly asked otherwise (or we can make this the default)
            if (Boolean.TRUE.equals(inStockOnly)) {
                predicates.add(cb.greaterThan(variants.get("stockQuantity"), 0));
            }
            
            if (excludeId != null) {
                predicates.add(cb.notEqual(root.get("id"), excludeId));
            }

            // Ensure we only get distinct products because of variant join
            q.distinct(true);

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return productRepository.findAll(spec, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public ProductDetailResponseDto getProductBySlug(String slug) {
        Product product = productRepository.findBySeoSlug(slug)
                .orElseThrow(() -> new ApiException("Product not found", HttpStatus.NOT_FOUND));

        if (!"ACTIVE".equals(product.getVisibility())) {
             throw new ApiException("Product not found", HttpStatus.NOT_FOUND);
        }

        return mapToDetailResponse(product);
    }

    @Transactional(readOnly = true)
    public CatalogFiltersDto getFilters() {
        List<Product> products = productRepository.findAll();
        
        List<String> categories = products.stream()
                .filter(p -> "ACTIVE".equals(p.getVisibility()) && p.getSeoSlug() != null && !p.getVariants().isEmpty())
                .map(p -> p.getCategory() != null ? p.getCategory().getName() : p.getWbCategoryName())
                .filter(c -> c != null && !c.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        List<String> brands = products.stream()
                .filter(p -> "ACTIVE".equals(p.getVisibility()) && p.getSeoSlug() != null && !p.getVariants().isEmpty())
                .map(Product::getBrand)
                .filter(b -> b != null && !b.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        return CatalogFiltersDto.builder()
                .categories(categories)
                .brands(brands)
                .build();
    }

    @Transactional(readOnly = true)
    public ProductDetailResponseDto getProductByWbId(Long nmId) {
        Product product = productRepository.findByWbNmId(nmId)
                .orElseThrow(() -> new ApiException("Product not found", HttpStatus.NOT_FOUND));

        if (!"ACTIVE".equals(product.getVisibility())) {
             throw new ApiException("Product not found", HttpStatus.NOT_FOUND);
        }

        return mapToDetailResponse(product);
    }

    private ProductResponseDto mapToResponse(Product p) {
        BigDecimal basePrice = p.getVariants().stream()
                .filter(ProductVariant::getIsActive)
                .map(ProductVariant::getBasePrice)
                .filter(price -> price != null && price.compareTo(BigDecimal.ZERO) > 0)
                .min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        BigDecimal minPrice = p.getVariants().stream()
                .filter(ProductVariant::getIsActive)
                .map(v -> v.getDiscountPrice() != null ? v.getDiscountPrice() : v.getBasePrice())
                .min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        BigDecimal discountPrice = p.getVariants().stream()
                .filter(ProductVariant::getIsActive)
                .filter(v -> v.getDiscountPrice() != null)
                .map(ProductVariant::getDiscountPrice)
                .min(BigDecimal::compareTo)
                .orElse(null);

        if (discountPrice != null && basePrice.compareTo(BigDecimal.ZERO) > 0 && discountPrice.compareTo(basePrice) >= 0) {
            discountPrice = null;
        }

        boolean inStock = p.getVariants().stream()
                .filter(ProductVariant::getIsActive)
                .anyMatch(v -> v.getStockQuantity() > 0);

        String mainImg = p.getImages().isEmpty() ? null : p.getImages().get(0).getWbUrl();

        return ProductResponseDto.builder()
                .id(p.getId())
                .slug(p.getSeoSlug())
                .title(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                .brand(p.getBrand())
                .mainImage(mainImg)
                .basePrice(basePrice)
                .minPrice(minPrice)
                .discountPrice(discountPrice)
                .inStock(inStock)
                .shopName(p.getShop().getName())
                .shopSlug(p.getShop().getSlug())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : p.getWbCategoryName())
                .wbNmId(p.getWbNmId())
                .vendorCode(p.getWbVendorCode())
                .defaultVariantId(p.getVariants().stream()
                        .filter(ProductVariant::getIsActive)
                        .findFirst()
                        .map(ProductVariant::getId)
                        .orElse(null))
                .averageRate(p.getAverageRating())
                .reviewCount(p.getFeedbackCount())
                .build();
    }

    private ProductDetailResponseDto mapToDetailResponse(Product p) {
        return ProductDetailResponseDto.builder()
                .id(p.getId())
                .slug(p.getSeoSlug())
                .title(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                .description(p.getLocalDescription() != null ? p.getLocalDescription() : p.getWbDescription())
                .brand(p.getBrand())
                .category(p.getCategory() != null ? ProductDetailResponseDto.CategoryDto.builder()
                        .id(p.getCategory().getId())
                        .name(p.getCategory().getName())
                        .build() : null)
                .images(p.getImages().stream().map(img -> img.getWbUrl()).collect(Collectors.toList()))
                .characteristics(p.getCharacteristics().stream()
                        .map(c -> ProductDetailResponseDto.CharacteristicDto.builder()
                                .name(c.getName())
                                .value(c.getNormalizedText())
                                .build())
                        .collect(Collectors.toList()))
                .variants(p.getVariants().stream()
                        .filter(ProductVariant::getIsActive)
                        .map(v -> ProductDetailResponseDto.VariantDto.builder()
                                .id(v.getId())
                                .techSize(v.getTechSize())
                                .wbSize(v.getWbSize())
                                .basePrice(v.getBasePrice())
                                .discountPrice(v.getDiscountPrice())
                                .stockQuantity(v.getStockQuantity())
                                .inStock(v.getStockQuantity() > 0)
                                .build())
                        .collect(Collectors.toList()))
                .shop(ProductDetailResponseDto.ShopDto.builder()
                        .id(p.getShop().getId())
                        .name(p.getShop().getName())
                        .slug(p.getShop().getSlug())
                        .build())
                .averageRate(p.getAverageRating())
                .reviewCount(p.getFeedbackCount())
                .wbNmId(p.getWbNmId())
                .build();
    }
}
