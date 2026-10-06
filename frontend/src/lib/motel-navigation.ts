/** Both the selector and navigation links carry URL-based motel scope. */
export function motelHref(pathname: string, search: string, motelId?: string): string {
  const params = new URLSearchParams(search);
  if (motelId !== undefined) params.set("motel", motelId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
