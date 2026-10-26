import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isValidFormspreeEndpoint, submitContact } from "./contact";

afterEach(() => vi.unstubAllGlobals());

describe("Formspree contact", () => {
  it("accepts only HTTPS Formspree form endpoints", () => {
    expect(isValidFormspreeEndpoint("https://formspree.io/f/abc123")).toBe(true);
    expect(isValidFormspreeEndpoint("http://formspree.io/f/abc123")).toBe(false);
    expect(isValidFormspreeEndpoint("https://example.com/f/abc123")).toBe(false);
    expect(
      isValidFormspreeEndpoint("https://formspree.io/f/abc123?redirect=https://example.com"),
    ).toBe(false);
  });

  it("posts form data and rejects failed responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const data = new FormData();
    data.set("message", "Question");

    await submitContact("https://formspree.io/f/abc123", data);

    expect(fetchMock).toHaveBeenCalledWith("https://formspree.io/f/abc123", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data,
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 422 }));
    await expect(submitContact("https://formspree.io/f/abc123", data)).rejects.toThrow();
  });
});
