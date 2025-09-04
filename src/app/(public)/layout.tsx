"use client";

import MainLayout from "@/components/MainLayout"; // ✅ ใช้ alias
import type { ReactNode } from "react";

type LayoutProps = { children: ReactNode };

export default function Layout({ children }: LayoutProps) {
  return (
    <MainLayout
      navbar={false}
      toolbar={false}
      leftSidePanel={false}
      rightSidePanel={false}
      footer={false}
    >
      {children}
    </MainLayout>
  );
}
