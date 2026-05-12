package com.strawberry.ecommerce.wb.dto;

import lombok.Data;
import java.util.List;

@Data
public class WbCardsResponseDto {
    private List<Card> cards;
    private Cursor cursor;

    @Data
    public static class Card {
        private Long nmID;
        private Long imtID;
        private String nmUUID;
        private Long subjectID;
        private String subjectName;
        private String vendorCode;
        private String brand;
        private String title;
        private String description;
        private String video;
        private Boolean needKiz;
        private String createdAt;
        private String updatedAt;
        private List<Photo> photos;
        private Dimensions dimensions;
        private List<Characteristic> characteristics;
        private List<Size> sizes;
        private List<Tag> tags;
        private Wholesale wholesale;
    }

    @Data
    public static class Tag {
        private Long id;
        private String name;
        private String color;
    }

    @Data
    public static class Wholesale {
        private Boolean enabled;
        private Integer quantum;
    }

    @Data
    public static class Photo {
        private String big;
        private String c246x328;
        private String c516x688;
        private String hq;
        private String square;
        private String tm;
    }

    @Data
    public static class Dimensions {
        private Integer width;
        private Integer height;
        private Integer length;
        private Integer weightBrutto;
        private Boolean isValid;
    }

    @Data
    public static class Characteristic {
        private Long id;
        private String name;
        // The value is polymorphic (can be string, array of strings, int, etc.)
        // We capture it seamlessly by mapping it to Object so Jackson handles it.
        private Object value;
    }

    @Data
    public static class Size {
        private Long chrtID;
        private String techSize;
        private String wbSize;
        private List<String> skus;
    }

    @Data
    public static class Cursor {
        private String updatedAt;
        private Long nmID;
        private Integer total;
    }
}
