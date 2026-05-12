package com.strawberry.ecommerce.seller.dto;

import com.strawberry.ecommerce.order.dto.OrderResponseDto;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SellerDashboardResponseDto {
    private long totalProducts;
    private long totalOrders;
    private long pendingPayments;
    private long pendingShipments;
    private List<OrderResponseDto> recentOrders;
}
