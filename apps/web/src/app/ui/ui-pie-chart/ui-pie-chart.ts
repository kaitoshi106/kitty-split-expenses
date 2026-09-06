import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * One slice of the donut chart. `valueLabel` is pre-formatted by the caller so the
 * component stays unaware of currency and locale.
 */
export interface PieSlice {
  label: string;
  /** Integer percentage; the caller ensures slices sum to 100. */
  percent: number;
  valueLabel: string;
  /**
   * Optional color override, e.g. a member's avatar color so the slice matches the
   * rest of the UI. Defaults to the built-in palette.
   */
  color?: string;
}

/**
 * @description Static donut chart in plain SVG with a legend, avoiding a chart library.
 * Each slice is a full circle stroke clipped with stroke-dasharray and positioned with
 * stroke-dashoffset; unlike arc paths, this renders a 100% slice correctly.
 */
@Component({
  selector: 'ui-pie-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible().length === 0) {
      <p class="py-8 text-center text-sm text-slate-400">{{ emptyLabel() }}</p>
    } @else {
      <!--
        Container queries (@md:) instead of viewport breakpoints (md:): the chart may sit
        in a narrow card on a wide screen, where a horizontal layout would crush the legend.
      -->
      <div class="@container">
        <!-- Cap the width in the horizontal layout so legend labels stay close to their values. -->
        <div
          class="mx-auto flex flex-col items-center gap-5 @md:max-w-lg @md:flex-row @md:gap-6"
        >
          <div class="shrink-0">
            <!--
              role="img" with a short aria-label; the legend carries the full content.
              Smaller in the horizontal layout, where the chart sets the card height.
            -->
            <svg
              viewBox="0 0 100 100"
              class="h-44 w-44 @md:h-36 @md:w-36"
              role="img"
              [attr.aria-label]="ariaLabel()"
            >
              <!--
                Track ring visible through gaps between slices. Uses a theme class rather
                than a hard-coded color so it adapts to dark mode.
              -->
              <circle cx="50" cy="50" [attr.r]="RADIUS" fill="none"
                      class="stroke-slate-100" [attr.stroke-width]="THICKNESS" />
              @for (arc of arcs(); track arc.label) {
                <circle
                  cx="50"
                  cy="50"
                  [attr.r]="RADIUS"
                  fill="none"
                  [attr.stroke]="arc.color"
                  [attr.stroke-width]="THICKNESS"
                  [attr.stroke-dasharray]="arc.dashArray"
                  [attr.stroke-dashoffset]="arc.dashOffset"
                  transform="rotate(-90 50 50)"
                />
              }

              @if (centerValue()) {
                <!-- Center text lives inside the SVG so it scales with the viewBox. -->
                <text
                  x="50"
                  y="47"
                  text-anchor="middle"
                  letter-spacing="0.35"
                  class="fill-slate-400 uppercase"
                  [attr.font-size]="labelFontSize()"
                >{{ centerLabel() }}</text>
                <text
                  x="50"
                  y="57.5"
                  text-anchor="middle"
                  class="fill-slate-900 font-semibold tabular-nums"
                  [attr.font-size]="valueFontSize()"
                >{{ centerValue() }}</text>
              }
            </svg>
          </div>

          <ul class="flex w-full min-w-0 flex-col gap-2">
            @for (arc of arcs(); track arc.label) {
              <li class="flex items-center gap-2.5 text-sm">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  [style.background-color]="arc.color"
                ></span>
                <span class="min-w-0 flex-1 truncate">{{ arc.label }}</span>
                <span class="shrink-0 text-xs tabular-nums text-slate-400">
                  {{ arc.percent }}%
                </span>
                <span class="shrink-0 tabular-nums">{{ arc.valueLabel }}</span>
              </li>
            }
          </ul>
        </div>
      </div>
    }
  `,
})
export class UiPieChart {
  readonly slices = input.required<PieSlice[]>();
  /** Small caption above the center value. */
  readonly centerLabel = input('');
  readonly centerValue = input('');
  /** Text shown when no slice has a positive percentage. */
  readonly emptyLabel = input('—');

  /** r=36 with stroke 10 leaves a 62-unit hole (of 100) for two lines of center text. */
  protected readonly RADIUS = 36;
  protected readonly THICKNESS = 10;

  /** Gap between adjacent slices in circumference units; avoids anti-aliasing bleed at joins. */
  private readonly GAP = 1.6;
  /** Derived from RADIUS. */
  private readonly CIRCUMFERENCE = 2 * Math.PI * this.RADIUS;

  /** Fixed palette so a slice keeps the same color across reloads. */
  private readonly PALETTE = [
    '#6366F1', '#0EA5E9', '#14B8A6', '#F59E0B',
    '#EC4899', '#8B5CF6', '#10B981', '#F43F5E',
  ];

  /** Slices with 0% are neither drawn nor listed. */
  protected readonly visible = computed(() => this.slices().filter((s) => s.percent > 0));

  protected readonly arcs = computed(() => {
    const items = this.visible();
    // A single slice has no joins, so no gap.
    const gap = items.length > 1 ? this.GAP : 0;
    let offset = 0;
    return items.map((slice, i) => {
      const length = (this.CIRCUMFERENCE * slice.percent) / 100;
      // Keep at least 40% of a tiny slice so the gap does not erase it.
      const drawn = Math.max(length - gap, length * 0.4);
      const arc = {
        ...slice,
        color: slice.color ?? this.PALETTE[i % this.PALETTE.length],
        dashArray: `${drawn} ${this.CIRCUMFERENCE - drawn}`,
        // Negative offset lays slices out clockwise without overlap.
        dashOffset: -offset,
      };
      offset += length;
      return arc;
    });
  });

  /**
   * Center value font size scaled to the string length. Inner radius is 31; the line sits
   * ~7.5 units off center, so the usable chord is ~60 units, 54 with padding. A digit is
   * ~0.55 em wide, capped at 8.
   */
  protected readonly valueFontSize = computed(() => fitFontSize(this.centerValue(), 54, 0.55, 8));
  /** Uppercase label glyphs are wider, hence the 0.62 ratio. */
  protected readonly labelFontSize = computed(() => fitFontSize(this.centerLabel(), 52, 0.62, 6.2));

  protected readonly ariaLabel = computed(() =>
    this.visible().map((s) => `${s.label} ${s.percent}%`).join(', '),
  );
}

/**
 * @description Largest font size at which `text` fits within `width` units, capped at `max`.
 * @param text - Text to fit.
 * @param width - Available width in SVG units.
 * @param ratio - Average glyph width as a fraction of font size.
 * @param max - Upper bound for the font size.
 * @returns Font size rounded to one decimal.
 */
function fitFontSize(text: string, width: number, ratio: number, max: number): number {
  const len = Math.max(text.length, 1);
  return Math.round(Math.min(max, width / (len * ratio)) * 10) / 10;
}
