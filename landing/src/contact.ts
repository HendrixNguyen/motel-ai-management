export function isValidFormspreeEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    return (
      endpoint.origin === "https://formspree.io" &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash &&
      /^\/f\/[A-Za-z0-9]+$/.test(endpoint.pathname)
    );
  } catch {
    return false;
  }
}

export async function submitContact(endpoint: string, data: FormData): Promise<void> {
  if (!isValidFormspreeEndpoint(endpoint)) throw new Error("Invalid Formspree endpoint.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: data,
  });

  if (!response.ok) throw new Error("Formspree rejected the submission.");
}
