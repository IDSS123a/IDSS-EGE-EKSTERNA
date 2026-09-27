import type { ReactNode } from "react";
import { LoginForm } from "@/features/authentication/components/login-form";

/** GET /prijava — public login page (username + password, mandate §7A.5). */
export default function LoginPage(): ReactNode {
  return <LoginForm />;
}
