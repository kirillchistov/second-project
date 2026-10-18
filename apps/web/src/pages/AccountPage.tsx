import { useState } from 'react';
import { useNavigate } from 'react-router';
import { authErrorMessage, signIn, signOut, signUp } from '../lib/account';
import { useAccount } from '../lib/session';

type Mode = 'signin' | 'signup';

export function AccountPage() {
  const account = useAccount();

  return (
    <div className="container container--narrow page">
      <title>Аккаунт — React Refresher</title>
      {account.status === 'loading' && null}
      {account.status === 'guest' && <AuthForm />}
      {account.status === 'signed-in' && <Profile nickname={account.user.nickname} email={account.user.email} />}
    </div>
  );
}

function Profile({ nickname, email }: { nickname: string; email: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <header className="page-header">
        <h1>Аккаунт</h1>
      </header>
      <div className="callout">
        <p>
          <strong>{nickname}</strong>
        </p>
        <p className="muted">{email}</p>
      </div>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
          navigate('/');
        }}
      >
        Выйти
      </button>
    </>
  );
}

function AuthForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = email.includes('@') && password.length >= (mode === 'signup' ? 8 : 1) && (mode === 'signin' || nickname.trim().length >= 3);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUp({ email, password, nickname: nickname.trim() });
      else await signIn({ email, password });
      navigate('/');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>{mode === 'signin' ? 'Вход' : 'Новый аккаунт'}</h1>
        <p className="page-header__lead">
          Один аккаунт для сайта и мобильного приложения — войдите с любого устройства тем же email и паролем.
        </p>
      </header>

      <div className="auth-switch" role="tablist">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`auth-switch__item ${mode === m ? 'is-active' : ''}`}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
          >
            {m === 'signin' ? 'Войти' : 'Регистрация'}
          </button>
        ))}
      </div>

      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>

        {mode === 'signup' && (
          <label className="field">
            <span className="field__label">Ник — его увидят в лидерборде</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="username"
              placeholder="react_ninja"
              maxLength={24}
              required
            />
          </label>
        )}

        <label className="field">
          <span className="field__label">{mode === 'signup' ? 'Пароль — от 8 символов' : 'Пароль'}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {error && (
          <p role="alert" className="field__error">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={!ready || busy}>
          {busy ? 'Подождите…' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </form>
    </>
  );
}
