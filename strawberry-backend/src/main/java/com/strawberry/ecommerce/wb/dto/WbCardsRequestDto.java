package com.strawberry.ecommerce.wb.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WbCardsRequestDto {
    private Settings settings;

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Settings {
        @Builder.Default
        private Sort sort = Sort.builder().build();
        private Cursor cursor;
        @Builder.Default
        private Filter filter = Filter.builder().build();
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Sort {
        @Builder.Default
        private boolean ascending = true;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Cursor {
        @Builder.Default
        private int limit = 100;
        private String updatedAt;
        private Long nmID;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Filter {
        @Builder.Default
        private int withPhoto = -1;
    }
}
