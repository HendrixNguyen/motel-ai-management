/** Stored Vietnamese mobile numbers retain their country code when displayed or copied. */
export function formatPhone(phone: string): string {
  return phone.replace(/^84(\d{3})(\d{3})(\d{3})$/, "+84 $1 $2 $3");
}
