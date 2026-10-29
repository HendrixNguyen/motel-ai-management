export function parseCsrfToken(value: string | null | undefined): string {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("Phiên đăng nhập không hợp lệ");
  return value;
}

export function createManagerInputSchema(input: { name: string; email: string; password: string; phone?: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim();
  if (!name || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (phone && phone.length > 40)) throw new Error("Thông tin tài khoản không hợp lệ");
  const password = input.password;
  if (typeof password !== "string" || password.length < 8 || password.length > 256) throw new Error("Mật khẩu phải có từ 8 đến 256 ký tự");
  return { name, email, password, ...(phone ? { phone } : {}) };
}

