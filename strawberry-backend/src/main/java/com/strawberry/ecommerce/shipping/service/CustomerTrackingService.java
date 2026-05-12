package com.strawberry.ecommerce.shipping.service;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.order.entity.Order;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.shipping.dto.ShipmentResponseDto;
import com.strawberry.ecommerce.shipping.entity.Shipment;
import com.strawberry.ecommerce.shipping.repository.ShipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerTrackingService {

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public ShipmentResponseDto getTrackingInfo(UUID customerId, UUID orderId) {
        Order order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ApiException("Order not found or access denied", HttpStatus.NOT_FOUND));

        Shipment shipment = shipmentRepository.findByOrderId(order.getId())
                .orElseThrow(() -> new ApiException("Tracking information not yet available for this order", HttpStatus.NOT_FOUND));

        return mapToDto(shipment);
    }

    private ShipmentResponseDto mapToDto(Shipment s) {
        return ShipmentResponseDto.builder()
                .id(s.getId())
                .orderId(s.getOrder().getId())
                .carrier(s.getCarrier())
                .trackingNumber(s.getTrackingNumber())
                .shipmentStatus(s.getShipmentStatus())
                .shippedAt(s.getShippedAt())
                .deliveredAt(s.getDeliveredAt())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
