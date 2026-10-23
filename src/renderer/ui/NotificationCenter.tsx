import type { JSX } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { Icon } from './Icon'

export function NotificationCenter(): JSX.Element | null {
  const items = useNotificationStore((state) => state.items)
  const dismiss = useNotificationStore((state) => state.dismiss)

  if (items.length === 0) return null

  return (
    <div
      className="cb-notifications"
      data-testid="notifications"
      aria-label="Notifications"
      aria-live="polite"
    >
      {items.map((item) => (
        <section
          key={item.id}
          className={`cb-notification cb-notification-${item.tone}`}
          data-testid={`notification-${item.tone}`}
          role={item.tone === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
        >
          <span className="cb-notification-mark" aria-hidden="true" />
          <div className="cb-notification-copy">
            <strong className="cb-notification-title">{item.title}</strong>
            {item.message === undefined ? null : (
              <p className="cb-notification-message">{item.message}</p>
            )}
          </div>
          <button
            type="button"
            className="cb-notification-close"
            aria-label={`Dismiss ${item.title}`}
            onClick={() => dismiss(item.id)}
          >
            <Icon name="close" />
          </button>
        </section>
      ))}
    </div>
  )
}
