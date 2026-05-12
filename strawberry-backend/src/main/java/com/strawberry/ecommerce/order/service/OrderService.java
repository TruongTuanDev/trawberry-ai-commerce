package com.strawberry.ecommerce.order.service;

import com.strawberry.ecommerce.cart.entity.Cart;
import com.strawberry.ecommerce.cart.entity.CartItem;
import com.strawberry.ecommerce.cart.repository.CartRepository;
import com.strawberry.ecommerce.cart.repository.CartItemRepository;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.repository.ProductVariantRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.common.service.CloudinaryService;
import com.strawberry.ecommerce.catalog.entity.Review;
import com.strawberry.ecommerce.catalog.repository.ReviewRepository;
import com.strawberry.ecommerce.order.dto.CheckoutRequestDto;
import com.strawberry.ecommerce.order.dto.OrderItemResponseDto;
import com.strawberry.ecommerce.order.dto.OrderResponseDto;
import com.strawberry.ecommerce.order.entity.*;
import com.strawberry.ecommerce.order.repository.OrderItemRepository;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.order.repository.PaymentConfirmationRepository;
import com.strawberry.ecommerce.shipping.entity.ShippingMethod;
import com.strawberry.ecommerce.shipping.entity.ShippingZone;
import com.strawberry.ecommerce.shipping.service.DeliveryIssueService;
import com.strawberry.ecommerce.shipping.repository.ShippingMethodRepository;
import com.strawberry.ecommerce.shipping.repository.ShippingZoneRepository;
import com.strawberry.ecommerce.shipping.service.ShippingRateService;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductVariantRepository variantRepository;
    private final UserRepository userRepository;
    private final PaymentConfirmationRepository paymentConfirmationRepository;
    private final ReviewRepository reviewRepository;
    private final CloudinaryService cloudinaryService;
    private final ShippingRateService shippingRateService;
    private final ShippingZoneRepository shippingZoneRepository;
    private final ShippingMethodRepository shippingMethodRepository;
    private final DeliveryIssueService deliveryIssueService;

    @Transactional
    public List<OrderResponseDto> checkout(UUID customerId, CheckoutRequestDto req) {
        Cart cart = cartRepository.findByCustomerId(customerId)
                .orElseThrow(() -> new ApiException("Cart not found", HttpStatus.NOT_FOUND));

        if (cart.getItems().isEmpty()) {
            throw new ApiException("Cart is empty", HttpStatus.BAD_REQUEST);
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));

        ShippingZone shippingZone = shippingZoneRepository.findById(req.getShippingZoneId())
                .orElseThrow(() -> new ApiException("Invalid shipping zone ID", HttpStatus.BAD_REQUEST));
        ShippingMethod shippingMethod = shippingMethodRepository.findById(req.getShippingMethodId())
                .orElseThrow(() -> new ApiException("Invalid shipping method ID", HttpStatus.BAD_REQUEST));

        BigDecimal shippingCostPerOrder = shippingRateService.calculateShippingCost(shippingZone.getId(),
                shippingMethod.getId());

        // Group cart items by shop
        Map<Shop, List<CartItem>> itemsByShop = cart.getItems().stream()
                .collect(Collectors.groupingBy(item -> item.getVariant().getProduct().getShop()));

        List<Order> createdOrders = new ArrayList<>();

        for (Map.Entry<Shop, List<CartItem>> entry : itemsByShop.entrySet()) {
            Shop shop = entry.getKey();
            List<CartItem> shopItems = entry.getValue();

            BigDecimal totalAmount = BigDecimal.ZERO;
            List<OrderItem> orderItems = new ArrayList<>();

            // Build Order entity
            Order order = Order.builder()
                    .customer(customer)
                    .shop(shop)
                    .orderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                    .status(OrderStatus.NEW)
                    .paymentStatus(PaymentStatus.PENDING)
                    .shippingAddress(req.getShippingAddress())
                    .customerName(req.getCustomerName())
                    .customerPhone(req.getCustomerPhone())
                    .customerEmail(req.getCustomerEmail())
                    .customerNote(req.getCustomerNote())
                    .shippingMethod(shippingMethod)
                    .shippingZone(shippingZone)
                    .shippingCost(shippingCostPerOrder)
                    .shippingMethodName(shippingMethod.getName())
                    .totalAmount(BigDecimal.ZERO) // Will set later
                    .build();

            order = orderRepository.save(order);

            for (CartItem cartItem : shopItems) {
                ProductVariant variant = cartItem.getVariant();
                Product product = variant.getProduct();

                // Groups: [Shop Active, Product Active, Variant Active, Price Configured, Stock
                // Available]
                if (!"ACTIVE".equals(shop.getStatus().name())) {
                    throw new ApiException("Shop " + shop.getName() + " is currently inactive", HttpStatus.BAD_REQUEST);
                }
                if (!"ACTIVE".equals(product.getVisibility()) || !Boolean.TRUE.equals(variant.getIsActive())) {
                    throw new ApiException("Product " + product.getWbTitle() + " is no longer available",
                            HttpStatus.BAD_REQUEST);
                }

                BigDecimal price = (variant.getDiscountPrice() != null
                        && variant.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0)
                                ? variant.getDiscountPrice()
                                : variant.getBasePrice();

                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new ApiException("Price is not configured for " + product.getWbTitle(),
                            HttpStatus.BAD_REQUEST);
                }

                int availableStock = variant.getStockQuantity() - variant.getReservedStock();
                if (cartItem.getQuantity() > availableStock) {
                    throw new ApiException("Insufficient stock for product " + product.getWbTitle(),
                            HttpStatus.BAD_REQUEST);
                }

                // Reserve Stock
                variant.setStockQuantity(variant.getStockQuantity() - cartItem.getQuantity());
                variant.setReservedStock(variant.getReservedStock() + cartItem.getQuantity());
                variantRepository.save(variant);

                BigDecimal price2 = variant.getDiscountPrice() != null ? variant.getDiscountPrice()
                        : variant.getBasePrice();
                totalAmount = totalAmount.add(price2.multiply(BigDecimal.valueOf(cartItem.getQuantity())));

                String titleSnapshot = product.getLocalTitle() != null ? product.getLocalTitle() : product.getWbTitle();
                String attributesSnapshot = String.format("Tech Size: %s, WB Size: %s", variant.getTechSize(),
                        variant.getWbSize());
                String imageSnapshot = product.getImages().isEmpty() ? null : product.getImages().get(0).getWbUrl();

                OrderItem orderItem = OrderItem.builder()
                        .order(order)
                        .variant(variant)
                        .quantity(cartItem.getQuantity())
                        .priceAtPurchase(price)
                        .productTitleSnapshot(titleSnapshot)
                        .productSlugSnapshot(product.getSeoSlug())
                        .variantAttributesSnapshot(attributesSnapshot)
                        .productImageSnapshot(imageSnapshot)
                        .wbNmIdSnapshot(product.getWbNmId())
                        .build();

                orderItems.add(orderItem);
            }

            // Adjust total amount to include shipping cost
            order.setTotalAmount(totalAmount.add(shippingCostPerOrder));
            orderItemRepository.saveAll(orderItems);
            order.setItems(orderItems);
            createdOrders.add(order);
        }

        // Clear cart
        cartItemRepository.deleteAll(cart.getItems());
        cart.getItems().clear();

        return createdOrders.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getMyOrders(UUID customerId) {
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrderResponseDto getOrderDetails(UUID customerId, UUID orderId) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));
        return mapToResponse(order);
    }

    @Transactional
    public OrderResponseDto submitPaymentConfirmation(UUID customerId, UUID orderId, MultipartFile receiptImage,
            String payerName, BigDecimal amount, LocalDateTime transferTime) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found or access denied", HttpStatus.NOT_FOUND));

        if (order.getPaymentStatus() != PaymentStatus.PENDING
                && order.getPaymentStatus() != PaymentStatus.REJECTED) {
            throw new ApiException("Order is not eligible for payment confirmation in its current payment state", HttpStatus.BAD_REQUEST);
        }

        if (receiptImage == null || receiptImage.isEmpty()) {
            throw new ApiException("Receipt image is required", HttpStatus.BAD_REQUEST);
        }
        if (payerName == null || payerName.isBlank()) {
            throw new ApiException("Payer name is required", HttpStatus.BAD_REQUEST);
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException("Transfer amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        if (transferTime == null) {
            throw new ApiException("Transfer time is required", HttpStatus.BAD_REQUEST);
        }

        try {
            String receiptUrl = cloudinaryService.uploadReceiptImage(receiptImage, orderId);

            PaymentConfirmation confirmation = PaymentConfirmation.builder()
                    .order(order)
                    .payerName(payerName)
                    .transferAmount(amount)
                    .transferTime(transferTime)
                    .receiptImageUrl(receiptUrl)
                    .reviewNote(null)
                    .build();

            paymentConfirmationRepository.save(confirmation);

            order.setPaymentStatus(PaymentStatus.WAITING_CONFIRMATION);
            orderRepository.save(order);

            return mapToResponse(order);

        } catch (IOException e) {
            throw new ApiException("Failed to upload receipt image", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional
    public OrderResponseDto completeOrder(UUID customerId, UUID orderId) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new ApiException("Only delivered orders can be completed", HttpStatus.BAD_REQUEST);
        }

        if (order.getCustomerCompletedAt() == null) {
            order.setCustomerCompletedAt(LocalDateTime.now());
            orderRepository.save(order);
        }

        return mapToResponse(order);
    }

    private OrderResponseDto mapToResponse(Order order) {
        PaymentConfirmation latestConfirmation = paymentConfirmationRepository
                .findFirstByOrderIdOrderBySubmittedAtDesc(order.getId())
                .orElse(null);

        return OrderResponseDto.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .shopId(order.getShop().getId())
                .shopName(order.getShop().getName())
                .status(order.getStatus().name())
                .paymentStatus(order.getPaymentStatus().name())
                .totalAmount(order.getTotalAmount())
                .shippingAddress(order.getShippingAddress())
                .customerName(order.getCustomerName())
                .customerPhone(order.getCustomerPhone())
                .customerEmail(order.getCustomerEmail())
                .customerNote(order.getCustomerNote())
                .shippingCost(order.getShippingCost())
                .shippingMethodName(order.getShippingMethodName())
                .shippingZoneName(order.getShippingZone() != null ? order.getShippingZone().getName() : null)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .receiptImageUrl(latestConfirmation != null ? latestConfirmation.getReceiptImageUrl() : null)
                .payerName(latestConfirmation != null ? latestConfirmation.getPayerName() : null)
                .transferAmount(latestConfirmation != null ? latestConfirmation.getTransferAmount() : null)
                .transferTime(latestConfirmation != null ? latestConfirmation.getTransferTime() : null)
                .paymentSubmittedAt(latestConfirmation != null ? latestConfirmation.getSubmittedAt() : null)
                .paymentReviewedAt(latestConfirmation != null ? latestConfirmation.getReviewedAt() : null)
                .paymentReviewNote(latestConfirmation != null ? latestConfirmation.getReviewNote() : null)
                .shopPaymentInstructions(order.getShop().getPaymentInstructions())
                .customerCompletedAt(order.getCustomerCompletedAt())
                .deliveryIssue(deliveryIssueService.getLatestForOrder(order.getId()))
                .items(order.getItems().stream().map(item -> OrderItemResponseDto.builder()
                        .id(item.getId())
                        .variantId(item.getVariant() != null ? item.getVariant().getId() : null)
                        .quantity(item.getQuantity())
                        .priceAtPurchase(item.getPriceAtPurchase())
                        .productTitleSnapshot(item.getProductTitleSnapshot())
                        .productSlugSnapshot(item.getProductSlugSnapshot())
                        .variantAttributesSnapshot(item.getVariantAttributesSnapshot())
                        .productImageSnapshot(item.getProductImageSnapshot())
                        .wbNmIdSnapshot(item.getWbNmIdSnapshot())
                        .reviewId(reviewRepository.findByOrderItemId(item.getId()).map(Review::getId).orElse(null))
                        .reviewRate(reviewRepository.findByOrderItemId(item.getId()).map(Review::getRate).orElse(null))
                        .reviewContent(reviewRepository.findByOrderItemId(item.getId()).map(Review::getContent).orElse(null))
                        .reviewCreatedAt(reviewRepository.findByOrderItemId(item.getId()).map(Review::getCreatedAt).orElse(null))
                        .build()).collect(Collectors.toList()))
                .build();
    }
}
