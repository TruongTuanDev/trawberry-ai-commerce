package com.strawberry.ecommerce.order.service;

import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import com.strawberry.ecommerce.catalog.entity.Review;
import com.strawberry.ecommerce.catalog.repository.ReviewRepository;
import com.strawberry.ecommerce.catalog.repository.ProductVariantRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.order.dto.OrderItemResponseDto;
import com.strawberry.ecommerce.order.dto.OrderResponseDto;
import com.strawberry.ecommerce.order.dto.PaymentDetailResponseDto;
import com.strawberry.ecommerce.order.entity.Order;
import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.entity.PaymentConfirmation;
import com.strawberry.ecommerce.order.entity.PaymentStatus;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.order.repository.PaymentConfirmationRepository;
import com.strawberry.ecommerce.shipping.service.DeliveryIssueService;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SellerOrderService {

    private final OrderRepository orderRepository;
    private final PaymentConfirmationRepository paymentConfirmationRepository;
    private final ProductVariantRepository variantRepository;
    private final ReviewRepository reviewRepository;
    private final DeliveryIssueService deliveryIssueService;

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getShopOrders(UUID shopId, OrderStatus status, PaymentStatus paymentStatus) {

        List<Order> orders = orderRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("shop").get("id"), shopId));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (paymentStatus != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        });

        return orders.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrderResponseDto getOrderDetails(UUID shopId, UUID orderId) {
        return mapToResponse(getOrderForSeller(shopId, orderId));
    }

    @Transactional(readOnly = true)
    public Page<PaymentDetailResponseDto> getDetailedPayments(UUID shopId, int page, int size, String search,
            PaymentStatus status, LocalDate fromDate, LocalDate toDate) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.max(size, 1));

        Page<Order> orders = orderRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Order, PaymentConfirmation> latestConfirmation = root.join("paymentConfirmations");
            Subquery<LocalDateTime> latestSubmittedAtSubquery = query.subquery(LocalDateTime.class);
            var subRoot = latestSubmittedAtSubquery.from(Order.class);
            var subConfirmation = subRoot.join("paymentConfirmations");
            latestSubmittedAtSubquery.select(cb.greatest(subConfirmation.<LocalDateTime>get("submittedAt")))
                    .where(cb.equal(subRoot.get("id"), root.get("id")));

            predicates.add(cb.equal(root.get("shop").get("id"), shopId));
            predicates.add(cb.equal(latestConfirmation.get("submittedAt"), latestSubmittedAtSubquery));

            List<PaymentStatus> visibleStatuses = List.of(
                    PaymentStatus.WAITING_CONFIRMATION,
                    PaymentStatus.APPROVED,
                    PaymentStatus.REJECTED,
                    PaymentStatus.REFUNDED);

            if (status != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), status));
            } else {
                predicates.add(root.get("paymentStatus").in(visibleStatuses));
            }

            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("customerName")), like),
                        cb.like(cb.lower(root.get("customerEmail")), like),
                        cb.like(cb.lower(root.get("customerPhone")), like),
                        cb.like(cb.lower(root.get("orderNumber")), like)));
            }

            LocalDateTime fromDateTime = fromDate != null ? fromDate.atStartOfDay() : null;
            LocalDateTime toDateTime = toDate != null ? toDate.plusDays(1).atStartOfDay() : null;
            if (fromDateTime != null) {
                predicates.add(cb.greaterThanOrEqualTo(latestConfirmation.get("submittedAt"), fromDateTime));
            }
            if (toDateTime != null) {
                predicates.add(cb.lessThan(latestConfirmation.get("submittedAt"), toDateTime));
            }

            query.orderBy(
                    cb.asc(cb.selectCase(root.get("paymentStatus"))
                            .when(PaymentStatus.WAITING_CONFIRMATION, 0)
                            .when(PaymentStatus.APPROVED, 1)
                            .when(PaymentStatus.REJECTED, 2)
                            .when(PaymentStatus.REFUNDED, 3)
                            .otherwise(4)),
                    cb.desc(latestConfirmation.get("submittedAt")));

            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable);

        return orders.map(this::mapToPaymentDetail);
    }

    @Transactional
    public OrderResponseDto approvePayment(UUID shopId, UUID orderId) {
        Order order = getOrderForSeller(shopId, orderId);

        if (order.getPaymentStatus() != PaymentStatus.WAITING_CONFIRMATION) {
            throw new ApiException("Order is not currently waiting for payment confirmation", HttpStatus.BAD_REQUEST);
        }

        order.setPaymentStatus(PaymentStatus.APPROVED);

        paymentConfirmationRepository.findFirstByOrderIdOrderBySubmittedAtDesc(order.getId())
                .ifPresent(confirmation -> {
                    confirmation.setReviewedAt(LocalDateTime.now());
                    confirmation.setReviewNote(null);
                    paymentConfirmationRepository.save(confirmation);
                });

        return mapToResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponseDto rejectPayment(UUID shopId, UUID orderId, String reason) {
        Order order = getOrderForSeller(shopId, orderId);

        if (order.getPaymentStatus() != PaymentStatus.WAITING_CONFIRMATION) {
            throw new ApiException("Order is not currently waiting for payment confirmation", HttpStatus.BAD_REQUEST);
        }

        order.setPaymentStatus(PaymentStatus.REJECTED);

        paymentConfirmationRepository.findFirstByOrderIdOrderBySubmittedAtDesc(order.getId())
                .ifPresent(confirmation -> {
                    confirmation.setReviewedAt(LocalDateTime.now());
                    confirmation.setReviewNote(reason);
                    paymentConfirmationRepository.save(confirmation);
                });

        return mapToResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponseDto updateFulfillmentStatus(UUID shopId, UUID orderId, OrderStatus newStatus) {
        Order order = getOrderForSeller(shopId, orderId);
        OrderStatus currentStatus = order.getStatus();

        if (newStatus == OrderStatus.ASSEMBLING) {
            if (currentStatus != OrderStatus.NEW) {
                throw new ApiException("Can only transition to ASSEMBLING from NEW", HttpStatus.BAD_REQUEST);
            }
            if (order.getPaymentStatus() != PaymentStatus.APPROVED) {
                throw new ApiException("Cannot assemble order until payment is APPROVED", HttpStatus.BAD_REQUEST);
            }
        } 
        else if (newStatus == OrderStatus.SHIPPING) {
            if (currentStatus != OrderStatus.ASSEMBLING) {
                throw new ApiException("Can only transition to SHIPPING from ASSEMBLING", HttpStatus.BAD_REQUEST);
            }
        } 
        else if (newStatus == OrderStatus.DELIVERED) {
            if (currentStatus != OrderStatus.SHIPPING) {
                throw new ApiException("Can only transition to DELIVERED from SHIPPING", HttpStatus.BAD_REQUEST);
            }
            order.getItems().forEach(item -> {
                ProductVariant variant = item.getVariant();
                if (variant != null) {
                    variant.setReservedStock(Math.max(0, variant.getReservedStock() - item.getQuantity()));
                    variantRepository.save(variant);
                }
            });
        } 
        else if (newStatus == OrderStatus.CANCELLED) {
            if (currentStatus == OrderStatus.SHIPPING || currentStatus == OrderStatus.DELIVERED) {
                throw new ApiException("Cannot cancel orders that are already shipped or delivered", HttpStatus.BAD_REQUEST);
            }
            order.getItems().forEach(item -> {
                ProductVariant variant = item.getVariant();
                if (variant != null) {
                    variant.setReservedStock(Math.max(0, variant.getReservedStock() - item.getQuantity()));
                    variant.setStockQuantity(variant.getStockQuantity() + item.getQuantity());
                    variantRepository.save(variant);
                }
            });
        } 
        else {
            if (currentStatus == newStatus) {
                return mapToResponse(order);
            }
            throw new ApiException("Invalid status transition from " + currentStatus + " to " + newStatus, HttpStatus.BAD_REQUEST);
        }

        order.setStatus(newStatus);
        return mapToResponse(orderRepository.save(order));
    }

    private Order getOrderForSeller(UUID shopId, UUID orderId) {
        return orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ApiException("Order not found or does not belong to this shop", HttpStatus.FORBIDDEN));
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
                        .build()
                ).collect(Collectors.toList()))
                .build();
    }

    private PaymentDetailResponseDto mapToPaymentDetail(Order order) {
        PaymentConfirmation confirmation = paymentConfirmationRepository.findFirstByOrderIdOrderBySubmittedAtDesc(order.getId())
                .orElse(null);

        return PaymentDetailResponseDto.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .orderCreatedAt(order.getCreatedAt())
                .customerName(order.getCustomerName())
                .customerEmail(order.getCustomerEmail())
                .customerPhone(order.getCustomerPhone())
                .paymentStatus(order.getPaymentStatus().name())
                .transferAmount(confirmation != null ? confirmation.getTransferAmount() : null)
                .transferTime(confirmation != null ? confirmation.getTransferTime() : null)
                .receiptImageUrl(confirmation != null ? confirmation.getReceiptImageUrl() : null)
                .submittedAt(confirmation != null ? confirmation.getSubmittedAt() : null)
                .reviewedAt(confirmation != null ? confirmation.getReviewedAt() : null)
                .orderTotal(order.getTotalAmount())
                .payerName(confirmation != null ? confirmation.getPayerName() : null)
                .reviewNote(confirmation != null ? confirmation.getReviewNote() : null)
                .build();
    }
}
