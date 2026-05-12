package com.strawberry.ecommerce.auth.service;

import com.strawberry.ecommerce.auth.dto.LoginRequest;
import com.strawberry.ecommerce.auth.dto.LoginResponse;
import com.strawberry.ecommerce.auth.dto.RegisterRequest;
import com.strawberry.ecommerce.auth.dto.RegisterResponse;
import com.strawberry.ecommerce.common.security.JwtUtils;
import com.strawberry.ecommerce.common.security.UserDetailsImpl;
import com.strawberry.ecommerce.user.entity.Role;
import com.strawberry.ecommerce.seller.entity.SellerProfile;
import com.strawberry.ecommerce.user.entity.User;
import com.strawberry.ecommerce.seller.repository.SellerProfileRepository;
import com.strawberry.ecommerce.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;
    private final SellerProfileRepository sellerProfileRepository;
    private final PasswordEncoder passwordEncoder;

    public LoginResponse authenticateUser(LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken(authentication);

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String role = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_USER");

        User user = userRepository.findByEmail(loginRequest.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return new LoginResponse(jwt, "dummy-refresh-token", user.getEmail(), user.getFullName(), role);
    }

    @Transactional
    public RegisterResponse registerSeller(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Error: Email is already in use!");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.SELLER);
        user.setStatus(com.strawberry.ecommerce.user.entity.UserStatus.ACTIVE);
        User savedUser = userRepository.save(user);

        SellerProfile sellerProfile = new SellerProfile();
        sellerProfile.setUser(savedUser);
        sellerProfile.setApprovalStatus("PENDING");
        sellerProfileRepository.save(sellerProfile);

        // Generate token for auto-login if desired (not strictly required by backend flow but helpful for frontend)
        String jwt = jwtUtils.generateJwtTokenFromUser(savedUser);

        return RegisterResponse.builder()
                .userId(savedUser.getId())
                .accessToken(jwt)
                .refreshToken("dummy-refresh-token")
                .email(savedUser.getEmail())
                .fullName(savedUser.getFullName())
                .role(savedUser.getRole().name())
                .status(savedUser.getStatus().name())
                .approvalStatus(sellerProfile.getApprovalStatus())
                .build();
    }

    @Transactional
    public RegisterResponse registerCustomer(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Error: Email is already in use!");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.CUSTOMER);
        user.setStatus(com.strawberry.ecommerce.user.entity.UserStatus.ACTIVE);
        User savedUser = userRepository.save(user);

        // Generate token for auto-login
        String jwt = jwtUtils.generateJwtTokenFromUser(savedUser);

        return RegisterResponse.builder()
                .userId(savedUser.getId())
                .accessToken(jwt)
                .refreshToken("dummy-refresh-token")
                .email(savedUser.getEmail())
                .fullName(savedUser.getFullName())
                .role(savedUser.getRole().name())
                .status(savedUser.getStatus().name())
                .approvalStatus(null)
                .build();
    }
}
