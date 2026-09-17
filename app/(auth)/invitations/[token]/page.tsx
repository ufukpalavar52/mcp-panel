import type { Metadata } from "next";

import InvitationForm from "@/components/auth/InvitationForm";

export const metadata: Metadata = { title: "Davet" };

/**
 * Setting a password against an invitation.
 *
 * The token is in the path rather than in a query string: it is the whole of the
 * authorisation, and a path is what somebody is handed in a link.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <InvitationForm token={token} />;
}
