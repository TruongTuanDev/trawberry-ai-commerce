package com.strawberry.ecommerce.shipping.service;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.order.entity.Order;
import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.shipping.dto.DeliveryIssueResponseDto;
import com.strawberry.ecommerce.shipping.entity.DeliveryIssueReport;
import com.strawberry.ecommerce.shipping.entity.DeliveryIssueStatus;
import com.strawberry.ecommerce.shipping.entity.Shipment;
import com.strawberry.ecommerce.shipping.repository.DeliveryIssueReportRepository;
import com.strawberry.ecommerce.shipping.repository.ShipmentRepository;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeliveryIssueService {

    private final DeliveryIssueReportRepository deliveryIssueReportRepository;
    private final OrderRepository orderRepository;
    private final ShipmentRepository shipmentRepository;
    private final UserRepository userRepository;

    @Transactional
    public DeliveryIssueResponseDto reportNotReceived(UUID customerId, UUID orderId, String note) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new ApiException("Delivery issue reports can only be created for delivered orders", HttpStatus.BAD_REQUEST);
        }

        if (deliveryIssueReportRepository.existsByOrderIdAndStatusIn(
                orderId, List.of(DeliveryIssueStatus.OPEN, DeliveryIssueStatus.IN_REVIEW))) {
            throw new ApiException("A delivery issue is already open for this order", HttpStatus.BAD_REQUEST);
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("Customer not found", HttpStatus.NOT_FOUND));
        Shipment shipment = shipmentRepository.findByOrderId(orderId).orElse(null);

        DeliveryIssueReport report = deliveryIssueReportRepository.save(DeliveryIssueReport.builder()
                .order(order)
                .shipment(shipment)
                .customer(customer)
                .status(DeliveryIssueStatus.OPEN)
                .customerNote(note != null && !note.isBlank() ? note.trim() : null)
                .build());

        return mapToDto(report);
    }

    @Transactional(readOnly = true)
    public DeliveryIssueResponseDto getLatestForOrder(UUID orderId) {
        return deliveryIssueReportRepository.findFirstByOrderIdOrderByCreatedAtDesc(orderId)
                .map(this::mapToDto)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<DeliveryIssueResponseDto> getShopIssues(UUID shopId) {
        return deliveryIssueReportRepository.findByOrderShopIdOrderByCreatedAtDesc(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public DeliveryIssueResponseDto updateStatus(UUID shopId, UUID issueId, DeliveryIssueStatus status) {
        DeliveryIssueReport report = deliveryIssueReportRepository.findById(issueId)
                .orElseThrow(() -> new ApiException("Delivery issue not found", HttpStatus.NOT_FOUND));

        if (!report.getOrder().getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied", HttpStatus.FORBIDDEN);
        }

        report.setStatus(status);
        report.setResolvedAt(status == DeliveryIssueStatus.RESOLVED ? LocalDateTime.now() : null);
        return mapToDto(deliveryIssueReportRepository.save(report));
    }

    private DeliveryIssueResponseDto mapToDto(DeliveryIssueReport report) {
        Shipment shipment = report.getShipment();
        return DeliveryIssueResponseDto.builder()
                .id(report.getId())
                .orderId(report.getOrder().getId())
                .orderNumber(report.getOrder().getOrderNumber())
                .customerName(report.getOrder().getCustomerName())
                .customerEmail(report.getOrder().getCustomerEmail())
                .customerPhone(report.getOrder().getCustomerPhone())
                .status(report.getStatus())
                .customerNote(report.getCustomerNote())
                .createdAt(report.getCreatedAt())
                .updatedAt(report.getUpdatedAt())
                .resolvedAt(report.getResolvedAt())
                .shipmentId(shipment != null ? shipment.getId() : null)
                .carrier(shipment != null ? shipment.getCarrier() : null)
                .trackingNumber(shipment != null ? shipment.getTrackingNumber() : null)
                .shipmentStatus(shipment != null ? shipment.getShipmentStatus() : null)
                .build();
    }
}
