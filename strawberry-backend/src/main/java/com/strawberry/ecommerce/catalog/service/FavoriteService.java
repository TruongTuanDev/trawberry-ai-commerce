package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.dto.ProductResponseDto;
import com.strawberry.ecommerce.catalog.entity.FavoriteProduct;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.repository.FavoriteProductRepository;
import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteProductRepository favoriteProductRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ProductResponseDto> getFavorites(UUID customerId) {
        return favoriteProductRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(FavoriteProduct::getProduct)
                .filter(this::isVisibleForStorefront)
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UUID> getFavoriteProductIds(UUID customerId) {
        return favoriteProductRepository.findByCustomerId(customerId).stream()
                .map(favorite -> favorite.getProduct().getId())
                .toList();
    }

    @Transactional
    public void addFavorite(UUID customerId, UUID productId) {
        if (favoriteProductRepository.findByCustomerIdAndProductId(customerId, productId).isPresent()) {
            return;
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException("Product not found", HttpStatus.NOT_FOUND));

        if (!isVisibleForStorefront(product)) {
            throw new ApiException("Product is not available for favorites", HttpStatus.BAD_REQUEST);
        }

        favoriteProductRepository.save(FavoriteProduct.builder()
                .customer(customer)
                .product(product)
                .build());
    }

    @Transactional
    public void removeFavorite(UUID customerId, UUID productId) {
        FavoriteProduct favorite = favoriteProductRepository.findByCustomerIdAndProductId(customerId, productId)
                .orElseThrow(() -> new ApiException("Favorite not found", HttpStatus.NOT_FOUND));
        favoriteProductRepository.delete(favorite);
    }

    private boolean isVisibleForStorefront(Product product) {
        if (product == null) return false;
        if (!"ACTIVE".equals(product.getVisibility())) return false;
        if (product.getSeoSlug() == null || product.getSeoSlug().isBlank()) return false;
        if (product.getShop() == null || product.getShop().getStatus() == null || !"ACTIVE".equals(product.getShop().getStatus().name())) {
            return false;
        }

        return product.getVariants().stream()
                .filter(ProductVariant::getIsActive)
                .map(variant -> variant.getDiscountPrice() != null ? variant.getDiscountPrice() : variant.getBasePrice())
                .anyMatch(price -> price != null && price.compareTo(BigDecimal.ZERO) > 0);
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
}
