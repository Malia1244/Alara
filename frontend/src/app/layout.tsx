import type { Metadata } from "next";
import { Fraunces, Quicksand } from "next/font/google";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Alara",
  description: "A soft study space with Ara",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="app-backdrop relative flex min-h-full flex-col overflow-x-hidden text-foreground">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
