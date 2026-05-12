package com.strawberry.ecommerce.catalog.mapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.strawberry.ecommerce.catalog.entity.*;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.wb.dto.WbCardsResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class WbCatalogMapper {

    private final ObjectMapper objectMapper;
    private static final DateTimeFormatter WB_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'"); // Adjust if WB returns different ISO format

    public Product mapToNewProduct(Shop shop, WbCardsResponseDto.Card card) {
        Product product = new Product();
        product.setShop(shop);
        
        updateProductCoreFields(product, card);
        return product;
    }

    public void updateProductCoreFields(Product product, WbCardsResponseDto.Card card) {
        product.setWbNmId(card.getNmID());
        product.setWbImtId(card.getImtID());
        product.setWbNmUuid(card.getNmUUID());
        product.setBrand(card.getBrand());
        product.setWbTitle(card.getTitle());
        product.setWbDescription(card.getDescription());
        product.setWbCategoryName(card.getSubjectName());
        product.setWbVendorCode(card.getVendorCode());
        product.setWbNeedKiz(card.getNeedKiz());
        product.setSubjectId(card.getSubjectID());
        product.setWbVideoUrl(card.getVideo());

        // Wholesale
        if (card.getWholesale() != null) {
            product.setWholesaleEnabled(card.getWholesale().getEnabled());
            product.setWholesaleQuantum(card.getWholesale().getQuantum());
        }

        // Dimensions
        if (card.getDimensions() != null) {
            product.setLength(card.getDimensions().getLength());
            product.setWidth(card.getDimensions().getWidth());
            product.setHeight(card.getDimensions().getHeight());
            product.setWeightBrutto(card.getDimensions().getWeightBrutto());
            product.setDimensionsValid(card.getDimensions().getIsValid());
        }

        try {
            if (card.getCreatedAt() != null) {
                product.setWbCreatedAt(LocalDateTime.parse(card.getCreatedAt(), DateTimeFormatter.ISO_ZONED_DATE_TIME));
            }
            if (card.getUpdatedAt() != null) {
                product.setWbUpdatedAt(LocalDateTime.parse(card.getUpdatedAt(), DateTimeFormatter.ISO_ZONED_DATE_TIME));
            }
        } catch (Exception e) {
            log.warn("Failed to parse WB dates for nmID {}: {}", card.getNmID(), e.getMessage());
        }
    }

    public List<ProductImage> mapImages(Product product, List<WbCardsResponseDto.Photo> photos) {
        if (photos == null || photos.isEmpty()) return new ArrayList<>();

        List<ProductImage> images = new ArrayList<>();
        for (int i = 0; i < photos.size(); i++) {
            WbCardsResponseDto.Photo photoDto = photos.get(i);
            
            ProductImage image = new ProductImage();
            image.setProduct(product);
            // We'll prefer the 'big' or 'hq' URL, falling back to whichever is available
            String bestUrl = photoDto.getBig() != null ? photoDto.getBig() : 
                             photoDto.getHq() != null ? photoDto.getHq() : photoDto.getC516x688();
            if (bestUrl == null) bestUrl = "";
                             
            image.setWbUrl(bestUrl);
            image.setIsMain(i == 0);
            image.setSortOrder(i);
            images.add(image);
        }
        return images;
    }

    public List<ProductCharacteristic> mapCharacteristics(Product product, List<WbCardsResponseDto.Characteristic> characteristics) {
        if (characteristics == null || characteristics.isEmpty()) return new ArrayList<>();

        return characteristics.stream().map(charDto -> {
            ProductCharacteristic pc = new ProductCharacteristic();
            pc.setProduct(product);
            pc.setWbCharId(charDto.getId());
            pc.setName(charDto.getName());
            
            try {
                // Serialize the polymorphic value back to raw JSON
                String rawJson = objectMapper.writeValueAsString(charDto.getValue());
                pc.setRawValueJson(rawJson);
                
                // For simplified text search, if it's a string or array of strings, we can normalize it
                pc.setNormalizedText(rawJson.replaceAll("[\"\\]\\[]", "")); 
            } catch (JsonProcessingException e) {
                log.error("Failed to map characteristic value to JSON for product nmID {}", product.getWbNmId(), e);
                pc.setRawValueJson("{}");
            }
            
            return pc;
        }).collect(Collectors.toList());
    }

    public ProductVariant mapToNewVariant(Product product, WbCardsResponseDto.Size sizeDto) {
        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setChrtId(sizeDto.getChrtID());
        variant.setTechSize(sizeDto.getTechSize());
        variant.setWbSize(sizeDto.getWbSize());
        variant.setIsActive(true);
        // BasePrice, Stock left at defaults (0) for local management
        
        if (sizeDto.getSkus() != null) {
            List<ProductVariantSku> skus = sizeDto.getSkus().stream().map(skuString -> {
                ProductVariantSku sku = new ProductVariantSku();
                sku.setVariant(variant);
                sku.setSku(skuString);
                return sku;
            }).collect(Collectors.toList());
            variant.setSkus(skus);
        }
        return variant;
    }
}
