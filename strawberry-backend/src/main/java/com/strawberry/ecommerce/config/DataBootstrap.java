package com.strawberry.ecommerce.config;

import com.strawberry.ecommerce.seller.entity.SellerProfile;
import com.strawberry.ecommerce.seller.repository.SellerProfileRepository;
import com.strawberry.ecommerce.shop.entity.Shop;
import com.strawberry.ecommerce.shop.entity.ShopStatus;
import com.strawberry.ecommerce.shop.repository.ShopRepository;
import com.strawberry.ecommerce.user.entity.Role;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.user.entity.UserStatus;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.dao.DataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
@DependsOnDatabaseInitialization
public class DataBootstrap implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SellerProfileRepository sellerProfileRepository;
    private final ShopRepository shopRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!isSchemaReady()) {
            log.warn("Skipping data bootstrap because the database schema is not initialized yet.");
            return;
        }

        String adminEmail = "admin@gmail.com";
        Optional<User> adminOptional = userRepository.findByEmail(adminEmail);

        if (adminOptional.isEmpty()) {
            log.info("Creating default admin user: {}", adminEmail);
            User user = new User();
            user.setFullName("ADMIN");
            user.setEmail(adminEmail);
            user.setPassword(passwordEncoder.encode("adminpassword"));
            user.setRole(Role.ADMIN);
            user.setStatus(UserStatus.ACTIVE);
            userRepository.save(user);
        } else {
            log.info("Updating admin user password for verification: {}", adminEmail);
            User user = adminOptional.get();
            user.setPassword(passwordEncoder.encode("adminpassword"));
            userRepository.save(user);
        }

        String sellerEmail = "seller@example.com";
        Optional<User> sellerOptional = userRepository.findByEmail(sellerEmail);
        if (sellerOptional.isPresent()) {
            User sellerUser = sellerOptional.get();
            sellerUser.setPassword(passwordEncoder.encode("password123"));
            userRepository.save(sellerUser);

            // Ensure Seller Profile exists
            SellerProfile profile = sellerProfileRepository.findByUserId(sellerUser.getId())
                    .orElseGet(() -> {
                        log.info("Creating seller profile for: {}", sellerEmail);
                        return sellerProfileRepository.save(SellerProfile.builder()
                                .user(sellerUser)
                                .approvalStatus("APPROVED")
                                .build());
                    });

            // Ensure Profile is approved
            if (!"APPROVED".equals(profile.getApprovalStatus())) {
                profile.setApprovalStatus("APPROVED");
                sellerProfileRepository.save(profile);
            }

            // Create Shop A
            if (shopRepository.findBySlug("shop-a").isEmpty()) {
                log.info("Creating Test Shop A");
                Shop shopA = new Shop();
                shopA.setSellerProfile(profile);
                shopA.setName("Test Shop A");
                shopA.setSlug("shop-a");
                shopA.setStatus(ShopStatus.ACTIVE);
                shopRepository.save(shopA);
            }

            // Create Shop B
            if (shopRepository.findBySlug("shop-b").isEmpty()) {
                log.info("Creating Test Shop B");
                Shop shopB = new Shop();
                shopB.setSellerProfile(profile);
                shopB.setName("Test Shop B");
                shopB.setSlug("shop-b");
                shopB.setStatus(ShopStatus.ACTIVE);
                shopRepository.save(shopB);
            }
        } else {
            User sellerUser = new User();
            sellerUser.setEmail(sellerEmail);
            sellerUser.setFullName("SELLER");
            sellerUser.setRole(Role.SELLER);
            sellerUser.setStatus(UserStatus.ACTIVE);
            sellerUser.setPassword(passwordEncoder.encode("password123"));
            userRepository.save(sellerUser);

            // Ensure Seller Profile exists
            SellerProfile profile = sellerProfileRepository.findByUserId(sellerUser.getId())
                    .orElseGet(() -> {
                        log.info("Creating seller profile for: {}", sellerEmail);
                        return sellerProfileRepository.save(SellerProfile.builder()
                                .user(sellerUser)
                                .approvalStatus("APPROVED")
                                .build());
                    });

            // Ensure Profile is approved
            if (!"APPROVED".equals(profile.getApprovalStatus())) {
                profile.setApprovalStatus("APPROVED");
                sellerProfileRepository.save(profile);
            }

            // Create Shop A
            if (shopRepository.findBySlug("shop-a").isEmpty()) {
                log.info("Creating Test Shop A");
                Shop shopA = new Shop();
                shopA.setSellerProfile(profile);
                shopA.setName("Test Shop A");
                shopA.setSlug("shop-a");
                shopA.setStatus(ShopStatus.ACTIVE);
                shopRepository.save(shopA);
            }

            // Create Shop B
            if (shopRepository.findBySlug("shop-b").isEmpty()) {
                log.info("Creating Test Shop B");
                Shop shopB = new Shop();
                shopB.setSellerProfile(profile);
                shopB.setName("Test Shop B");
                shopB.setSlug("shop-b");
                shopB.setStatus(ShopStatus.ACTIVE);
                shopRepository.save(shopB);
            }
        }
    }

    private boolean isSchemaReady() {
        try {
            userRepository.findByEmail("__bootstrap_schema_check__");
            return true;
        } catch (DataAccessException ex) {
            log.warn("Database schema is not ready for data bootstrap: {}", ex.getMostSpecificCause() != null
                    ? ex.getMostSpecificCause().getMessage()
                    : ex.getMessage());
            return false;
        }
    }
}
