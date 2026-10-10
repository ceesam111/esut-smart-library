// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { I18nProvider } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ role: 'student', profile: null, loading: false }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    permission: 'default',
    supported: true,
    notifications: [],
    unreadCount: 0,
    loading: false,
    requestPermission: () => {},
    markAllRead: () => {},
    markRead: () => {},
  }),
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

async function expectNoSeriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
  });
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = serious
    .map((v) => `${v.id} (${v.impact}): ${v.help}`)
    .join('\n');
  expect(serious, `Serious/critical axe violations:\n${summary}`).toEqual([]);
}

describe('accessibility axe suite', () => {
  afterEach(() => {
    cleanup();
  });

  it('Table: header cells expose scope, data table has no serious axe violations', async () => {
    const { container } = renderWithI18n(
      <Table aria-label="Patron loans">
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Introduction to Algorithms</TableCell>
            <TableCell>2026-01-15</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    for (const th of headers) {
      expect(th.getAttribute('scope')).toBe('col');
    }
    await expectNoSeriousViolations(container);
  });

  it('Dialog: has accessible name, labelled close button, no serious axe violations', async () => {
    const { container } = renderWithI18n(
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve a seat</DialogTitle>
            <DialogDescription>Confirm your booking for the exam prep session.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toBeTruthy();
    await expectNoSeriousViolations(container);
  });

  it('Dialog: Escape closes and returns focus to trigger', async () => {
    renderWithI18n(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve a seat</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('LanguageSwitcher: select has an accessible name and localises options', async () => {
    const { container } = renderWithI18n(<LanguageSwitcher id="lang-test" />);

    const select = screen.getByRole('combobox', { name: /language/i });
    expect(select).toBeTruthy();
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
    await expectNoSeriousViolations(container);
  });

  it('form controls: labelled inputs announce errors via aria-describedby', async () => {
    const { container } = renderWithI18n(
      <form aria-label="Report an issue">
        <label htmlFor="email-field">Email</label>
        <input
          id="email-field"
          type="email"
          aria-invalid="true"
          aria-describedby="email-error"
          required
        />
        <p id="email-error" role="alert">
          Enter a valid email address.
        </p>
        <button type="submit">Send</button>
      </form>,
    );

    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(screen.getByRole('alert').textContent).toMatch(/valid email/i);
    await expectNoSeriousViolations(container);
  });

  it('icon-only button exposes an accessible name', async () => {
    const { container } = renderWithI18n(
      <button type="button" aria-label="Delete item">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 6h18" />
        </svg>
      </button>,
    );

    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
    await expectNoSeriousViolations(container);
  });

  it('decorative images are hidden from the accessibility tree', async () => {
    const { container } = renderWithI18n(
      <div>
        <img src="/deco.png" alt="" aria-hidden="true" />
        <p>Content beside decoration</p>
      </div>,
    );

    await expectNoSeriousViolations(container);
  });

  it('skip-link pattern: anchor to main landmark is present and focusable', async () => {
    const { container } = renderWithI18n(
      <div>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <main id="main-content" tabIndex={-1}>
          <h1>Page heading</h1>
        </main>
      </div>,
    );

    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link.getAttribute('href')).toBe('#main-content');
    link.focus();
    expect(document.activeElement).toBe(link);
    await expectNoSeriousViolations(container);
  });
});
