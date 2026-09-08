import { Injectable, signal } from '@angular/core';

/** Identity decoded from the JWT. For display only; authorization happens server-side. */
export interface SessionIdentity {
  memberId: string;
  groupId: string;
  role: 'admin' | 'member';
}

interface RecentGroup {
  id: string;
  name: string;
  lastOpenedAt: string;
  /** ISO string. Optional because older stored entries lack it. */
  createdAt?: string;
}

const TOKEN_PREFIX = 'kitty.token.';
const RECENT_KEY = 'kitty.groups';

/**
 * @description Persists per-group tokens and the recent-groups list in localStorage.
 * Tokens are keyed by group id, so one device can hold a different identity in each group.
 * Every storage call is wrapped in try/catch because localStorage can throw in private
 * mode or when site data is blocked.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  /** Recently opened groups, most recent first (max 10). */
  readonly recentGroups = signal<RecentGroup[]>(this.readRecent());

  getToken(groupId: string): string | null {
    try {
      return localStorage.getItem(TOKEN_PREFIX + groupId);
    } catch {
      return null;
    }
  }

  setToken(groupId: string, token: string): void {
    try {
      localStorage.setItem(TOKEN_PREFIX + groupId, token);
    } catch {
      /* Ignored; the token is simply not persisted. */
    }
  }

  /** @description Removes the group's token and drops it from the recent-groups list. */
  forgetGroup(groupId: string): void {
    try {
      localStorage.removeItem(TOKEN_PREFIX + groupId);
    } catch {
      /* noop */
    }
    const next = this.recentGroups().filter((g) => g.id !== groupId);
    this.recentGroups.set(next);
    this.writeRecent(next);
  }

  /**
   * @description Decodes the stored JWT payload without verifying the signature.
   * Used only for display (the "you" label, hiding admin actions); the server verifies
   * the token on every request. Reading from the token keeps identity across reloads.
   * @param groupId - Group whose token to decode.
   * @returns The identity, or null when there is no token or it is malformed.
   */
  getIdentity(groupId: string): SessionIdentity | null {
    const token = this.getToken(groupId);
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      // base64url -> base64
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      ) as { sub?: string; gid?: string; role?: string };

      if (!payload.sub || !payload.gid) return null;
      return {
        memberId: payload.sub,
        groupId: payload.gid,
        role: payload.role === 'admin' ? 'admin' : 'member',
      };
    } catch {
      return null; // malformed token: treat as signed out
    }
  }

  /** @description Moves the group to the top of the recent list, keeping at most 10 entries. */
  rememberGroup(id: string, name: string, createdAt?: string): void {
    // Keep the stored createdAt when the caller does not supply one (e.g. reopening a group).
    const existing = this.recentGroups().find((g) => g.id === id);
    const next = [
      {
        id,
        name,
        lastOpenedAt: new Date().toISOString(),
        createdAt: createdAt ?? existing?.createdAt,
      },
      ...this.recentGroups().filter((g) => g.id !== id),
    ].slice(0, 10);
    this.recentGroups.set(next);
    this.writeRecent(next);
  }

  private readRecent(): RecentGroup[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as RecentGroup[]) : [];
    } catch {
      return [];
    }
  }

  private writeRecent(groups: RecentGroup[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(groups));
    } catch {
      /* noop */
    }
  }
}
