import type { Route } from '@angular/router';
import { groupTokenGuard } from './core/guards/group-token.guard';

/**
 * @description Application routes. Every screen is lazy-loaded to keep the initial bundle small.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./features/welcome/welcome-page').then((m) => m.WelcomePage),
  },
  {
    path: 'new-group',
    loadComponent: () => import('./features/new-group/new-group-page').then((m) => m.NewGroupPage),
  },
  {
    path: 'join',
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'join/:code',
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'ui',
    loadComponent: () => import('./features/ui-gallery/ui-gallery-page').then((m) => m.UiGalleryPage),
  },
  {
    // Parent route owns the layout (header, tabs, FAB, modals); children swap the content.
    path: 'g/:gid',
    canActivate: [groupTokenGuard],
    loadComponent: () =>
      import('./features/group-shell/group-shell-page').then((m) => m.GroupShellPage),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./features/overview/overview-tab').then((m) => m.OverviewTab),
      },
      {
        path: 'expenses',
        loadComponent: () => import('./features/expenses/expenses-tab').then((m) => m.ExpensesTab),
      },
    ],
  },
  {
    path: 'g/:gid/member/:mid',
    canActivate: [groupTokenGuard],
    loadComponent: () =>
      import('./features/member-detail/member-detail-page').then((m) => m.MemberDetailPage),
  },
  {
    path: 'g/:gid/balances',
    canActivate: [groupTokenGuard],
    loadComponent: () => import('./features/balances/balances-page').then((m) => m.BalancesPage),
  },
  {
    path: 'g/:gid/activity',
    canActivate: [groupTokenGuard],
    loadComponent: () => import('./features/activity/activity-page').then((m) => m.ActivityPage),
  },
  {
    path: 'g/:gid/trash',
    canActivate: [groupTokenGuard],
    loadComponent: () => import('./features/trash/trash-page').then((m) => m.TrashPage),
  },
  {
    path: 'g/:gid/settle-up',
    canActivate: [groupTokenGuard],
    loadComponent: () =>
      import('./features/settle-up/settle-up-page').then((m) => m.SettleUpPage),
  },
  {
    path: 'g/:gid/summary',
    canActivate: [groupTokenGuard],
    loadComponent: () => import('./features/summary/summary-page').then((m) => m.SummaryPage),
  },
  {
    path: 'g/:gid/settings',
    canActivate: [groupTokenGuard],
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];
