import { X } from "lucide-react";
import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "secondary", ...props }: ButtonProps) {
  return <button className={["button", `button--${variant}`, className].filter(Boolean).join(" ")} {...props} />;
}

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

interface PanelProps {
  className?: string;
  children: ReactNode;
  title: string;
  description?: string;
}

export function Panel({ children, className, title, description }: PanelProps) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      <div className="panel__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface ModalProps {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  title: string;
}

export function Modal({ children, description, onClose, title }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const openCount = Number(document.body.dataset.modalOpenCount ?? "0") + 1;
    document.body.dataset.modalOpenCount = String(openCount);
    document.body.classList.add("modal-open");

    return () => {
      const nextOpenCount = Math.max(0, Number(document.body.dataset.modalOpenCount ?? "1") - 1);

      if (nextOpenCount === 0) {
        document.body.classList.remove("modal-open");
        delete document.body.dataset.modalOpenCount;
      } else {
        document.body.dataset.modalOpenCount = String(nextOpenCount);
      }
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="modal__close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
