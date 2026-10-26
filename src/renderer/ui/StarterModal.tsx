import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  STARTER_CATEGORIES,
  STARTERS,
  startersByCategory,
  type StarterCategory,
  type StarterDefinition,
} from '../../starters/catalog'
import { useProjectStore } from '../store/projectStore'
import { Icon } from './Icon'

type Filter = 'all' | StarterCategory

interface StarterModalProps {
  readonly onClose: () => void
}

export function StarterModal({ onClose }: StarterModalProps): JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const loadStarter = useProjectStore((state) => state.loadStarter)

  const visible = useMemo(
    () => (filter === 'all' ? STARTERS : startersByCategory(filter)),
    [filter]
  )

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const modal = rootRef.current
    if (!modal) return
    modal.style.opacity = '0'
    modal.style.transform = 'translateY(18px) scale(0.97)'
    requestAnimationFrame(() => {
      modal.style.transition = 'opacity 0.28s ease-out, transform 0.28s ease-out'
      modal.style.opacity = '1'
      modal.style.transform = 'translateY(0) scale(1)'
    })
    const cards = modal.querySelectorAll('.cb-starter-card')
    cards.forEach((card, index) => {
      const el = card as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(14px)'
      requestAnimationFrame(() => {
        el.style.transition = `opacity 0.32s ease-out ${0.08 + index * 0.035}s, transform 0.32s ease-out ${0.08 + index * 0.035}s`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      })
    })
  }, [])

  const open = (starter: StarterDefinition): void => {
    loadStarter(starter)
    onClose()
  }

  return (
    <div
      className="cb-modal-backdrop"
      data-testid="starter-modal"
      ref={rootRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="cb-starter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="starter-title"
      >
        <header className="cb-starter-modal-header">
          <div>
            <span className="cb-eyebrow">Starter library</span>
            <h2 id="starter-title">Pick a working circuit</h2>
            <p>
              Every starter is a complete project with wiring, a sketch, and a short explanation.
              Load one, then change it to make it yours.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cb-icon-button"
            aria-label="Close starter library"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="cb-starter-filters" role="tablist" aria-label="Starter categories">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={filter === 'all' ? 'cb-chip is-active' : 'cb-chip'}
            onClick={() => setFilter('all')}
          >
            All <span>{STARTERS.length}</span>
          </button>
          {STARTER_CATEGORIES.map((category) => {
            const count = startersByCategory(category.id).length
            if (count === 0) return null
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={filter === category.id}
                className={filter === category.id ? 'cb-chip is-active' : 'cb-chip'}
                onClick={() => setFilter(category.id)}
              >
                {category.label} <span>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="cb-starter-scroll">
          {filter !== 'all' && (
            <p className="cb-starter-category-blurb">
              {STARTER_CATEGORIES.find((category) => category.id === filter)?.blurb}
            </p>
          )}
          <div className="cb-starter-grid">
            {visible.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="cb-starter-card"
                data-testid={`starter-card-${starter.id}`}
                onClick={() => open(starter)}
              >
                <span className="cb-starter-card-top">
                  <span className="cb-starter-card-category">
                    {STARTER_CATEGORIES.find((category) => category.id === starter.category)?.label}
                  </span>
                  <span className="cb-starter-card-file">{starter.fileName}</span>
                </span>
                <strong className="cb-starter-card-title">{starter.title}</strong>
                <span className="cb-starter-card-description">{starter.description}</span>
                <span className="cb-starter-card-action">Open starter</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
