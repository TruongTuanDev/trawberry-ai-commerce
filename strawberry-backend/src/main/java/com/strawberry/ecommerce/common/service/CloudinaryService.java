package com.strawberry.ecommerce.common.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.strawberry.ecommerce.common.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
public class CloudinaryService {

    private final Cloudinary cloudinary;
    private final String cloudinaryUrl;

    public CloudinaryService(@Value("${cloudinary.url}") String cloudinaryUrl) {
        this.cloudinaryUrl = cloudinaryUrl;
        this.cloudinary = cloudinaryUrl == null || cloudinaryUrl.isBlank() ? null : new Cloudinary(cloudinaryUrl);
    }

    public String uploadReceiptImage(MultipartFile file, UUID orderId) throws IOException {
        if (cloudinary == null || cloudinaryUrl == null || cloudinaryUrl.isBlank()) {
            throw new ApiException("Cloudinary is not configured. Set CLOUDINARY_URL before uploading receipts.", HttpStatus.SERVICE_UNAVAILABLE);
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        String publicId = "images/payment-receipts/" + orderId + "/" + UUID.randomUUID() + extension;
        
        Map uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", "image"
        ));
        
        return uploadResult.get("secure_url").toString();
    }
}
