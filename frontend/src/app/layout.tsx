import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans } from "next/font/google";
import "./globals.css";
import ThemeInit from "@/components/ui/theme-init";

/**
 * `subsets` picks which of the family's own subset files are *preloaded*. The Vietnamese
 * `unicode-range` faces are emitted either way — a build with `subsets: ["latin"]` still ships
 * them, verified — but they are then fetched only once the browser hits a Vietnamese glyph or
 * `₫`, so the first paint of every screen shows the fallback. Naming both keeps the file the
 * UI is actually drawn with in the preload set.
 *
 * `--font-heading` is Be Vietnam Pro, `--font-sans` is Noto Sans; the `@theme` block in
 * `globals.css` binds those two names to the Tailwind utilities `font-heading` and `font-sans`.
 *
 * Be Vietnam Pro is not a variable font on Google Fonts, so `weight` is mandatory. Only the two
 * heading weights the spec names are requested — page heading 24px/700, section heading and
 * item title 18px|16px/600 (`docs/frontend-ui-specs.md:52-53`). Noto Sans is variable, so one
 * file per subset covers every body and label weight.
 */
const headingFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["600", "700"],
});

const bodyFont = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["vietnamese", "latin"],
});

export const metadata: Metadata = {
  title: "Quản lý nhà trọ",
  description: "Ghi chỉ số điện nước, xuất hóa đơn và quản lý hợp đồng thuê.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-text-body font-sans">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
