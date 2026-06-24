import type { ReactNode } from "react";
import { getOrganizations } from "@/shared/api";
import { PlatformSidebar } from "@/common/app-shell/platform-sidebar";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const orgs = await getOrganizations();

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 border-r border-border bg-card md:block">
        <PlatformSidebar orgs={orgs} />
      </aside>
      <main className="pt-14 md:pl-60">{children}</main>
    </>
  );
}
