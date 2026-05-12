package com.strawberry.ecommerce.cart.controller;

import com.strawberry.ecommerce.cart.dto.CartItemRequestDto;
import com.strawberry.ecommerce.cart.dto.CartResponseDto;
import com.strawberry.ecommerce.cart.service.CartService;
import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/cart")
@RequiredArgsConstructor
@Tag(name = "Cart Controller", description = "Endpoints for customer cart management")
@PreAuthorize("hasRole('CUSTOMER') or hasRole('ADMIN') or hasRole('SELLER')")
public class CartController {

    private final CartService cartService;

    @GetMapping
    @Operation(summary = "Get current user's cart")
    public ResponseEntity<CartResponseDto> getCart(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(cartService.getMyCart(userDetails.getId()));
    }

    @PostMapping("/items")
    @Operation(summary = "Add an item to the cart")
    public ResponseEntity<CartResponseDto> addItemToCart(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody CartItemRequestDto requestDto) {
        return ResponseEntity.ok(cartService.addItemToCart(userDetails.getId(), requestDto));
    }

    @PutMapping("/items/{itemId}")
    @Operation(summary = "Update cart item quantity")
    public ResponseEntity<CartResponseDto> updateItemQuantity(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID itemId,
            @Valid @RequestBody CartItemRequestDto requestDto) {
        return ResponseEntity.ok(cartService.updateItemQuantity(userDetails.getId(), itemId, requestDto));
    }

    @DeleteMapping("/items/{itemId}")
    @Operation(summary = "Remove an item from the cart")
    public ResponseEntity<CartResponseDto> removeItemFromCart(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID itemId) {
        return ResponseEntity.ok(cartService.removeItem(userDetails.getId(), itemId));
    }

    @DeleteMapping
    @Operation(summary = "Clear the entire cart")
    public ResponseEntity<CartResponseDto> clearCart(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(cartService.clearCart(userDetails.getId()));
    }
}
