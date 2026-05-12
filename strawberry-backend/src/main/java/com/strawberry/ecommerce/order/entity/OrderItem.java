package com.strawberry.ecommerce.order.entity;

import com.strawberry.ecommerce.catalog.entity.ProductVariant;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id")
    private ProductVariant variant;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private BigDecimal priceAtPurchase;

    @Column(nullable = false)
    private String productTitleSnapshot;

    @Column(nullable = false)
    private String productSlugSnapshot;

    @Column(columnDefinition = "TEXT")
    private String variantAttributesSnapshot;

    @Column(columnDefinition = "TEXT")
    private String productImageSnapshot;

    private Long wbNmIdSnapshot;
}
