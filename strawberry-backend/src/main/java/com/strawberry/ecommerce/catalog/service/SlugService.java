package com.strawberry.ecommerce.catalog.service;

import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class SlugService {

    private static final Pattern NONLATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]+");

    public String makeSlug(String input) {
        if (input == null) return "";

        String nowhitespace = WHITESPACE.matcher(input).replaceAll("-");
        String normalized = Normalizer.normalize(nowhitespace, Normalizer.Form.NFD);
        String slug = NONLATIN.matcher(normalized).replaceAll("");

        return slug.toLowerCase(Locale.ENGLISH)
                .replaceAll("-{2,}", "-") // Remove double dashes
                .replaceAll("^-", "")      // Remove leading dash
                .replaceAll("-$", "");     // Remove trailing dash
    }

    public String makeUniqueSlug(String title, String suffix) {
        String slug = makeSlug(title);
        if (slug.isEmpty()) {
            return suffix;
        }
        return slug + "-" + suffix;
    }
}
