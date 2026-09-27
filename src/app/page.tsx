import type { ReactNode } from "react";
import { HomeShell } from "@/features/home/components/home-shell";

/** GET / — public entry page (authentication arrives with Sprint 01 step 5). */
export default function HomePage(): ReactNode {
  return <HomeShell />;
}
