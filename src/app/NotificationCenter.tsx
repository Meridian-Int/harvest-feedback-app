import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons';
import { observeAllFeedback, subscribeMyFeedback } from '../lib/feedback';
import { notificationEvents, type NotificationEvent } from '../lib/notificationEvents';
import { markNotificationsRead, subscribeNotificationReads } from '../lib/notifications';
import { isAdmin } from '../lib/auth';
import type { AuthUser, Feedback } from '../lib/types';

function NotificationToast({ event, onDismiss }: { event: NotificationEvent; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), 5000);
    return () => window.clearTimeout(timer);
  }, [event.id]);
  return <div className="notification-toast glass" role="status">
    <span className="notification-toast-label">Notification</span>
    <strong>{event.title}</strong>
    <span className="notification-toast-detail">{event.detail}</span>
    <span className="notification-toast-timer" aria-hidden="true" />
  </div>;
}

export function NotificationCenter({ user }: { user: AuthUser }) {
  const admin = isAdmin(user);
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const attempted = useRef(new Set<string>());
  const seen = useRef<Set<string> | null>(null);
  const [reports, setReports] = useState<Feedback[] | null>(null);
  const [readIds, setReadIds] = useState<Set<string> | null>(null);
  const [optimistic, setOptimistic] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ top: number; right: number; maxHeight: number } | null>(null);
  const [toast, setToast] = useState<NotificationEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const events = useMemo(() => notificationEvents(reports ?? [], admin), [reports, admin]);
  const unread = events.filter(event => !readIds?.has(event.id) && !optimistic.has(event.id));

  useEffect(() => {
    let active = true;
    let stopReports = () => {};
    let stopReads = () => {};
    try {
      stopReports = admin
        ? observeAllFeedback(rows => { if (active) setReports(rows); }, cause => { if (active) setError(cause.message); })
        : subscribeMyFeedback(rows => { if (active) setReports(rows); }, () => { if (active) setError('Could not load notifications.'); });
      stopReads = subscribeNotificationReads(ids => { if (active) setReadIds(ids); }, cause => { if (active) setError(cause.message); });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
    }
    return () => { active = false; stopReports(); stopReads(); };
  }, [admin, user.id]);

  useEffect(() => {
    if (reports === null || readIds === null) return;
    const current = new Set(events.map(event => event.id));
    if (seen.current) {
      const arrived = events.find(event => !seen.current?.has(event.id) && !readIds.has(event.id));
      if (arrived) setToast(arrived);
    }
    seen.current = current;
  }, [events, readIds, reports]);

  useEffect(() => {
    if (!open || readIds === null) return;
    const ids = unread.map(event => event.id).filter(id => !attempted.current.has(id));
    if (!ids.length) return;
    ids.forEach(id => attempted.current.add(id));
    setOptimistic(current => new Set([...current, ...ids]));
    void markNotificationsRead(ids).catch(cause => {
      setOptimistic(current => new Set([...current].filter(id => !ids.includes(id))));
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.');
    });
  }, [open, readIds, unread]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function positionPanel() {
      const rect = bell.current?.getBoundingClientRect();
      if (!rect) return;
      const top = Math.round(rect.bottom + 10);
      setPanelPosition({
        top,
        right: Math.max(16, Math.round(window.innerWidth - rect.right)),
        maxHeight: Math.max(0, Math.min(520, window.innerHeight - top - 16)),
      });
    }
    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open]);

  function openReport(event: NotificationEvent) {
    setOpen(false);
    navigate(admin ? `/admin/reviews?report=${encodeURIComponent(event.reportId)}` : `/feedback/mine?report=${encodeURIComponent(event.reportId)}`);
  }

  return <div className="notification-center" ref={root}>
    <button ref={bell} type="button" className="notification-bell" aria-label={`Notifications${readIds ? `, ${unread.length} unread` : ''}`} aria-expanded={open} aria-controls="notification-panel" onClick={() => { if (!open) { attempted.current.clear(); setError(null); } setOpen(!open); }}>
      <Icon name="bell" />
      {readIds && unread.length > 0 && <span className="notification-count" aria-hidden="true">{unread.length > 99 ? '99+' : unread.length}</span>}
    </button>
    {open && createPortal(<section ref={panel} id="notification-panel" className="notification-panel glass" role="dialog" aria-label="Notifications" style={panelPosition ?? undefined}>
      <header><h2>Notifications</h2><span>{unread.length ? `${unread.length} unread` : 'All caught up'}</span></header>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {reports === null || readIds === null ? <p className="notification-empty" role="status">Loading notifications…</p> : events.length === 0 ? <p className="notification-empty">No notifications yet.</p> : <div className="notification-list">
        {events.map(event => <button type="button" key={event.id} className="notification-item" data-unread={!readIds.has(event.id) && !optimistic.has(event.id)} onClick={() => openReport(event)}>
          <span className="notification-item-title">{event.title}</span>
          <span className="notification-item-detail">{event.detail}</span>
          <time dateTime={event.time}>{new Date(event.time).toLocaleString()}</time>
        </button>)}
      </div>}
    </section>, document.body)}
    {toast && createPortal(<NotificationToast key={toast.id} event={toast} onDismiss={() => setToast(null)} />, document.body)}
  </div>;
}
