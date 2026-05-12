package com.strawberry.ecommerce.shop.service;

import com.strawberry.ecommerce.catalog.repository.ProductRepository;
import com.strawberry.ecommerce.order.entity.PaymentStatus;
import com.strawberry.ecommerce.order.repository.OrderRepository;
import com.strawberry.ecommerce.shipping.repository.ShipmentRepository;
import com.strawberry.ecommerce.shop.dto.ShopDashboardResponseDto;
import com.strawberry.ecommerce.sync.dto.SyncHealthDto;
import com.strawberry.ecommerce.sync.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopDashboardService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ShipmentRepository shipmentRepository;
    private final SyncService syncService;

    public ShopDashboardResponseDto getDashboardMetrics(UUID shopId) {
        SyncHealthDto health = syncService.getSyncHealth(shopId);
        
        return ShopDashboardResponseDto.builder()
                .productCount(productRepository.countByShopId(shopId))
                .orderCount(orderRepository.countByShopId(shopId))
                .pendingPaymentCount(orderRepository.countByShopIdAndPaymentStatus(shopId, PaymentStatus.PENDING))
                .shipmentCount(shipmentRepository.countByShopId(shopId))
                .lastSyncStatus(health.getLastSyncStatus())
                .lastSuccessfulSyncAt(health.getLastSuccessfulSyncAt())
                .syncIntervalMinutes(health.getSyncIntervalMinutes())
                .isSyncPaused(health.getIsSyncPaused())
                .build();
    }
}
