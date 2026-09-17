import type { Metadata } from "next";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function ForgotPage() {
  return <ForgotPasswordForm />;
}
