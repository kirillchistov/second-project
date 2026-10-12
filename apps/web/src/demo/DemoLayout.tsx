import { Link, Outlet } from 'react-router';
import { Logo } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';

export function DemoLayout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand" aria-label="React Refresher — на путь">
            <Logo />
            <span className="brand__name">React Refresher</span>
            <span className="brand__version">демо</span>
          </Link>
          <div className="topbar__actions demo-topbar__actions">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="main">
        <div className="container container--narrow page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
