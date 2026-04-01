"use client";

import { Suspense, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import Loading from "./loading";
import { UploadProvider } from "@/contexts/UploadContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UploadProvider>
      <div className="flex h-screen overflow-hidden bg-dp-bg pb-16 lg:pb-0">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Navbar onMenuOpen={() => setSidebarOpen(true)} />
          <main id="dp-scroll" className="flex-1 overflow-y-auto p-4 lg:p-8">
            <DashboardErrorBoundary>
              <Suspense fallback={<Loading />}>
                {children}
              </Suspense>
            </DashboardErrorBoundary>
          </main>
        </div>
        <BottomNav />
      </div>
    </UploadProvider>
  );
}
