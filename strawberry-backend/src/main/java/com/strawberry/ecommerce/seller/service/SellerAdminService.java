package com.strawberry.ecommerce.seller.service;

import com.strawberry.ecommerce.audit.service.AuditService;
import com.strawberry.ecommerce.common.exception.ApiException;
import com.strawberry.ecommerce.seller.dto.ApprovalResponseDto;
import com.strawberry.ecommerce.seller.dto.PendingSellerDto;
import com.strawberry.ecommerce.seller.entity.SellerProfile;
import com.strawberry.ecommerce.seller.repository.SellerProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SellerAdminService {

    private final SellerProfileRepository sellerProfileRepository;
    private final AuditService auditService;

    public List<PendingSellerDto> getPendingSellers() {
        return sellerProfileRepository.findAll().stream()
                .filter(profile -> "PENDING".equals(profile.getApprovalStatus()))
                .map(this::mapToPendingSellerDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApprovalResponseDto approveSeller(UUID userId) {
        return changeSellerStatus(userId, "APPROVED", null);
    }

    @Transactional
    public ApprovalResponseDto rejectSeller(UUID userId, String reason) {
        return changeSellerStatus(userId, "REJECTED", reason);
    }

    private ApprovalResponseDto changeSellerStatus(UUID userId, String newStatus, String reason) {
        SellerProfile profile = sellerProfileRepository.findAll().stream()
                .filter(p -> p.getUser().getId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new ApiException("Seller Profile not found for User ID", HttpStatus.NOT_FOUND));

        String oldStatus = profile.getApprovalStatus();
        
        if (!"PENDING".equals(oldStatus)) {
            throw new ApiException("Only PENDING sellers can be " + newStatus.toLowerCase(), HttpStatus.BAD_REQUEST);
        }

        profile.setApprovalStatus(newStatus);
        profile.setReviewedAt(LocalDateTime.now());
        profile.setReviewNote(reason);

        sellerProfileRepository.save(profile);

        auditService.logAction(
                "SELLER_PROFILE_" + newStatus,
                "SellerProfile",
                profile.getId().toString(),
                "{\"status\":\"" + oldStatus + "\"}",
                "{\"status\":\"" + newStatus + "\"}"
        );

        return ApprovalResponseDto.builder()
                .userId(profile.getUser().getId())
                .approvalStatus(profile.getApprovalStatus())
                .reviewedAt(profile.getReviewedAt())
                .build();
    }

    private PendingSellerDto mapToPendingSellerDto(SellerProfile profile) {
        return PendingSellerDto.builder()
                .userId(profile.getUser().getId())
                .email(profile.getUser().getEmail())
                .fullName(profile.getUser().getFullName())
                .phone(profile.getUser().getPhone())
                .sellerProfileId(profile.getId())
                .approvalStatus(profile.getApprovalStatus())
                .createdAt(profile.getCreatedAt())
                .build();
    }
}
