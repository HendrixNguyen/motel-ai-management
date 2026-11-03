export const motionTiming = {
  feedback: 0.16,
  route: 0.18,
  spring: { type: "spring", duration: 0.32, bounce: 0.15 },
} as const;

export const noMotion = { duration: 0 } as const;

export const cubicEase = [0.2, 0.8, 0.2, 1] as const;
