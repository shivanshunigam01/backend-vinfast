import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  label?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
  size?: "sm" | "default" | "icon";
  variant?: "destructive" | "outline" | "ghost";
};

export default function PipelineDeleteButton({
  label = "Delete",
  title = "Delete record?",
  description = "This action cannot be undone. Downstream pipeline steps may block deletion.",
  disabled,
  onConfirm,
  size = "sm",
  variant = "destructive",
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size={size} variant={variant} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
