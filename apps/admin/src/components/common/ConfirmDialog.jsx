import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    variant = 'danger',
    onConfirm,
    onCancel
}) {
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            return;
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape' && !submitting) {
                onCancel?.();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onCancel, submitting]);

    if (!open) {
        return null;
    }

    async function handleConfirm() {
        setSubmitting(true);
        try {
            await Promise.resolve(onConfirm?.());
            onCancel?.();
        } finally {
            setSubmitting(false);
        }
    }

    const node = (
        <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <button
                type="button"
                className="confirm-dialog__backdrop"
                aria-label={cancelLabel}
                onClick={() => !submitting && onCancel?.()}
            />
            <div className="confirm-dialog__panel">
                <div className="confirm-dialog__header">
                    <div className="confirm-dialog__icon">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="confirm-dialog__titles">
                        <h3 id="confirm-dialog-title">{title}</h3>
                        <p>{description}</p>
                    </div>
                </div>

                <div className="confirm-dialog__actions">
                    <button
                        type="button"
                        className="confirm-dialog__button confirm-dialog__button--secondary"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`confirm-dialog__button confirm-dialog__button--${variant}`}
                        onClick={handleConfirm}
                        disabled={submitting}
                    >
                        {submitting ? '...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(node, document.body);
}
