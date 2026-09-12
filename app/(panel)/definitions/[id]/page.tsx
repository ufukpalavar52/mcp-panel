import type { Metadata } from "next";
import DefinitionEditView from "@/components/definitions/DefinitionEditView";

export const metadata: Metadata = { title: "Tanımı düzenle" };

export default async function EditDefinitionPage(
  props: PageProps<"/definitions/[id]">,
) {
  const { id } = await props.params;

  return <DefinitionEditView id={id} />;
}
