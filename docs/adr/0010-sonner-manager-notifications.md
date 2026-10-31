# ADR-0010 — Sonner adapter for manager notifications

- **Date:** 2026-10-08
- **Status:** Accepted

## Context

Manager mutations need consistent, dismissible feedback. Existing screens call `useToast`, so replacing that contract would widen scope and force page changes.

## Decision

Use `sonner` through `frontend/src/components/ui/toast.tsx`. `ToastProvider` mounts one `Toaster`; `useToast` keeps existing `{ message, tone }` input and maps tones to Sonner methods. Pages remain unaware of the vendor.

## Consequences

Feedback gets keyboard-accessible dismissal, live announcements, and consistent stacking. Sonner becomes a frontend dependency; the adapter remains the only import boundary.
