import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Giriş yap" };

export default function LoginPage() {
  return <LoginForm />;
}
