import { PackageCheck } from "lucide-react";
import AdminStockPipelineStage from "./AdminStockPipelineStage";

export default function AdminStockDeliveryHandover() {
  return <AdminStockPipelineStage mode="delivery-ready" icon={<PackageCheck className="h-6 w-6" />} />;
}
