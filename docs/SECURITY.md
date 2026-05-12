# Security Hardening

## Overview
This document outlines the security measures implemented across the `backend-nest` and `frontend-next` applications.

## Authentication
- **HttpOnly Cookies**: JWT access tokens are now sent and stored exclusively using `httpOnly` cookies in the frontend. This mitigates XSS (Cross-Site Scripting) attacks, as the tokens are inaccessible to client-side JavaScript.
- **Bearer Token Fallback**: For backward compatibility with legacy clients (such as API integration scripts, `curl`, and old applications), the API still supports extracting JWTs from the `Authorization: Bearer <token>` header if the cookie is not present.
- **SameSite Policy**: Cookies are configured with `SameSite=lax` (default) to provide CSRF protection while maintaining usability. This can be configured via environment variables.
- **Secure Flag**: The `Secure` flag can be toggled via `AUTH_COOKIE_SECURE=true` for production environments (HTTPS only).

## AI Service
- The `ai-service` enforces a strict model selection hierarchy.
- The `image_generation_service.py` legacy file and `app/providers` legacy folder have been completely removed to minimize attack surfaces and avoid dead code exposure.
