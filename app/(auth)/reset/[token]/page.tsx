import type { Metadata } from "next";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Yeni şifre" };

/**
 * Setting a password against a reset link.
 *
 * The token is in the path because that is what somebody is handed in a mail, and because
 * it is the whole of the authorisation — which is why it lasts an hour and works once.
 */
export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ResetPasswordForm token={token} />;
}
