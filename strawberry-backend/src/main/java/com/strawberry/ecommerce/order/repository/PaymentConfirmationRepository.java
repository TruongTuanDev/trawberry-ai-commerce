package com.strawberry.ecommerce.order.repository;

import com.strawberry.ecommerce.order.entity.PaymentConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentConfirmationRepository extends JpaRepository<PaymentConfirmation, UUID> {
    Optional<PaymentConfirmation> findFirstByOrderIdOrderBySubmittedAtDesc(UUID orderId);
}
