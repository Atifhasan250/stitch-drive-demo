import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared with me",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
