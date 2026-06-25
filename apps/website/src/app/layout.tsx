import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Orbit — local-first workspace for your projects & infrastructure",
  description:
    "Orbit is an open-source, local-first workspace that unifies your projects, tools and infrastructure. Works offline; only sync needs a server.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
