"use client";

import { useState } from "react";
import DefinitionForm from "./DefinitionForm";
import { createDefinition } from "@/lib/definitions";

export default function DefinitionCreateView() {
  // The empty definition is built on the first render only, so a keystroke does not mint
  // a fresh set of ids.
  const [initial] = useState(createDefinition);

  return <DefinitionForm initial={initial} mode="create" />;
}
