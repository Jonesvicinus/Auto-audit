import { PageTransition } from "@/components/layout/PageTransition";

// Auth routes have their own minimal layout — no app sidebar / header / banner.
export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
