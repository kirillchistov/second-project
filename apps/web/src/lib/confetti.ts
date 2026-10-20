/**
 * Конфетти без зависимостей: один canvas поверх страницы, частицы с гравитацией и сопротивлением воздуха.
 * `burst` — короткий хлопок за верный ответ, `celebrate` — салют за идеальный коммит.
 * При `prefers-reduced-motion` ничего не рисуем.
 */

type Shape = 'rect' | 'circle' | 'ribbon' | 'star';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
  shape: Shape;
  life: number;
  ttl: number;
  wobble: number;
}

const COLORS = ['#0b7fa8', '#4fc1e0', '#23855a', '#5cd394', '#f1b54a', '#b39bff', '#ef7d63'];
const GOLD = ['#f1b54a', '#ffd76a', '#fff1b8', '#e9a23b'];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frame = 0;
let last = 0;

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (ctx && canvas?.isConnected) return ctx;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'confetti-canvas';
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function spawn(opts: {
  x: number;
  y: number;
  count: number;
  angle: number;
  spread: number;
  speed: [number, number];
  colors?: string[];
  shapes?: Shape[];
  ttl?: [number, number];
  size?: [number, number];
}) {
  const colors = opts.colors ?? COLORS;
  const shapes = opts.shapes ?? ['rect', 'rect', 'circle', 'ribbon'];
  for (let i = 0; i < opts.count; i++) {
    const angle = ((opts.angle + random(-opts.spread / 2, opts.spread / 2)) * Math.PI) / 180;
    const speed = random(...opts.speed);
    particles.push({
      x: opts.x,
      y: opts.y,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      rotation: random(0, Math.PI * 2),
      spin: random(-12, 12),
      size: random(...(opts.size ?? [6, 11])),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      life: 0,
      ttl: random(...(opts.ttl ?? [1.4, 2.4])),
      wobble: random(0, Math.PI * 2),
    });
  }
  if (!frame) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
}

function drawStar(c: CanvasRenderingContext2D, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    c.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  c.closePath();
  c.fill();
}

function tick(now: number) {
  const c = ctx;
  if (!c || !canvas) return;
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  c.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles = particles.filter((p) => p.life < p.ttl && p.y < window.innerHeight + 40);
  for (const p of particles) {
    p.life += dt;
    p.vy += 900 * dt; // гравитация, px/с²
    p.vx *= 1 - 1.6 * dt; // сопротивление воздуха
    p.vy *= 1 - 1.2 * dt;
    p.wobble += dt * 8;
    p.x += (p.vx + Math.sin(p.wobble) * 30) * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;

    c.save();
    c.globalAlpha = Math.min(1, (p.ttl - p.life) / 0.4);
    c.translate(p.x, p.y);
    c.rotate(p.rotation);
    c.fillStyle = p.color;
    if (p.shape === 'circle') {
      c.beginPath();
      c.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
      c.fill();
    } else if (p.shape === 'ribbon') {
      // Лента «переворачивается»: ширина меняется по синусу
      c.fillRect(-p.size / 2, (-p.size / 5) * Math.abs(Math.cos(p.wobble)), p.size, (p.size / 2.5) * Math.abs(Math.cos(p.wobble)) + 1);
    } else if (p.shape === 'star') {
      drawStar(c, p.size / 1.6);
    } else {
      c.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size / 1.5) * Math.abs(Math.sin(p.wobble)) + 1);
    }
    c.restore();
  }

  if (particles.length) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

/** Небольшой хлопок: верный ответ. Точка — центр элемента или низ экрана. */
export function burst(from?: Element | null) {
  if (reducedMotion() || !ensureCanvas()) return;
  const rect = from?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  // Длинный урок прокручен: точку вылета держим в видимой части экрана
  const h = window.innerHeight;
  const y = rect ? Math.min(Math.max(rect.top + rect.height / 3, h * 0.25), h * 0.7) : h * 0.7;
  spawn({ x, y, count: 46, angle: 90, spread: 70, speed: [420, 760], ttl: [1, 1.7] });
}

/**
 * Салют за идеальный коммит: залпы из обоих нижних углов, золотые звёзды из центра
 * и «дождь» сверху в течение пары секунд.
 */
export function celebrate() {
  if (reducedMotion() || !ensureCanvas()) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const volley = () => {
    spawn({ x: 0, y: h, count: 70, angle: 62, spread: 30, speed: [900, 1350], ttl: [2, 3] });
    spawn({ x: w, y: h, count: 70, angle: 118, spread: 30, speed: [900, 1350], ttl: [2, 3] });
  };
  volley();
  setTimeout(() => spawn({ x: w / 2, y: h * 0.35, count: 60, angle: 90, spread: 360, speed: [250, 650], colors: GOLD, shapes: ['star', 'star', 'circle'], size: [8, 14], ttl: [1.6, 2.4] }), 250);
  setTimeout(volley, 650);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => spawn({ x: random(0, w), y: -10, count: 18, angle: 270, spread: 40, speed: [60, 180], ttl: [2.6, 3.4] }), 900 + i * 220);
  }
}
