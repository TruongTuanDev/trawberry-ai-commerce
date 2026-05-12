package com.strawberry.ecommerce.wb.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegrationResponseDto {
    private UUID integrationId;
    private UUID shopId;
    private Boolean isActive;
    private ZonedDateTime updatedAt;
}
