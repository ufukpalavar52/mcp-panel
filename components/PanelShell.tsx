"use client";

import React, { useState } from "react";
import DocumentTitle from "@/components/DocumentTitle";
import AppFooter from "./AppFooter";
import AuthGuard from "./AuthGuard";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import ConfigWarning from "./ConfigWarning";
import Toaster from "./Toaster";

export default function PanelShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <AuthGuard>
      <AppSidebar
        visible={sidebarVisible}
        onVisibleChange={setSidebarVisible}
      />
      <DocumentTitle />
      <div className="app-wrapper">
        <AppHeader onToggleSidebar={() => setSidebarVisible((v) => !v)} />
        <ConfigWarning />
        <main className="flex-grow-1 px-3 px-lg-4">{children}</main>
        <AppFooter />
      </div>
      <Toaster />
    </AuthGuard>
  );
}
