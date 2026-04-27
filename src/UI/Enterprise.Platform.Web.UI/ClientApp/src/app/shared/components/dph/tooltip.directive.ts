/**
 * ─── DPH UI KIT — TOOLTIP DIRECTIVE ─────────────────────────────────────────────
 *
 * Thin wrapper over PrimeNG `pTooltip` so consumers always get our delay /
 * positioning defaults. Apply via host directive composition.
 *
 *   import { TooltipDirective } from '@shared/components/dph';
 *   @Component({ ..., imports: [TooltipDirective] })
 *
 *   <button dphTooltip="Save" dphTooltipPosition="bottom">Save</button>
 */
import { Directive, input } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';

@Directive({
  selector: '[dphTooltip]',
  standalone: true,
  hostDirectives: [
    {
      directive: Tooltip,
      inputs: [
        'pTooltip: dphTooltip',
        'tooltipPosition: dphTooltipPosition',
        'showDelay: dphTooltipShowDelay',
        'hideDelay: dphTooltipHideDelay',
      ],
    },
  ],
})
export class TooltipDirective {
  readonly dphTooltip = input<string>('');
  readonly dphTooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('bottom');
  readonly dphTooltipShowDelay = input<number>(200);
  readonly dphTooltipHideDelay = input<number>(0);
}
