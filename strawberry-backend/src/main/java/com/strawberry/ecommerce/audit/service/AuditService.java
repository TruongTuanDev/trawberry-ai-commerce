package com.strawberry.ecommerce.audit.service;

import com.strawberry.ecommerce.audit.entity.AuditLog;
import com.strawberry.ecommerce.audit.repository.AuditLogRepository;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.repository.UserRepository;
import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public void logAction(String actionType, String entityType, String entityId, String oldValues, String newValues) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User currentUser = null;
        if (principal instanceof UserDetailsImpl) {
            UserDetailsImpl userDetails = (UserDetailsImpl) principal;
            currentUser = userRepository.findById(userDetails.getId()).orElse(null);
        }

        AuditLog log = AuditLog.builder()
                .user(currentUser)
                .actionType(actionType)
                .entityType(entityType)
                .entityId(entityId)
                .oldValues(oldValues)
                .newValues(newValues)
                .build();

        auditLogRepository.save(log);
    }
}
