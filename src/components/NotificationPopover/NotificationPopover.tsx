import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterNotifications,
  formatNotificationTime,
  getNotificationCategoryMeta,
  splitNotificationsByReadState,
  type NotificationCategory,
  type NotificationFilter,
} from "../../features/notifications/notificationModel";
import type { PersonalNotification } from "../../types/personalDashboard";
import "./NotificationPopover.css";

export interface NotificationPopoverProps {
  notifications: PersonalNotification[];
  loading?: boolean;
  error?: string;
  busy?: boolean;
  onClose: () => void;
  onRead: (id?: string) => Promise<boolean | void> | void;
  onRetry?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  isClosing?: boolean;
}

function NotificationCategoryIcon({ category }: { category: NotificationCategory }) {
  switch (category) {
    case "pendencia":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M12 11v4" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "treino":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "feedback":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "aluno":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "strava":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

export default function NotificationPopover({
  notifications,
  loading,
  error,
  busy,
  onClose,
  onRead,
  onRetry,
  triggerRef,
  isClosing = false,
}: NotificationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const { sorted, unreadCount } = useMemo(
    () => splitNotificationsByReadState(notifications),
    [notifications]
  );

  const pendenciaCount = useMemo(
    () =>
      sorted.filter(
        (item) => getNotificationCategoryMeta(item).category === "pendencia"
      ).length,
    [sorted]
  );

  const filteredList = useMemo(
    () => filterNotifications(sorted, activeFilter),
    [sorted, activeFilter]
  );

  const { unread: visibleUnread, read: visibleRead } = useMemo(
    () => splitNotificationsByReadState(filteredList),
    [filteredList]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef?.current?.focus();
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(timer);
    };
  }, [onClose, triggerRef]);

  const renderNotificationEntry = (item: PersonalNotification) => {
    const meta = getNotificationCategoryMeta(item);
    const isUnread = !item.lida;

    return (
      <li key={item.id} className="notification-popover__item">
        <button
          type="button"
          disabled={busy}
          className={`notification-popover__entry ${isUnread ? "is-unread" : "is-read"}`}
          onClick={() => {
            if (isUnread) {
              void onRead(item.id);
            }
          }}
          aria-label={`${item.titulo}. ${item.mensagem}. ${
            item.lida ? "Notificação lida" : "Não lida. Clique para marcar como lida"
          }`}
        >
          <div className={`notification-popover__icon-box notification-popover__icon-box--${meta.tone} ${isUnread ? "is-unread" : "is-read"}`}>
            <NotificationCategoryIcon category={meta.category} />
            <span
              className={`notification-popover__dot ${isUnread ? "is-unread" : "is-read"}`}
              aria-hidden="true"
            />
          </div>

          <div className="notification-popover__body">
            <div className="notification-popover__meta-row">
              <div className="notification-popover__tags">
                <span className={`notification-popover__cat-pill notification-popover__cat-pill--${meta.tone}`}>
                  {meta.label}
                </span>
                {isUnread && (
                  <span className="notification-popover__unread-pill">Não lida</span>
                )}
              </div>
              <time className="notification-popover__entry-time" dateTime={item.dataCriacao}>
                {formatNotificationTime(item.dataCriacao)}
              </time>
            </div>

            <strong className="notification-popover__entry-title">{item.titulo}</strong>
            <p className="notification-popover__entry-msg">{item.mensagem}</p>
          </div>

          <span
            className={`notification-popover__status-action ${isUnread ? "is-unread" : "is-read"}`}
            title={isUnread ? "Clique para marcar como lida" : "Visualizada"}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div
      ref={popoverRef}
      className={`notification-popover ${isClosing ? "is-closing" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Central de notificações"
    >
      <div className="notification-popover__header">
        <div className="notification-popover__title-wrap">
          <h2 className="notification-popover__title">Notificações</h2>
          {unreadCount > 0 ? (
            <span className="notification-popover__badge" aria-label={`${unreadCount} notificações não lidas`}>
              {unreadCount} {unreadCount === 1 ? "não lida" : "não lidas"}
            </span>
          ) : (
            sorted.length > 0 && (
              <span className="notification-popover__badge notification-popover__badge--read">
                Em dia
              </span>
            )
          )}
        </div>
        <button
          type="button"
          className="notification-popover__mark-all"
          disabled={busy || unreadCount === 0}
          onClick={() => void onRead()}
          title="Marcar todas as notificações como lidas"
        >
          Marcar todas como lidas
        </button>
      </div>

      {!loading && !error && sorted.length > 0 && (
        <div className="notification-popover__tabs" role="tablist" aria-label="Filtrar notificações">
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "all"}
            className={`notification-popover__tab ${activeFilter === "all" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <span>Todas</span>
            <span className="notification-popover__tab-count">{sorted.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "unread"}
            className={`notification-popover__tab ${activeFilter === "unread" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("unread")}
          >
            <span>Não lidas</span>
            <span
              className={`notification-popover__tab-count ${
                unreadCount > 0 ? "notification-popover__tab-count--highlight" : ""
              }`}
            >
              {unreadCount}
            </span>
          </button>
          {pendenciaCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === "pendencia"}
              className={`notification-popover__tab ${activeFilter === "pendencia" ? "is-active" : ""}`}
              onClick={() => setActiveFilter("pendencia")}
            >
              <span>Pendências</span>
              <span className="notification-popover__tab-count">{pendenciaCount}</span>
            </button>
          )}
        </div>
      )}

      <div className="notification-popover__content">
        {loading ? (
          <div className="notification-popover__loading" role="status">
            <span className="notification-popover__spinner" aria-hidden="true" />
            <p>Carregando notificações…</p>
          </div>
        ) : error ? (
          <div className="notification-popover__error" role="alert">
            <p>{error}</p>
            {onRetry && (
              <button type="button" className="workspace-link" onClick={onRetry}>
                Tentar novamente
              </button>
            )}
          </div>
        ) : sorted.length === 0 ? (
          <div className="notification-popover__empty">
            <img src="/design-system/imgBell.svg" alt="" className="notification-popover__empty-icon" />
            <strong>Tudo em dia!</strong>
            <p>Nenhuma notificação por enquanto.</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="notification-popover__empty">
            <img src="/design-system/imgBell.svg" alt="" className="notification-popover__empty-icon" />
            <strong>Zero notificações não lidas!</strong>
            <p>Você já visualizou todos os avisos recentes.</p>
            <button
              type="button"
              className="notification-popover__switch-all-btn"
              onClick={() => setActiveFilter("all")}
            >
              Ver histórico completo ({sorted.length})
            </button>
          </div>
        ) : (
          <div className="notification-popover__sections">
            {visibleUnread.length > 0 && (
              <div className="notification-popover__section">
                <div className="notification-popover__section-header is-unread">
                  <span className="notification-popover__section-dot is-unread" aria-hidden="true" />
                  <span>Prioridade · Não lidas ({visibleUnread.length})</span>
                </div>
                <ul className="notification-popover__list">
                  {visibleUnread.map(renderNotificationEntry)}
                </ul>
              </div>
            )}

            {visibleRead.length > 0 && (
              <div className="notification-popover__section">
                <div className="notification-popover__section-header is-read">
                  <span className="notification-popover__section-dot is-read" aria-hidden="true" />
                  <span>
                    {visibleUnread.length > 0
                      ? `Lidas anteriormente (${visibleRead.length})`
                      : `Todas lidas (${visibleRead.length})`}
                  </span>
                </div>
                <ul className="notification-popover__list">
                  {visibleRead.map(renderNotificationEntry)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="notification-popover__footer">
        <span>
          {unreadCount > 0
            ? `${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"} de ${sorted.length}`
            : `${sorted.length} ${sorted.length === 1 ? "notificação" : "notificações"}`}
        </span>
        <button type="button" className="notification-popover__close-btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
