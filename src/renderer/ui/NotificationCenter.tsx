import { useEffect, useRef, type JSX } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { Icon } from './Icon'

export function NotificationCenter(): JSX.Element | null {
  const items = useNotificationStore((state) => state.items)
  const dismiss = useNotificationStore((state) => state.dismiss)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const notifications = root.querySelectorAll('.cb-notification')
    notifications.forEach((notification, index) => {
      const el = notification as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(-10px) scale(0.98)'
      requestAnimationFrame(() => {
        el.style.transition = `opacity 0.24s ease-out ${index * 0.04}s, transform 0.24s ease-out ${index * 0.04}s`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0) scale(1)'
      })
    })
  }, [items])

  if (items.length === 0) return null

  return (
    <div
      ref={rootRef}
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
