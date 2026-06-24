import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/shared/auth";
import { Navbar } from "@/common/app-shell/navbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Redirect to login if unauthenticated or if the refresh token has expired.
  if (!session?.user || session.error === "RefreshError") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
    </div>
  );
}
