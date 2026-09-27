import type { ReactNode } from "react";
import { LegalDocument } from "@/features/shell/components/legal-document";

/** GET /kolacici — public legal document (text pending from IDSS, AMB-20). */
export default function Page(): ReactNode {
  return <LegalDocument documentKey="cookies" />;
}
