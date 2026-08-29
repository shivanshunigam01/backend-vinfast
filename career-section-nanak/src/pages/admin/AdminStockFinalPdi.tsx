import { ClipboardCheck } from "lucide-react";
import AdminStockPipelineStage from "./AdminStockPipelineStage";

export default function AdminStockFinalPdi() {
  return <AdminStockPipelineStage mode="final-pdi" icon={<ClipboardCheck className="h-6 w-6" />} />;
}
