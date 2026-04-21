/**
 * ─── appTrapFocus STRUCTURAL / ATTRIBUTE DIRECTIVE ──────────────────────────────
 *
 * Activates focus-trap on the host element when its bound condition is true.
 * The directive wraps the `focus-trap` library (lightweight, well-tested,
 * WAI-ARIA compliant) so we don't reinvent keyboard-trap logic per modal.
 *
 * USAGE (modal / drawer containers)
 *   ```html
 *   <div [appTrapFocus]="isOpen">
 *     <button>OK</button>
 *     <button>Cancel</button>
 *   </div>
 *   ```
 *
 * BEHAVIOUR
 *   - When `appTrapFocus` evaluates truthy, focus is constrained to the
 *     host subtree; tabbing wraps from the last focusable element back to
 *     the first.
 *   - When it flips back to falsy, focus is returned to the element that
 *     was active when the trap was activated.
 *   - ESC auto-deactivates — consumers listen to a separate close event to
 *     dismiss the modal.
 *
 * WHY AN `effect()`-BASED ACTIVATOR
 *   Consumers pass a signal (or signal-projection) as the binding value. The
 *   directive's effect reacts to the signal and activates / deactivates the
 *   trap accordingly. Purely declarative — no manual wiring per component.
 *
 * REFERENCES
 *   - WAI-ARIA Authoring Practices § Dialog (Modal)
 *   - focus-trap README: https://github.com/focus-trap/focus-trap
 */
import {
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { createFocusTrap, type FocusTrap } from 'focus-trap';

@Directive({
  selector: '[appTrapFocus]',
  standalone: true,
})
export class TrapFocusDirective {
  readonly appTrapFocus = input.required<boolean>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private trap: FocusTrap | null = null;

  constructor() {
    effect(() => {
      const shouldTrap = this.appTrapFocus();
      if (shouldTrap) {
        this.activate();
      } else {
        this.deactivate();
      }
    });

    this.destroyRef.onDestroy(() => this.deactivate());
  }

  private activate(): void {
    if (this.trap) return;
    this.trap = createFocusTrap(this.host.nativeElement, {
      // Clicking OUTSIDE the trap should not cancel it — the trap is part of
      // a modal's a11y contract, not a stand-alone focus manager.
      clickOutsideDeactivates: false,
      // ESC defers to the consumer's own close handler, not the trap —
      // otherwise two handlers would fight over the key.
      escapeDeactivates: false,
      // If the host has no focusable children yet (e.g. async content), fall
      // back to focusing the host itself so focus doesn't escape to <body>.
      fallbackFocus: this.host.nativeElement,
      returnFocusOnDeactivate: true,
    });
    this.trap.activate();
  }

  private deactivate(): void {
    if (!this.trap) return;
    this.trap.deactivate();
    this.trap = null;
  }
}
