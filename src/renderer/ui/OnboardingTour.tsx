import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react'
import { APP_NAME } from '../../shared/app'
import { Icon } from './Icon'

export type OnboardingMode = 'welcome' | 'tour'

type TourPlacement = 'center' | 'top' | 'bottom' | 'left' | 'right'

interface TourStep {
  readonly selector: string
  readonly title: string
  readonly body: string
  readonly placement: TourPlacement
}

const TOUR_STEPS: readonly TourStep[] = [
  {
    selector: '.cb-stage',
    title: 'Your workspace',
    body: 'Drag parts from the library or click a card to place one. Drag from pin to pin to wire the circuit, then pan and zoom around the board.',
    placement: 'center',
  },
  {
    selector: '.cb-parts-panel',
    title: 'Parts library',
    body: 'Start with Basic parts, browse everything under All parts, or load a ready-made Starters circuit. Search by name when you know what you need.',
    placement: 'left',
  },
  {
    selector: '.cb-topbar-actions',
    title: 'Build and simulate',
    body: 'Open the Code panel to edit the sketch. Build checks it, and Start simulation runs the circuit with live pin and component behaviour.',
    placement: 'bottom',
  },
  {
    selector: '.cb-view-tabs',
    title: 'Two views, one circuit',
    body: 'Circuit is the physical wiring view. Schematic turns the same project into a clean diagram. You can switch back at any time.',
    placement: 'bottom',
  },
]

interface OnboardingTourProps {
  readonly mode: OnboardingMode
  readonly onStart: () => void
  readonly onDismiss: () => void
  readonly onFinish: () => void
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function cardStyle(
  rect: DOMRect | null,
  placement: TourPlacement,
  card: { readonly width: number; readonly height: number }
): CSSProperties {
  const margin = 18
  const width = card.width > 0 ? card.width : 360
  const height = card.height > 0 ? card.height : 220
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const maxTop = Math.max(margin, window.innerHeight - height - margin)

  if (rect === null || placement === 'center') {
    return {
      left: clamp((window.innerWidth - width) / 2, margin, maxLeft),
      top: clamp((window.innerHeight - height) / 2, margin, maxTop),
    }
  }

  let left = rect.left + rect.width / 2 - width / 2
  let top = rect.top + rect.height / 2 - height / 2

  if (placement === 'left') {
    left = rect.left - width - margin
  } else if (placement === 'right') {
    left = rect.right + margin
  } else if (placement === 'top') {
    top = rect.top - height - margin
  } else if (placement === 'bottom') {
    top = rect.bottom + margin
  }

  return {
    left: clamp(left, margin, maxLeft),
    top: clamp(top, margin, maxTop),
  }
}

function spotlightStyle(rect: DOMRect | null): CSSProperties | null {
  if (rect === null) return null
  const padding = 6
  return {
    left: Math.max(0, rect.left - padding),
    top: Math.max(0, rect.top - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

/** First-run orientation and replayable spotlight tour. */
export function OnboardingTour({
  mode,
  onStart,
  onDismiss,
  onFinish,
}: OnboardingTourProps): JSX.Element {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardSize, setCardSize] = useState({ width: 360, height: 220 })
  const cardRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const bodyId = useId()

  const step = mode === 'tour' ? (TOUR_STEPS[stepIndex] ?? null) : null
  const lastStep = stepIndex === TOUR_STEPS.length - 1

  useEffect(() => {
    if (mode === 'tour') setStepIndex(0)
  }, [mode])

  useEffect(() => {
    const update = (): void => {
      if (step === null) {
        setTargetRect(null)
      } else {
        const target = document.querySelector(step.selector)
        setTargetRect(target instanceof HTMLElement ? target.getBoundingClientRect() : null)
      }
      const card = cardRef.current
      if (card !== null) {
        setCardSize({ width: card.offsetWidth, height: card.offsetHeight })
      }
    }
    update()
    const frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  useEffect(() => {
    cardRef.current?.focus()
  }, [mode, stepIndex])

  const onKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab') return
      const card = cardRef.current
      if (card === null) return
      const focusable = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onDismiss]
  )

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const next = (): void => {
    if (lastStep) onFinish()
    else setStepIndex((current) => current + 1)
  }

  const spotlight = spotlightStyle(targetRect)
  const style = cardStyle(targetRect, step?.placement ?? 'center', cardSize)

  return (
    <div className="cb-tour" data-testid="onboarding-tour">
      <div className="cb-tour-blocker" />
      {spotlight === null ? (
        <div className="cb-tour-backdrop" />
      ) : (
        <div className="cb-tour-spotlight" style={spotlight} />
      )}
      <section
        ref={cardRef}
        className="cb-tour-card"
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        data-testid={mode === 'welcome' ? 'onboarding-welcome' : 'onboarding-step'}
      >
        <button
          type="button"
          className="cb-icon-button cb-tour-close"
          aria-label="Close orientation"
          onClick={onDismiss}
        >
          <Icon name="close" />
        </button>

        {mode === 'welcome' ? (
          <>
            <span className="cb-brand-mark cb-brand-mark-large" aria-hidden="true">
              <span className="cb-brand-pin" />
            </span>
            <p className="cb-tour-eyebrow">First-time orientation</p>
            <h2 id={titleId} className="cb-tour-title">
              Welcome to {APP_NAME}
            </h2>
            <p id={bodyId} className="cb-tour-copy">
              Build Arduino circuits, wire components, write sketches, and run the simulator. This
              quick tour points out the parts of the workspace you will use most.
            </p>
            <div className="cb-tour-actions cb-tour-actions-stacked">
              <button
                type="button"
                className="cb-button cb-button-primary"
                data-testid="onboarding-start"
                onClick={onStart}
              >
                Take the tour
              </button>
              <button
                type="button"
                className="cb-button"
                data-testid="onboarding-skip"
                onClick={onDismiss}
              >
                I already know my way around
              </button>
            </div>
            <p className="cb-tour-hint">You can replay this from File → Show tour.</p>
          </>
        ) : (
          step !== null && (
            <>
              <p className="cb-tour-eyebrow">
                Step {stepIndex + 1} of {TOUR_STEPS.length}
              </p>
              <h2 id={titleId} className="cb-tour-title">
                {step.title}
              </h2>
              <p id={bodyId} className="cb-tour-copy">
                {step.body}
              </p>
              <div className="cb-tour-progress" aria-hidden="true">
                {TOUR_STEPS.map((item, index) => (
                  <span
                    key={item.selector}
                    className={index === stepIndex ? 'cb-tour-dot is-active' : 'cb-tour-dot'}
                  />
                ))}
              </div>
              <div className="cb-tour-actions">
                <button type="button" className="cb-tour-skip" onClick={onDismiss}>
                  Skip tour
                </button>
                <div className="cb-tour-nav">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      className="cb-button"
                      onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="cb-button cb-button-primary"
                    data-testid="onboarding-next"
                    onClick={next}
                  >
                    {lastStep ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </section>
    </div>
  )
}
