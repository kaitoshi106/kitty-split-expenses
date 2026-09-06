import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiButton } from '../../ui/ui-button/ui-button';

@Component({
  selector: 'app-ui-gallery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,

  imports: [UiCard, UiAvatar, UiButton, UiAmount],

  template: `
    <main class="space-y-10 p-4 md:p-6">
      <header>
        <h1 class="text-2xl font-bold text-brand-600">UI Gallery</h1>
        <p class="mt-1 text-sm text-slate-500">
          Mọi biến thể của UI kit. Kiểm ở 375px và 1280px.
        </p>
      </header>

      <!-- ══════════════════ ui-card ══════════════════ -->
      <section class="space-y-3">
        <h2
          class="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          ui-card
        </h2>

        <ui-card>
          <p class="text-sm">Mặc định — có padding</p>
        </ui-card>

        <!-- Bound [padded] passes boolean false; an unbound attribute would pass the truthy string "false". -->
        <ui-card [padded]="false">
          <p class="p-2 text-sm">padded = false — tự lo padding bên trong</p>
        </ui-card>

        <ui-card [clickable]="true">
          <p class="text-sm">clickable = true — rê chuột vào xem bóng đổ</p>
        </ui-card>
      </section>

      <!-- ══════════════════ ui-avatar ══════════════════ -->
      <section class="space-y-4">
        <h2
          class="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          ui-avatar
        </h2>

        <div class="flex items-center gap-3">
          <ui-avatar name="Emma" size="sm" color="#6366f1" />
          <ui-avatar name="Emma" size="md" color="#6366f1" />
          <ui-avatar name="Emma" size="lg" color="#6366f1" />
          <span class="text-sm text-slate-500">sm · md · lg</span>
        </div>

        <div class="flex items-center gap-3">
          <ui-avatar name="Emma" color="#6366f1" />
          <ui-avatar name="Leo" color="#059669" />
          <ui-avatar name="Hannah" color="#dc2626" />
          <ui-avatar name="Đức" color="#f97316" />
          <span class="text-sm text-slate-500"
            >nhiều màu, có dấu tiếng Việt</span
          >
        </div>

        <!-- Edge cases: leading whitespace, empty name, emoji -->
        <div class="flex items-center gap-3">
          <ui-avatar name="   emma" color="#64748b" />
          <ui-avatar name="" color="#94a3b8" />
          <ui-avatar name="🐱 Kitty" color="#a855f7" />
          <span class="text-sm text-slate-500">
            "&nbsp;&nbsp;&nbsp;emma" → E · "" → ? · emoji không vỡ
          </span>
        </div>
      </section>

      <!-- ══════════════════ ui-button ══════════════════ -->
      <section class="space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          ui-button
        </h2>

        @for (v of variants; track v) {
          <div class="flex flex-wrap items-center gap-2">
            <ui-button [variant]="v" size="sm">{{ v }} sm</ui-button>
            <ui-button [variant]="v" size="md">{{ v }} md</ui-button>
            <ui-button [variant]="v" size="lg">{{ v }} lg</ui-button>
          </div>
        }

        <!-- States -->
        <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <ui-button [loading]="true">Đang lưu</ui-button>
          <ui-button [disabled]="true">Disabled</ui-button>
          <ui-button variant="secondary" [loading]="true">Secondary loading</ui-button>
          <ui-button variant="ghost" [disabled]="true">Ghost disabled</ui-button>
        </div>

        <!-- full: stretches to the container width -->
        <ui-button [full]="true" size="lg">Full width</ui-button>
      </section>

      <!-- ══════════════════ ui-amount ══════════════════ -->
      <section class="space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          ui-amount
        </h2>

        <!-- 3 size -->
        <div class="flex flex-wrap items-baseline gap-4">
          <ui-amount [minor]="426666" currency="VND" size="sm" />
          <ui-amount [minor]="426666" currency="VND" size="md" />
          <ui-amount [minor]="426666" currency="VND" size="lg" />
          <span class="text-sm text-slate-500">sm · md · lg (chưa signed)</span>
        </div>

        <!-- signed: positive, negative, zero -->
        <div class="flex flex-wrap items-center gap-4">
          <ui-amount [minor]="426666" currency="VND" [signed]="true" />
          <ui-amount [minor]="-233333" currency="VND" [signed]="true" />
          <ui-amount [minor]="0" currency="VND" [signed]="true" />
          <span class="text-sm text-slate-500">
            dương xanh · âm đỏ · 0 xám và KHÔNG có dấu
          </span>
        </div>

        <!-- Other currencies -->
        <div class="flex flex-wrap items-center gap-4">
          <ui-amount [minor]="1050" currency="USD" />
          <ui-amount [minor]="5" currency="USD" />
          <ui-amount [minor]="1500" currency="JPY" />
          <ui-amount [minor]="123456" currency="EUR" />
          <span class="text-sm text-slate-500">USD · JPY · EUR</span>
        </div>

        <!-- tabular-nums check: right-aligned digits and separators should line up. -->
        <ui-card>
          <p class="mb-2 text-xs text-slate-400">
            Cột căn phải — mọi chữ số phải thẳng hàng
          </p>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-sm text-slate-600">Emma</span>
              <ui-amount [minor]="426666" currency="VND" [signed]="true" />
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-600">Leo</span>
              <ui-amount [minor]="-233333" currency="VND" [signed]="true" />
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-600">Hannah</span>
              <ui-amount [minor]="-193333" currency="VND" [signed]="true" />
            </div>
          </div>
        </ui-card>
      </section>

    </main>
  `,
})
export class UiGalleryPage {
  // `as const` keeps the literal union so [variant]="v" type-checks.
  protected readonly variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
}
