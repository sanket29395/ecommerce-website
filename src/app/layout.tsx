import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { ToastProvider } from "@/components/toast";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Form & Field — Everyday considered",
    template: "%s | Form & Field",
  },
  description: "Discover thoughtfully selected objects for everyday living.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Header />
          <main>{children}</main>
          <footer className="footer">
            <div>
              <strong>FORM & FIELD.</strong>
              <p className="muted mt-2">Everyday, considered.</p>
            </div>
            <nav>
              <Link href="/policies/shipping">Shipping & returns</Link>
              <Link href="/policies/privacy">Privacy</Link>
              <Link href="/policies/terms">Terms</Link>
              <Link href="/contact">Contact</Link>
            </nav>
            <span className="muted">
              © {new Date().getFullYear()} Form & Field
            </span>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
