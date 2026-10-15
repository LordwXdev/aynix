import { useState } from "react";
import { Dialog } from "./Overlay";

// "are you sure?" box for actions that affect real people
export const Confirm = ({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        {message}
      </p>
      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>
          Back
        </button>
        <button
          className={`btn ${danger ? "danger" : "primary"}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
};

export interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<unknown>;
}
