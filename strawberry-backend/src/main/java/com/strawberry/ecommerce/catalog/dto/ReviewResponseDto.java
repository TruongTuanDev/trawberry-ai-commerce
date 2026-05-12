package com.strawberry.ecommerce.catalog.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponseDto {
    private UUID id;
    private String customerName;
    private String content;
    private Integer rate;
    private LocalDateTime createdAt;
}
