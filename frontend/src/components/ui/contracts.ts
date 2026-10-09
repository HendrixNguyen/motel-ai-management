export type CoreTone = "success" | "warning" | "danger" | "neutral";
export type CoreTheme = "light" | "dark" | "system";
export type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl";
export type SurfaceToken = "canvas" | "surface" | "surface-raised";
export type TextToken = "text" | "text-body" | "text-muted";
export type RadiusToken = "input" | "card" | "full";

export type SemanticToken = SurfaceToken | TextToken | RadiusToken | CoreTone;

export const coreTokens = {
  surfaces: ["canvas", "surface", "surface-raised"] as const,
  text: ["text", "text-body", "text-muted"] as const,
  status: ["success", "warning", "danger", "neutral"] as const,
  radius: ["input", "card", "full"] as const,
  spacing: ["xs", "sm", "md", "lg", "xl"] as const,
  themes: ["light", "dark", "system"] as const,
} as const;
