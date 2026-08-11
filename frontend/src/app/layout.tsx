import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alara",
  description: "A focused study workspace with Ara",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="app-backdrop relative flex min-h-full flex-col overflow-x-hidden text-foreground">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
