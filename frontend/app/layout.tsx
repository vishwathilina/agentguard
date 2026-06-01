import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/layout/SessionProvider";

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
});

export const metadata: Metadata = {
  title: "AgentGuard",
  description: "AI-Powered DevSecOps Vulnerability Intelligence"
  
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${urbanist.className} min-h-screen bg-background text-foreground`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
