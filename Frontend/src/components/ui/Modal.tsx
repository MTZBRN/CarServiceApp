import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className = "",
}) => (
  <div className="modal-overlay" onClick={onClose}>
    <div
      className={`modal-content ui-modal ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="ui-modal-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Bezárás"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="ui-modal-body">{children}</div>
      {footer && <footer className="ui-modal-footer">{footer}</footer>}
    </div>
  </div>
);

export default Modal;
