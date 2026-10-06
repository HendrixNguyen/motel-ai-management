import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-text">Không tìm thấy trang</h1>
      <p>Trang hoặc nhà trọ này không khả dụng.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 py-2 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Về tổng quan</Link>
    </div>
  );
}
