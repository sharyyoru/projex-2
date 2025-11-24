"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function ShellSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return null;
  }
  return <>{children}</>;
}

export function ShellHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return null;
  }
  return <>{children}</>;
}

export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <div className="mx-auto flex max-w-6xl min-h-[80vh] items-center justify-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] w-full overflow-x-hidden overflow-y-auto">
      {children}
    </div>
  );
}
