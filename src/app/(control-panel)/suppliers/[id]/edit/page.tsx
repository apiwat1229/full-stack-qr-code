"use client";

import SupplierForm from "@/components/forms/SupplierForm";
import { useParams } from "next/navigation";

export default function SupplierEditPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  return <SupplierForm id={id} />;
}
