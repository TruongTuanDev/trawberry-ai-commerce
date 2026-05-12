package com.strawberry.ecommerce.shipping.dto;

import com.strawberry.ecommerce.shipping.entity.DeliveryIssueStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DeliveryIssueStatusUpdateRequestDto {
    @NotNull
    private DeliveryIssueStatus status;
}
