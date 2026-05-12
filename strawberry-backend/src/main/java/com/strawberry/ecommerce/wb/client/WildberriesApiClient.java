package com.strawberry.ecommerce.wb.client;

import com.strawberry.ecommerce.wb.dto.WbCardsRequestDto;
import com.strawberry.ecommerce.wb.dto.WbCardsResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class WildberriesApiClient {

    private final RestTemplate restTemplate;
    private static final String BaseUrl = "https://content-api.wildberries.ru/content/v2/get/cards/list";

    public WbCardsResponseDto fetchCards(String decryptedApiKey, WbCardsRequestDto requestDto) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", decryptedApiKey);
        headers.set("Content-Type", "application/json");

        HttpEntity<WbCardsRequestDto> entity = new HttpEntity<>(requestDto, headers);

        try {
            ResponseEntity<WbCardsResponseDto> response = restTemplate.exchange(
                    BaseUrl,
                    HttpMethod.POST,
                    entity,
                    WbCardsResponseDto.class
            );
            return response.getBody();
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("Rate limited by Wildberries API (429 Too Many Requests)");
            throw e;
        } catch (Exception e) {
            log.error("Error communicating with Wildberries API: {}", e.getMessage());
            throw new RuntimeException("Wildberries API communication error", e);
        }
    }
}
