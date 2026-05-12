package com.strawberry.ecommerce.shipping.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "shipping_methods")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private Integer estimatedDaysMin = 1;

    @Column(nullable = false)
    @Builder.Default
    private Integer estimatedDaysMax = 7;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
