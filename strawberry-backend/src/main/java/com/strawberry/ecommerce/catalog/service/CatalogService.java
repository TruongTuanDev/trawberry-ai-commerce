package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.dto.*;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.catalog.repository.ProductVariantRepository;
import com.strawberry.ecommerce.catalog.repository.CategoryRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponseDto> getShopCategories(UUID shopId) {
        return categoryRepository.findCategoriesByShopId(shopId);
    }

    @Transactional(readOnly = true)
    public Page<ProductResponseDto> getMyProducts(UUID shopId, String search, Long wbId, List<Long> categoryIds,
            String visibility, Boolean inStock, Pageable pageable) {

        Specification<Product> spec = (root, q, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("shop").get("id"), shopId));

            if (search != null && !search.isEmpty()) {
                String lq = "%" + search.toLowerCase() + "%";
                if (search.matches("\\d+")) {
                    try {
                        Long nmId = Long.parseLong(search);
                        predicates.add(cb.or(
                                cb.like(cb.lower(root.get("localTitle")), lq),
                                cb.like(cb.lower(root.get("wbTitle")), lq),
                                cb.like(cb.lower(root.get("brand")), lq),
                                cb.like(cb.lower(root.get("wbVendorCode")), lq),
                                cb.equal(root.get("wbNmId"), nmId)));
                    } catch (NumberFormatException e) {
                        predicates.add(cb.or(
                                cb.like(cb.lower(root.get("localTitle")), lq),
                                cb.like(cb.lower(root.get("wbTitle")), lq),
                                cb.like(cb.lower(root.get("brand")), lq),
                                cb.like(cb.lower(root.get("wbVendorCode")), lq)));
                    }
                } else {
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.get("localTitle")), lq),
                            cb.like(cb.lower(root.get("wbTitle")), lq),
                            cb.like(cb.lower(root.get("brand")), lq),
                            cb.like(cb.lower(root.get("wbVendorCode")), lq)));
                }
            }

            if (wbId != null) {
                predicates.add(cb.equal(root.get("wbNmId"), wbId));
            }

            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.get("category").get("id").in(categoryIds));
            }

            if (visibility != null && !visibility.isEmpty()) {
                predicates.add(cb.equal(root.get("visibility"), visibility));
            }

            if (inStock != null) {
                Join<Product, ProductVariant> variants = root.join("variants");
                if (inStock) {
                    predicates.add(cb.greaterThan(variants.get("stockQuantity"), 0));
                } else {
                    predicates.add(cb.lessThanOrEqualTo(variants.get("stockQuantity"), 0));
                }
                q.distinct(true);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return productRepository.findAll(spec, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Product getProductDetail(UUID shopId, UUID productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException("Product not found", HttpStatus.NOT_FOUND));

        if (!product.getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied", HttpStatus.FORBIDDEN);
        }
        return product;
    }

    @Transactional(readOnly = true)
    public ProductDetailResponseDto getProductDetailDto(UUID shopId, UUID productId) {
        Product p = getProductDetail(shopId, productId);
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

    @Transactional
    public void updateProductMetadata(UUID shopId, UUID productId, ProductMetadataRequestDto request) {
        Product product = getProductDetail(shopId, productId);

        if (request.getLocalTitle() != null)
            product.setLocalTitle(request.getLocalTitle());
        if (request.getLocalDescription() != null)
            product.setLocalDescription(request.getLocalDescription());
        if (request.getVisibility() != null)
            product.setVisibility(request.getVisibility());
        if (request.getSlugOverride() != null)
            product.setSeoSlug(request.getSlugOverride());

        productRepository.save(product);
    }

    @Transactional
    public void updateVariantPricing(UUID shopId, UUID variantId, VariantPricingRequestDto request) {
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new ApiException("Variant not found", HttpStatus.NOT_FOUND));

        if (!variant.getProduct().getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied", HttpStatus.FORBIDDEN);
        }

        if (request.getBasePrice() != null)
            variant.setBasePrice(request.getBasePrice());
        if (request.getDiscountPrice() != null)
            variant.setDiscountPrice(request.getDiscountPrice());

        variantRepository.save(variant);
    }

    @Transactional
    public void updateVariantInventory(UUID shopId, UUID variantId, VariantInventoryRequestDto request) {
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new ApiException("Variant not found", HttpStatus.NOT_FOUND));

        if (!variant.getProduct().getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied", HttpStatus.FORBIDDEN);
        }

        if (request.getStockQuantity() != null) {
            if (request.getStockQuantity() < 0) {
                throw new ApiException("Stock quantity cannot be negative", HttpStatus.BAD_REQUEST);
            }
            variant.setStockQuantity(request.getStockQuantity());
        }

        variantRepository.save(variant);
    }

    @Transactional(readOnly = true)
    public Page<ProductPricingResponseDto> getPricingProducts(UUID shopId, String search, List<Long> categoryIds,
            String visibility, Boolean inStock, Pageable pageable) {

        Specification<Product> spec = (root, q, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("shop").get("id"), shopId));

            if (search != null && !search.isEmpty()) {
                String lq = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("localTitle")), lq),
                        cb.like(cb.lower(root.get("wbTitle")), lq),
                        cb.like(cb.lower(root.get("brand")), lq),
                        cb.like(cb.lower(root.get("wbVendorCode")), lq)));
            }

            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.get("category").get("id").in(categoryIds));
            }

            if (visibility != null && !visibility.isEmpty()) {
                predicates.add(cb.equal(root.get("visibility"), visibility));
            }

            if (inStock != null) {
                Join<Product, ProductVariant> variants = root.join("variants");
                if (inStock) {
                    predicates.add(cb.greaterThan(variants.get("stockQuantity"), 0));
                } else {
                    predicates.add(cb.lessThanOrEqualTo(variants.get("stockQuantity"), 0));
                }
                q.distinct(true);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return productRepository.findAll(spec, pageable).map(this::mapToPricingResponse);
    }

    @Transactional
    public void bulkUpdateVariantPricing(UUID shopId, VariantPricingBulkUpdateRequestDto request) {
        for (VariantPricingBulkUpdateRequestDto.VariantPriceUpdate update : request.getUpdates()) {
            ProductVariant variant = variantRepository.findById(update.getVariantId())
                    .orElseThrow(() -> new ApiException("Variant not found: " + update.getVariantId(),
                            HttpStatus.NOT_FOUND));

            if (!variant.getProduct().getShop().getId().equals(shopId)) {
                throw new ApiException("Access denied for variant: " + update.getVariantId(), HttpStatus.FORBIDDEN);
            }

            // Validation
            if (update.getBasePrice() != null) {
                if (update.getBasePrice().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new ApiException("Base price must be greater than zero for variant: " + update.getVariantId(),
                            HttpStatus.BAD_REQUEST);
                }
                variant.setBasePrice(update.getBasePrice());
            }

            if (update.getDiscountPrice() != null) {
                if (update.getDiscountPrice().compareTo(BigDecimal.ZERO) < 0) {
                    throw new ApiException("Discount price cannot be negative for variant: " + update.getVariantId(),
                            HttpStatus.BAD_REQUEST);
                }
                if (update.getBasePrice() != null && update.getDiscountPrice().compareTo(update.getBasePrice()) > 0) {
                    throw new ApiException(
                            "Discount price cannot be greater than base price for variant: " + update.getVariantId(),
                            HttpStatus.BAD_REQUEST);
                } else if (update.getBasePrice() == null
                        && update.getDiscountPrice().compareTo(variant.getBasePrice()) > 0) {
                    throw new ApiException(
                            "Discount price cannot be greater than base price for variant: " + update.getVariantId(),
                            HttpStatus.BAD_REQUEST);
                }
                variant.setDiscountPrice(update.getDiscountPrice());
            }

            variantRepository.save(variant);
        }
    }

    private ProductPricingResponseDto mapToPricingResponse(Product p) {
        List<ProductDetailResponseDto.VariantDto> variants = p.getVariants().stream()
                .map(v -> ProductDetailResponseDto.VariantDto.builder()
                        .id(v.getId())
                        .techSize(v.getTechSize())
                        .wbSize(v.getWbSize())
                        .basePrice(v.getBasePrice())
                        .discountPrice(v.getDiscountPrice())
                        .stockQuantity(v.getStockQuantity())
                        .inStock(v.getStockQuantity() > 0)
                        .build())
                .collect(Collectors.toList());

        BigDecimal minBase = p.getVariants().stream().map(ProductVariant::getBasePrice).min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        BigDecimal maxBase = p.getVariants().stream().map(ProductVariant::getBasePrice).max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        BigDecimal minDisc = p.getVariants().stream()
                .map(v -> v.getDiscountPrice() != null ? v.getDiscountPrice() : v.getBasePrice())
                .min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        BigDecimal maxDisc = p.getVariants().stream()
                .map(v -> v.getDiscountPrice() != null ? v.getDiscountPrice() : v.getBasePrice())
                .max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);

        String mainImg = p.getImages().isEmpty() ? null : p.getImages().get(0).getWbUrl();

        return ProductPricingResponseDto.builder()
                .id(p.getId())
                .title(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                .wbNmId(p.getWbNmId())
                .vendorCode(p.getWbVendorCode())
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : p.getWbCategoryName())
                .mainImage(mainImg)
                .minBasePrice(minBase)
                .maxBasePrice(maxBase)
                .minDiscountPrice(minDisc)
                .maxDiscountPrice(maxDisc)
                .hasPriceRange(!minBase.equals(maxBase) || !minDisc.equals(maxDisc))
                .variants(variants)
                .build();
    }

    private ProductResponseDto mapToResponse(Product p) {
        BigDecimal minPrice = p.getVariants().stream()
                .map(v -> v.getDiscountPrice() != null ? v.getDiscountPrice() : v.getBasePrice())
                .min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        BigDecimal discountPrice = p.getVariants().stream()
                .filter(v -> v.getDiscountPrice() != null)
                .map(ProductVariant::getDiscountPrice)
                .min(BigDecimal::compareTo)
                .orElse(null);

        boolean inStock = p.getVariants().stream()
                .anyMatch(v -> v.getStockQuantity() > 0);

        String mainImg = p.getImages().isEmpty() ? null : p.getImages().get(0).getWbUrl();

        return ProductResponseDto.builder()
                .id(p.getId())
                .slug(p.getSeoSlug())
                .title(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                .brand(p.getBrand())
                .mainImage(mainImg)
                .minPrice(minPrice)
                .discountPrice(discountPrice)
                .inStock(inStock)
                .shopName(p.getShop().getName())
                .shopSlug(p.getShop().getSlug())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : p.getWbCategoryName())
                .wbNmId(p.getWbNmId())
                .vendorCode(p.getWbVendorCode())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<VariantInventoryResponseDto> getInventoryVariants(UUID shopId, String search, List<Long> categoryIds,
            Boolean inStock, Pageable pageable) {

        Specification<ProductVariant> spec = (root, q, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<ProductVariant, Product> productJoin = root.join("product");
            predicates.add(cb.equal(productJoin.get("shop").get("id"), shopId));

            if (search != null && !search.isEmpty()) {
                String lq = "%" + search.toLowerCase() + "%";
                if (search.matches("\\d+")) {
                    try {
                        Long nmId = Long.parseLong(search);
                        predicates.add(cb.or(
                                cb.like(cb.lower(productJoin.get("localTitle")), lq),
                                cb.like(cb.lower(productJoin.get("wbTitle")), lq),
                                cb.like(cb.lower(productJoin.get("brand")), lq),
                                cb.like(cb.lower(productJoin.get("wbVendorCode")), lq),
                                cb.equal(productJoin.get("wbNmId"), nmId)));
                    } catch (NumberFormatException e) {
                        predicates.add(cb.or(
                                cb.like(cb.lower(productJoin.get("localTitle")), lq),
                                cb.like(cb.lower(productJoin.get("wbTitle")), lq),
                                cb.like(cb.lower(productJoin.get("brand")), lq),
                                cb.like(cb.lower(productJoin.get("wbVendorCode")), lq)));
                    }
                } else {
                    predicates.add(cb.or(
                            cb.like(cb.lower(productJoin.get("localTitle")), lq),
                            cb.like(cb.lower(productJoin.get("wbTitle")), lq),
                            cb.like(cb.lower(productJoin.get("brand")), lq),
                            cb.like(cb.lower(productJoin.get("wbVendorCode")), lq)));
                }
            }

            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(productJoin.get("category").get("id").in(categoryIds));
            }

            if (inStock != null) {
                if (inStock) {
                    predicates.add(cb.greaterThan(root.get("stockQuantity"), 0));
                } else {
                    predicates.add(cb.lessThanOrEqualTo(root.get("stockQuantity"), 0));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return variantRepository.findAll(spec, pageable).map(this::mapToInventoryResponse);
    }

    @Transactional
    public void bulkUpdateVariantInventory(UUID shopId, VariantInventoryBulkUpdateRequestDto request) {
        for (VariantInventoryBulkUpdateRequestDto.VariantInventoryUpdate update : request.getUpdates()) {
            ProductVariant variant = variantRepository.findById(update.getVariantId())
                    .orElseThrow(() -> new ApiException("Variant not found: " + update.getVariantId(),
                            HttpStatus.NOT_FOUND));

            if (!variant.getProduct().getShop().getId().equals(shopId)) {
                throw new ApiException("Access denied for variant: " + update.getVariantId(), HttpStatus.FORBIDDEN);
            }

            if (update.getStockQuantity() != null) {
                if (update.getStockQuantity() < 0) {
                    throw new ApiException("Stock quantity cannot be negative for variant: " + update.getVariantId(),
                            HttpStatus.BAD_REQUEST);
                }

                // Only save if changed
                if (!update.getStockQuantity().equals(variant.getStockQuantity())) {
                    variant.setStockQuantity(update.getStockQuantity());
                    variantRepository.save(variant);
                }
            }
        }
    }

    private VariantInventoryResponseDto mapToInventoryResponse(ProductVariant v) {
        Product p = v.getProduct();
        String mainImg = p.getImages().isEmpty() ? null : p.getImages().get(0).getWbUrl();

        return VariantInventoryResponseDto.builder()
                .variantId(v.getId())
                .productId(p.getId())
                .productTitle(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                .wbNmId(p.getWbNmId())
                .vendorCode(p.getWbVendorCode())
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : p.getWbCategoryName())
                .mainImage(mainImg)
                .techSize(v.getTechSize())
                .wbSize(v.getWbSize())
                .stockQuantity(v.getStockQuantity())
                .reservedStock(v.getReservedStock())
                .build();
    }
}
