import type { Metadata } from "next";
import UsersView from "@/components/users/UsersView";

export const metadata: Metadata = { title: "Kullanıcılar" };

export default function UsersPage() {
  return <UsersView />;
}
