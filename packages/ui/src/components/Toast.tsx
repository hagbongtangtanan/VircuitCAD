export type ToastProps = {
  message: string | undefined;
  onDismiss?: () => void;
  tone?: 'error' | 'info';
};

export function Toast({ message, onDismiss, tone = 'error' }: ToastProps) {
  if (!message) return null;
  return (
    <div role="alert" data-testid="toast" data-tone={tone} className="toast">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
