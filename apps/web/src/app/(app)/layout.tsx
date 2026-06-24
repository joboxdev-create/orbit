import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/shared/auth";
import { Navbar } from "@/common/app-shell/navbar";
import { Sidebar } from "@/common/app-shell/sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 border-r border-border bg-card md:block">
        <Sidebar />
      </aside>
      <main className="pt-14 md:pl-60">{children}</main>
    </div>
  );
}
