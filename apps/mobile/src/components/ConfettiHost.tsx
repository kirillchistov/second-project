import { subscribeConfetti, type ConfettiKind } from '@/lib/confetti';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * Конфетти поверх всего приложения. Вызывается откуда угодно через `@/lib/confetti`: `burst()` — хлопок за верный ответ,
 * `celebrate()` — салют за идеальный коммит. Частицы летят по параболе; траектория задаётся
 * точками интерполяции, поэтому вся анимация идёт на нативном драйвере и не грузит JS-поток.
 * При включённом «Уменьшении движения» ничего не показываем.
 */


const COLORS = ['#0B7FA8', '#4FC1E0', '#1A7F37', '#5CD394', '#F1B54A', '#B39BFF', '#EF7D63'];
const GOLD = ['#F1B54A', '#FFD76A', '#FFF1B8', '#E9A23B'];
/** Ускорение свободного падения в pt/с² и число точек интерполяции параболы */
const G = 1400;
const SAMPLES = 10;

interface Particle {
  key: number;
  progress: Animated.Value;
  xs: number[];
  ys: number[];
  spin: number;
  size: number;
  color: string;
  round: boolean;
  duration: number;
}

let nextKey = 0;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeParticles(opts: {
  x: number;
  y: number;
  count: number;
  angle: number;
  spread: number;
  speed: [number, number];
  duration: [number, number];
  colors?: string[];
  gravity?: number;
}): Particle[] {
  return Array.from({ length: opts.count }, () => {
    const a = ((opts.angle + rand(-opts.spread / 2, opts.spread / 2)) * Math.PI) / 180;
    const v = rand(...opts.speed);
    const vx = Math.cos(a) * v;
    const vy = -Math.sin(a) * v;
    const duration = rand(...opts.duration);
    const g = opts.gravity ?? G;
    // Сопротивление воздуха грубо: горизонтальная скорость затухает к концу полёта
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * (duration / 1000);
      xs.push(opts.x + vx * t * (1 - (0.45 * i) / SAMPLES) + Math.sin(i * 1.3) * 8);
      ys.push(opts.y + vy * t + (g * t * t) / 2);
    }
    const colors = opts.colors ?? COLORS;
    return {
      key: nextKey++,
      progress: new Animated.Value(0),
      xs,
      ys,
      spin: rand(-3, 3),
      size: rand(6, 11),
      color: colors[Math.floor(Math.random() * colors.length)],
      round: Math.random() < 0.3,
      duration,
    };
  });
}

export function ConfettiHost() {
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const launch = (batch: Particle[]) => {
      setParticles((list) => [...list, ...batch]);
      for (const p of batch) {
        Animated.timing(p.progress, { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: true }).start(() =>
          setParticles((list) => list.filter((q) => q.key !== p.key)),
        );
      }
    };

    const listener = (kind: ConfettiKind) => {
      if (kind === 'burst') {
        launch(makeParticles({ x: width / 2, y: height * 0.62, count: 52, angle: 90, spread: 75, speed: [560, 960], duration: [1000, 1500] }));
        return;
      }
      const volley = () => {
        launch(makeParticles({ x: 0, y: height, count: 45, angle: 65, spread: 30, speed: [1100, 1600], duration: [1800, 2600] }));
        launch(makeParticles({ x: width, y: height, count: 45, angle: 115, spread: 30, speed: [1100, 1600], duration: [1800, 2600] }));
      };
      volley();
      timers.push(
        setTimeout(
          () => launch(makeParticles({ x: width / 2, y: height * 0.35, count: 40, angle: 90, spread: 360, speed: [200, 600], duration: [1400, 2000], colors: GOLD, gravity: 700 })),
          250,
        ),
      );
      timers.push(setTimeout(volley, 650));
      for (let i = 0; i < 4; i++) {
        timers.push(
          setTimeout(
            () => launch(makeParticles({ x: rand(0, width), y: -20, count: 14, angle: 270, spread: 50, speed: [40, 160], duration: [2200, 3000], gravity: 260 })),
            900 + i * 250,
          ),
        );
      }
    };

    const unsubscribe = subscribeConfetti(listener);
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [width, height, reduceMotion]);

  if (particles.length === 0) return null;
  const input = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: p.size,
            height: p.round ? p.size : p.size * 0.55,
            borderRadius: p.round ? p.size / 2 : 1.5,
            backgroundColor: p.color,
            opacity: p.progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.progress.interpolate({ inputRange: input, outputRange: p.xs }) },
              { translateY: p.progress.interpolate({ inputRange: input, outputRange: p.ys }) },
              { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0rad', `${p.spin * 6}rad`] }) },
              // «Переворот» бумажки в воздухе
              { scaleY: p.progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.2, 1] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
