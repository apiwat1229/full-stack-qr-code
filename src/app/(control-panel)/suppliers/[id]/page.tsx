"use client";

import SupplierView from "@/components/views/SupplierView";
import { useParams } from "next/navigation";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <SupplierView id={id} />;
}
