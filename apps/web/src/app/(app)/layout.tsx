import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/app-shell/navbar";
import { Sidebar } from "@/components/app-shell/sidebar";

/**
 * Shell for everything behind auth: a fixed navbar, a fixed left sidebar, and a
 * scrolling content area. The auth gate lives here so every nested page is
 * protected by a single check.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 border-r border-border bg-panel/40 md:block">
        <Sidebar />
      </aside>
      <main className="pt-14 md:pl-60">{children}</main>
    </div>
  );
}
