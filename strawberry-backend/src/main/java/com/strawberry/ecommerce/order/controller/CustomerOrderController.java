package com.strawberry.ecommerce.order.controller;

import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.catalog.dto.ReviewCreateRequestDto;
import com.strawberry.ecommerce.catalog.dto.ReviewResponseDto;
import com.strawberry.ecommerce.catalog.service.ReviewService;
import com.strawberry.ecommerce.order.dto.CheckoutRequestDto;
import com.strawberry.ecommerce.order.dto.OrderResponseDto;
import com.strawberry.ecommerce.order.service.OrderService;
import com.strawberry.ecommerce.shipping.dto.DeliveryIssueRequestDto;
import com.strawberry.ecommerce.shipping.dto.DeliveryIssueResponseDto;
import com.strawberry.ecommerce.shipping.service.DeliveryIssueService;
import com.strawberry.ecommerce.shipping.dto.ShipmentResponseDto;
import com.strawberry.ecommerce.shipping.service.CustomerTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/orders")
@RequiredArgsConstructor
@Tag(name = "Customer Order Controller", description = "Endpoints for customer checkout and order management")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerOrderController {

    private final OrderService orderService;
    private final ReviewService reviewService;
    private final DeliveryIssueService deliveryIssueService;
    private final CustomerTrackingService trackingService;

    @PostMapping("/checkout")
    @Operation(summary = "Checkout entire cart and split into orders by shop")
    public ResponseEntity<List<OrderResponseDto>> checkout(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody CheckoutRequestDto requestDto) {
        return ResponseEntity.ok(orderService.checkout(userDetails.getId(), requestDto));
    }

    @GetMapping
    @Operation(summary = "Get my orders")
    public ResponseEntity<List<OrderResponseDto>> getMyOrders(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(orderService.getMyOrders(userDetails.getId()));
    }

    @GetMapping("/{orderId}")
    @Operation(summary = "Get specific order details")
    public ResponseEntity<OrderResponseDto> getOrderDetails(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(orderService.getOrderDetails(userDetails.getId(), orderId));
    }

    @PostMapping(value = "/{orderId}/payment-confirmation", consumes = {"multipart/form-data"})
    @Operation(summary = "Submit manual bank transfer receipt via Cloudinary upload")
    public ResponseEntity<OrderResponseDto> submitPaymentConfirmation(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId,
            @RequestParam("receiptImage") MultipartFile receiptImage,
            @RequestParam("payerName") String payerName,
            @RequestParam("transferAmount") BigDecimal transferAmount,
            @RequestParam("transferTime") String transferTimeRaw) {
        
        LocalDateTime transferTime = LocalDateTime.parse(transferTimeRaw);
        return ResponseEntity.ok(orderService.submitPaymentConfirmation(
                userDetails.getId(), orderId, receiptImage, payerName, transferAmount, transferTime));
    }

    @GetMapping("/{orderId}/tracking")
    @Operation(summary = "Get shipment tracking information for an order")
    public ResponseEntity<ShipmentResponseDto> getTrackingInfo(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(trackingService.getTrackingInfo(userDetails.getId(), orderId));
    }

    @PostMapping("/{orderId}/complete")
    @Operation(summary = "Customer confirms order completion after delivery")
    public ResponseEntity<OrderResponseDto> completeOrder(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(orderService.completeOrder(userDetails.getId(), orderId));
    }

    @PostMapping("/{orderId}/delivery-issues")
    @Operation(summary = "Report that a delivered order was not actually received")
    public ResponseEntity<DeliveryIssueResponseDto> reportDeliveryIssue(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId,
            @RequestBody(required = false) DeliveryIssueRequestDto request) {
        return ResponseEntity.ok(deliveryIssueService.reportNotReceived(
                userDetails.getId(),
                orderId,
                request != null ? request.getNote() : null));
    }

    @PostMapping("/{orderId}/items/{orderItemId}/review")
    @Operation(summary = "Submit a review for a delivered purchased item")
    public ResponseEntity<ReviewResponseDto> submitReview(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable UUID orderId,
            @PathVariable UUID orderItemId,
            @Valid @RequestBody ReviewCreateRequestDto request) {
        return ResponseEntity.ok(reviewService.submitReview(
                userDetails.getId(),
                orderId,
                orderItemId,
                request.getRate(),
                request.getContent()));
    }
}
