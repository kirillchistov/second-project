import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { loadSession } from '../lib/account';
import { onOpenSearch } from '../lib/search';
import { useAccount } from '../lib/session';
import { IconClose, IconMenu, IconSearch, Logo } from './Icons';
import { SearchDialog } from './SearchDialog';
import { ThemeToggle } from './ThemeToggle';

function AccountLink() {
  const account = useAccount();
  if (account.status === 'loading') return null;
  return (
    <NavLink to="/account" className="icon-btn account-btn" aria-label={account.status === 'signed-in' ? account.user.nickname : 'Войти'}>
      {account.status === 'signed-in' ? account.user.nickname.slice(0, 1).toUpperCase() : <IconAccount />}
    </NavLink>
  );
}

function IconAccount() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

const NAV = [
  { to: '/questions', label: 'Вопросы' },
  { to: '/practice', label: 'Тренировка' },
  { to: '/interview', label: 'Собеседование' },
  { to: '/about', label: 'О проекте' },
];

export function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    const offOpen = onOpenSearch(() => setSearchOpen(true));
    return () => {
      window.removeEventListener('keydown', onKey);
      offOpen();
    };
  }, []);

  useEffect(() => {
    void loadSession();
  }, []);

  // При переходе на другую страницу закрываем мобильное меню
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand" aria-label="React Refresher — на главную">
            <Logo />
            <span className="brand__name">React Refresher</span>
            <span className="brand__version">2026</span>
          </Link>

          <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
            <IconSearch />
            <span>Поиск</span>
            <kbd>⌘K</kbd>
          </button>

          <nav className={`topnav ${menuOpen ? 'is-open' : ''}`} aria-label="Основная навигация">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="topnav__link">
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar__actions">
            <button type="button" className="icon-btn search-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Поиск">
              <IconSearch />
            </button>
            <AccountLink />
            <ThemeToggle />
            <button
              type="button"
              className="icon-btn menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>React Refresher · 140 вопросов для собеседования по React</span>
          <span>
            Ответы опираются на <a href="https://react.dev" target="_blank" rel="noreferrer">react.dev</a>. Проект
            не связан с Meta и командой React.
          </span>
        </div>
      </footer>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ScrollRestoration />
    </div>
  );
}
