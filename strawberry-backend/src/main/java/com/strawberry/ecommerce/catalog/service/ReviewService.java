package com.strawberry.ecommerce.catalog.service;

import com.strawberry.ecommerce.catalog.dto.ReviewResponseDto;
import com.strawberry.ecommerce.catalog.entity.Product;
import com.strawberry.ecommerce.catalog.entity.Review;
import com.strawberry.ecommerce.catalog.repository.ReviewRepository;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.order.entity.Order;
import com.strawberry.ecommerce.order.entity.OrderItem;
import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.repository.OrderItemRepository;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<ReviewResponseDto> getProductReviews(String slug, Pageable pageable) {
        return reviewRepository.findByProductSeoSlugOrderByCreatedAtDesc(slug, pageable)
                .map(this::mapToResponse);
    }

    @Transactional
    public ReviewResponseDto submitReview(UUID customerId, UUID orderId, UUID orderItemId, Integer rate, String content) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new ApiException("Reviews can only be submitted for delivered orders", HttpStatus.BAD_REQUEST);
        }

        OrderItem orderItem = orderItemRepository.findByIdAndOrderId(orderItemId, orderId)
                .orElseThrow(() -> new ApiException("Order item not found", HttpStatus.NOT_FOUND));

        if (reviewRepository.findByOrderItemId(orderItemId).isPresent()) {
            throw new ApiException("This purchased item has already been reviewed", HttpStatus.BAD_REQUEST);
        }

        if (orderItem.getVariant() == null || orderItem.getVariant().getProduct() == null) {
            throw new ApiException("Unable to resolve product for this order item", HttpStatus.BAD_REQUEST);
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("Customer not found", HttpStatus.NOT_FOUND));
        Product product = orderItem.getVariant().getProduct();

        Review review = reviewRepository.save(Review.builder()
                .product(product)
                .user(customer)
                .order(order)
                .orderItem(orderItem)
                .rate(rate)
                .content(content != null && !content.isBlank() ? content.trim() : null)
                .build());

        product.setFeedbackCount((int) reviewRepository.countByProductId(product.getId()));
        product.setAverageRating(reviewRepository.findAverageRateByProductId(product.getId()));

        return mapToResponse(review);
    }

    private ReviewResponseDto mapToResponse(Review review) {
        return ReviewResponseDto.builder()
                .id(review.getId())
                .customerName(review.getUser().getFullName())
                .content(review.getContent())
                .rate(review.getRate())
                .createdAt(review.getCreatedAt())
                .build();
    }
}
