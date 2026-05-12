package com.strawberry.ecommerce.shop.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateShopRequest {
    @NotBlank
    private String name;

    @NotBlank
    private String slug;

    private String logoUrl;
    private String contactInfo;
    private String bankName;
    private String accountNumber;
    private String accountHolderName;
    private String bik;
    private String correspondentAccount;
    private String paymentInstructions;
}
