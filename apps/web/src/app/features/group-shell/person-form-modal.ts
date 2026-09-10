import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from '@angular/core';
import { GroupStore } from '../../core/store/group.store';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiModal } from '../../ui/ui-modal/ui-modal';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Modal for adding a member. The avatar preview is bound to the `name` signal,
 * so it updates as the user types.
 */
@Component({
  selector: 'app-person-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiAvatar],
  template: `
    <ui-modal [(open)]="open" [title]="i18n.t('personForm.title')" (closed)="reset()">
      <div class="flex flex-col items-center gap-4">
        <ui-avatar [name]="name() || '?'" [color]="color()" size="lg" />

        <div class="flex gap-2">
          @for (c of palette; track c) {
            <button
              type="button"
              class="h-7 w-7 rounded-full ring-offset-2 transition"
              [class.ring-2]="color() === c"
              [style.backgroundColor]="c"
              [attr.aria-label]="i18n.t('personForm.pickColor', { color: c })"
              (click)="color.set(c)"
            ></button>
          }
        </div>

        <!-- Single-field form: focus it immediately -->
        <input
          data-autofocus
          class="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          [placeholder]="i18n.t('personForm.namePlaceholder')"
          maxlength="60"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
      </div>

      <div footer class="flex w-full gap-2">
        <ui-button variant="secondary" [full]="true" (click)="open.set(false)">{{
          i18n.t('common.cancel')
        }}</ui-button>
        <ui-button [full]="true" [disabled]="!canSave()" [loading]="saving()" (click)="save()">
          {{ i18n.t('common.add') }}
        </ui-button>
      </div>
    </ui-modal>
  `,
})
export class PersonFormModal {
  protected readonly i18n = inject(I18nService);

  readonly open = model(false);

  private readonly store = inject(GroupStore);

  protected readonly palette = ['#6366F1', '#059669', '#DC2626', '#F97316', '#0EA5E9', '#A855F7'];
  protected readonly name = signal('');
  protected readonly color = signal('#6366F1');
  protected readonly saving = signal(false);
  protected readonly canSave = computed(() => this.name().trim().length > 0);

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      const created = await this.store.addMember(this.name().trim());
      if (created) this.open.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  protected reset(): void {
    this.name.set('');
    this.color.set('#6366F1');
  }
}
