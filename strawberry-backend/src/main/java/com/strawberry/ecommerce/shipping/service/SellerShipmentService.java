package com.strawberry.ecommerce.shipping.service;

import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.order.entity.Order;
import com.strawberry.ecommerce.order.entity.OrderStatus;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.shipping.dto.CreateShipmentRequestDto;
import com.strawberry.ecommerce.shipping.dto.ShipmentResponseDto;
import com.strawberry.ecommerce.shipping.entity.Shipment;
import com.strawberry.ecommerce.shipping.entity.ShipmentStatus;
import com.strawberry.ecommerce.shipping.repository.ShipmentRepository;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
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
public class SellerShipmentService {

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;

    @Transactional
    public ShipmentResponseDto createShipment(UUID shopId, UUID orderId, CreateShipmentRequestDto req) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ApiException("Order not found", HttpStatus.NOT_FOUND));

        if (!order.getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied: Order does not belong to this shop", HttpStatus.FORBIDDEN);
        }

        if (shipmentRepository.findByOrderId(orderId).isPresent()) {
            throw new ApiException("Shipment already exists for this order", HttpStatus.BAD_REQUEST);
        }

        Shipment shipment = Shipment.builder()
                .order(order)
                .carrier(req.getCarrier())
                .trackingNumber(req.getTrackingNumber())
                .shipmentStatus(ShipmentStatus.CREATED)
                .build();

        shipment = shipmentRepository.save(shipment);

        // Update Order status to SHIPPING automatically
        order.setStatus(OrderStatus.SHIPPING);
        orderRepository.save(order);

        return mapToDto(shipment);
    }

    @Transactional
    public ShipmentResponseDto updateShipmentStatus(UUID shopId, UUID shipmentId, ShipmentStatus newStatus) {

        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new ApiException("Shipment not found", HttpStatus.NOT_FOUND));

        if (!shipment.getOrder().getShop().getId().equals(shopId)) {
            throw new ApiException("Access denied", HttpStatus.FORBIDDEN);
        }

        shipment.setShipmentStatus(newStatus);
        
        if (newStatus == ShipmentStatus.PICKED_UP || newStatus == ShipmentStatus.IN_TRANSIT) {
            if (shipment.getShippedAt() == null) {
                shipment.setShippedAt(LocalDateTime.now());
            }
        } else if (newStatus == ShipmentStatus.DELIVERED) {
            shipment.setDeliveredAt(LocalDateTime.now());
            
            Order order = shipment.getOrder();
            order.setStatus(OrderStatus.DELIVERED);
            
            // Release reserved stock on delivery
            order.getItems().forEach(item -> {
                if (item.getVariant() != null) {
                    item.getVariant().setReservedStock(item.getVariant().getReservedStock() - item.getQuantity());
                }
            });
            
            orderRepository.save(order);
        }

        shipment = shipmentRepository.save(shipment);
        return mapToDto(shipment);
    }

    @Transactional(readOnly = true)
    public List<ShipmentResponseDto> getShopShipments(UUID shopId) {
        return shipmentRepository.findByShopId(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
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
