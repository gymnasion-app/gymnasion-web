import { useAccountSettings } from "../../features/settings/useAccountSettings";
import { useEffect, useRef, useState } from "react";
import Avatar from "../Avatar/Avatar";
import NotificationPopover from "../NotificationPopover/NotificationPopover";
import type { PersonalNotification } from "../../types/personalDashboard";
import "./AppTopbar.css";

type Props = {
  title: string;
  subtitle?: string;
  userName: string;
  userInitials?: string;
  avatar?: string;
  avatarTone?: "primary" | "info";
  searchLabel?: string;
  notificationCount?: number;
  notificationDot?: boolean;
  onSearch: (query: string) => void;
  onNotifications?: () => void;
  notifications?: {
    data: PersonalNotification[];
    loading?: boolean;
    error?: string;
  };
  onReadNotification?: (id?: string) => Promise<boolean | void> | void;
  notificationBusy?: boolean;
  onRefreshNotifications?: () => void;
  menuOpen?: boolean;
  sidebarId?: string;
  onToggleMenu?: () => void;
};

export default function AppTopbar({
  title,
  subtitle,
  userName,
  userInitials,
  avatar,
  avatarTone = "primary",
  searchLabel = "Buscar alunos e turmas",
  notificationCount,
  notificationDot,
  onSearch,
  onNotifications,
  notifications,
  onReadNotification,
  notificationBusy,
  onRefreshNotifications,
  menuOpen = false,
  sidebarId,
  onToggleMenu,
}: Props) {
  const { settings } = useAccountSettings();
  const searchRef = useRef<HTMLInputElement>(null);
  const notificationBtnRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const closePopover = () => {
    if (isClosing || !popoverOpen) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setPopoverOpen(false);
      setIsClosing(false);
    }, 150);
  };

  const handleNotificationsClick = () => {
    if (onNotifications && !notifications) {
      onNotifications();
      return;
    }
    if (popoverOpen) {
      closePopover();
    } else {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      setIsClosing(false);
      setPopoverOpen(true);
    }
  };

  return (
    <header className="ds-topbar">
      <div className="ds-topbar__titles">
        {onToggleMenu && (
          <button
            type="button"
            className="ds-topbar__menu-btn"
            aria-label={menuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={menuOpen}
            aria-controls={sidebarId}
            onClick={onToggleMenu}
          >
            {menuOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="15" y2="18" />
              </svg>
            )}
          </button>
        )}
        <div className="ds-topbar__titles-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="ds-topbar__actions">
        <search className="ds-topbar__search-container">
          <form
            className="ds-topbar__search"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch(query.trim());
            }}
          >
            <img src="/design-system/imgIconSearch.svg" alt="" />
            <input
              ref={searchRef}
              type="search"
              aria-label={searchLabel}
              placeholder={`${searchLabel}…`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <kbd title="Control ou Command + K">⌘K</kbd>
          </form>
        </search>

        <div className="ds-topbar__user-controls">
          <div className="ds-topbar__notification-wrapper">
            <button
              ref={notificationBtnRef}
              type="button"
              className="ds-topbar__notifications"
              aria-label={
                settings.showNotificationBadge && notificationCount
                  ? `Abrir notificações: ${notificationCount} não lidas`
                  : "Abrir notificações"
              }
              aria-expanded={popoverOpen && !isClosing}
              aria-haspopup="dialog"
              onClick={handleNotificationsClick}
            >
              <img src="/design-system/imgBellQuiet.svg" alt="" />
              {settings.showNotificationBadge &&
                (notificationDot ? (
                  <span className="ds-topbar__notification-dot" />
                ) : (
                  Boolean(notificationCount) && (
                    <span className="ds-topbar__notification-count">
                      {notificationCount}
                    </span>
                  )
                ))}
            </button>

            {popoverOpen && (
              <NotificationPopover
                triggerRef={notificationBtnRef}
                isClosing={isClosing}
                notifications={notifications?.data || []}
                loading={notifications?.loading}
                error={notifications?.error}
                busy={notificationBusy}
                onClose={closePopover}
                onRead={onReadNotification || (() => {})}
                onRetry={onRefreshNotifications}
              />
            )}
          </div>

          <Avatar
            name={userName}
            initials={userInitials}
            src={settings.photo || avatar}
            tone={avatarTone}
          />
        </div>
      </div>
    </header>
  );
}
