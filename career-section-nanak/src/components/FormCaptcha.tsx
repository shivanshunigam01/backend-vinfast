import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

type FormCaptchaProps = {
  onVerifyChange: (verified: boolean) => void;
  resetSignal?: number;
};

function nextChallenge() {
  const left = Math.floor(Math.random() * 9) + 1;
  const right = Math.floor(Math.random() * 9) + 1;
  return { left, right };
}

export function FormCaptcha({ onVerifyChange, resetSignal = 0 }: FormCaptchaProps) {
  const [challenge, setChallenge] = useState(nextChallenge);
  const [value, setValue] = useState("");
  const expected = useMemo(() => challenge.left + challenge.right, [challenge.left, challenge.right]);
  const verified = value.trim() !== "" && Number(value) === expected;

  useEffect(() => {
    onVerifyChange(verified);
  }, [verified, onVerifyChange]);

  useEffect(() => {
    setChallenge(nextChallenge());
    setValue("");
    onVerifyChange(false);
  }, [resetSignal, onVerifyChange]);

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Captcha verification *</p>
        <button
          type="button"
          onClick={() => {
            setChallenge(nextChallenge());
            setValue("");
            onVerifyChange(false);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Refresh captcha"
        >
          <RefreshCcw className="h-3 w-3" />
          Refresh
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground min-w-[80px]">
          {challenge.left} + {challenge.right} = ?
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Answer"
          aria-label="Captcha answer"
        />
        {verified ? <span className="text-xs text-emerald-600">Verified</span> : null}
      </div>
    </div>
  );
}
