"use client";

// A segment error boundary cannot catch its own layout. This parent catches shell read failures.
export { default } from "./(manager)/error";
