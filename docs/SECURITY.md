# Security Hardening

## Overview
This document outlines the security measures implemented across the `backend-nest` and `frontend-next` applications.

## Authentication
- **HttpOnly Cookies**: NestJS now issues the access token in an `httpOnly` cookie with `path=/`, configurable `SameSite`, configurable `Secure`, and configurable `maxAge`. The Next.js app authenticates through `credentials: "include"` and re-hydrates the session from `GET /api/auth/me`.
- **Bearer Token Fallback**: For backward compatibility with legacy clients (such as API integration scripts, `curl`, and old applications), the API still supports extracting JWTs from the `Authorization: Bearer <token>` header if the cookie is not present.
- **SameSite Policy**: Cookies are configured with `SameSite=lax` (default) to provide CSRF protection while maintaining usability. This can be configured via environment variables.
- **Secure Flag**: The `Secure` flag can be toggled via `AUTH_COOKIE_SECURE=true` for production environments (HTTPS only).
- **Logout Flow**: `POST /api/auth/logout` clears the auth cookie and the frontend clears its local user/shop hydration state.
- **Client Storage**: The frontend no longer stores raw auth JWTs in `localStorage`. `localStorage` is only used for lightweight UI hydration data such as the current user snapshot and selected seller shop.
- **Browser E2E Coverage**: `frontend-next/tests/e2e/auth-cookie.spec.ts` verifies browser login, session persistence after reload, logout, protected-route redirect, and absence of raw JWT auth tokens in `localStorage`.

## AI Service
- The `ai-service` enforces a strict model selection hierarchy.
- The `image_generation_service.py` legacy file and `app/providers` legacy folder have been completely removed to minimize attack surfaces and avoid dead code exposure.
