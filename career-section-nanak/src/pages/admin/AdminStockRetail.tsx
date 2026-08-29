import { Receipt } from "lucide-react";
import AdminStockPipelineStage from "./AdminStockPipelineStage";

export default function AdminStockRetail() {
  return <AdminStockPipelineStage mode="retail" icon={<Receipt className="h-6 w-6" />} />;
}
