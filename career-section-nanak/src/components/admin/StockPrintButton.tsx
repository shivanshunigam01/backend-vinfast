import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openStockPrintPdf, type StockPrintOptions } from "@/lib/stockPrint";

type Props = {
  label?: string;
  getPrintOptions: () => StockPrintOptions;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
};

export default function StockPrintButton({
  label = "Print PDF",
  getPrintOptions,
  size = "sm",
  variant = "outline",
}: Props) {
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => {
        const ok = openStockPrintPdf(getPrintOptions());
        if (ok) toast.success("Print view opened — save as PDF from your browser.");
      }}
    >
      <FileText className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}
