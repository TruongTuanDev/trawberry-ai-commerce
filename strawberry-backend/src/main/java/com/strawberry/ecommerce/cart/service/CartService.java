package com.strawberry.ecommerce.cart.service;

import com.strawberry.ecommerce.cart.dto.CartItemRequestDto;
import com.strawberry.ecommerce.cart.dto.CartItemResponseDto;
import com.strawberry.ecommerce.cart.dto.CartResponseDto;
import com.strawberry.ecommerce.cart.entity.Cart;
import com.strawberry.ecommerce.cart.entity.CartItem;
import com.strawberry.ecommerce.cart.repository.CartItemRepository;
import com.strawberry.ecommerce.cart.repository.CartRepository;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.repository.ProductVariantRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository variantRepository;
    private final UserRepository userRepository;

    @Transactional
    public CartResponseDto getMyCart(UUID customerId) {
        Cart cart = getOrCreateCart(customerId);
        return mapToResponse(cart);
    }

    @Transactional
    public CartResponseDto addItemToCart(UUID customerId, CartItemRequestDto req) {
        Cart cart = getOrCreateCart(customerId);

        ProductVariant variant = variantRepository.findById(req.getVariantId())
                .orElseThrow(() -> new ApiException("Variant not found", HttpStatus.NOT_FOUND));

        if (!Boolean.TRUE.equals(variant.getIsActive())) {
            throw new ApiException("Variant is no longer available", HttpStatus.BAD_REQUEST);
        }

        Product product = variant.getProduct();
        if (!"ACTIVE".equals(product.getVisibility())) {
            throw new ApiException("Product is not available for sale", HttpStatus.BAD_REQUEST);
        }

        if (!"ACTIVE".equals(product.getShop().getStatus().name())) {
            throw new ApiException("Shop is currently inactive", HttpStatus.BAD_REQUEST);
        }

        BigDecimal effectivePrice = (variant.getDiscountPrice() != null && variant.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0) 
            ? variant.getDiscountPrice() 
            : variant.getBasePrice();

        if (effectivePrice == null || effectivePrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException("Product price is not configured yet", HttpStatus.BAD_REQUEST);
        }

        int availableStock = variant.getStockQuantity() - variant.getReservedStock();

        Optional<CartItem> existingItemOpt = cartItemRepository.findByCartIdAndVariantId(cart.getId(), variant.getId());

        if (existingItemOpt.isPresent()) {
            CartItem item = existingItemOpt.get();
            int newQuantity = item.getQuantity() + req.getQuantity();
            if (newQuantity > availableStock) {
                throw new ApiException("Insufficient stock available", HttpStatus.BAD_REQUEST);
            }
            item.setQuantity(newQuantity);
            cartItemRepository.save(item);
        } else {
            if (req.getQuantity() > availableStock) {
                throw new ApiException("Insufficient stock available", HttpStatus.BAD_REQUEST);
            }
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .variant(variant)
                    .quantity(req.getQuantity())
                    .build();
            cartItemRepository.save(newItem);
            cart.getItems().add(newItem);
        }

        return mapToResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponseDto updateItemQuantity(UUID customerId, UUID itemId, CartItemRequestDto req) {
        Cart cart = getOrCreateCart(customerId);

        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new ApiException("Cart item not found", HttpStatus.NOT_FOUND));

        if (!item.getCart().getId().equals(cart.getId())) {
            throw new ApiException("Cart item does not belong to your cart", HttpStatus.FORBIDDEN);
        }
        
        ProductVariant variant = item.getVariant();
        int availableStock = variant.getStockQuantity() - variant.getReservedStock();
        
        if (req.getQuantity() > availableStock) {
            throw new ApiException("Insufficient stock available", HttpStatus.BAD_REQUEST);
        }

        item.setQuantity(req.getQuantity());
        cartItemRepository.save(item);

        return mapToResponse(cart);
    }

    @Transactional
    public CartResponseDto removeItem(UUID customerId, UUID itemId) {
        Cart cart = getOrCreateCart(customerId);

        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new ApiException("Cart item not found", HttpStatus.NOT_FOUND));

        if (!item.getCart().getId().equals(cart.getId())) {
            throw new ApiException("Cart item does not belong to your cart", HttpStatus.FORBIDDEN);
        }

        cart.getItems().remove(item);
        cartItemRepository.delete(item);

        return mapToResponse(cart);
    }

    @Transactional
    public CartResponseDto clearCart(UUID customerId) {
        Cart cart = getOrCreateCart(customerId);
        cartItemRepository.deleteAll(cart.getItems());
        cart.getItems().clear();
        return mapToResponse(cart);
    }

    private Cart getOrCreateCart(UUID customerId) {
        return cartRepository.findByCustomerId(customerId)
                .orElseGet(() -> {
                    User customer = userRepository.findById(customerId)
                            .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));
                    Cart newCart = Cart.builder()
                            .customer(customer)
                            .build();
                    return cartRepository.save(newCart);
                });
    }

    private CartResponseDto mapToResponse(Cart cart) {
        List<CartItemResponseDto> items = cart.getItems().stream()
                .map(item -> {
                    ProductVariant v = item.getVariant();
                    Product p = v.getProduct();
                    BigDecimal price = (v.getDiscountPrice() != null && v.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0) 
                        ? v.getDiscountPrice() 
                        : v.getBasePrice();
                    int availableStock = v.getStockQuantity() - v.getReservedStock();
                    boolean isAvailable = availableStock >= item.getQuantity() 
                        && "ACTIVE".equals(p.getVisibility()) 
                        && "ACTIVE".equals(p.getShop().getStatus().name())
                        && Boolean.TRUE.equals(v.getIsActive())
                        && price != null && price.compareTo(BigDecimal.ZERO) > 0;
                    
                    String image = p.getImages().isEmpty() ? null : p.getImages().get(0).getWbUrl();

                    return CartItemResponseDto.builder()
                            .id(item.getId())
                            .variantId(v.getId())
                            .productId(p.getId())
                            .productTitle(p.getLocalTitle() != null ? p.getLocalTitle() : p.getWbTitle())
                            .productSlug(p.getSeoSlug())
                            .shopName(p.getShop().getName())
                            .shopId(p.getShop().getId())
                            .productImage(image)
                            .techSize(v.getTechSize())
                            .wbSize(v.getWbSize())
                            .quantity(item.getQuantity())
                            .price(price)
                            .isAvailable(isAvailable)
                            .build();
                })
                .collect(Collectors.toList());

        BigDecimal totalPrice = items.stream()
                .filter(CartItemResponseDto::isAvailable)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalItems = items.stream()
                .filter(CartItemResponseDto::isAvailable)
                .mapToInt(CartItemResponseDto::getQuantity)
                .sum();

        return CartResponseDto.builder()
                .id(cart.getId())
                .items(items)
                .totalItems(totalItems)
                .totalPrice(totalPrice)
                .build();
    }
}
