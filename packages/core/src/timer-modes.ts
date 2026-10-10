export type TimerMode = 'off' | 'soft' | 'exam';

// Идея режимов времени взята из popmath: таймер — подсказка, а не приговор.
export const TIMER_MODE_OPTIONS: { id: TimerMode; label: string; hint: string; seconds: number }[] = [
  { id: 'off', label: 'Без таймера', hint: 'Сначала качество ответа, потом скорость', seconds: 0 },
  { id: 'soft', label: 'Мягкий · 2 мин', hint: 'Подсветим, когда время выйдет, но не остановим', seconds: 120 },
  { id: 'exam', label: 'Жёсткий · 1 мин', hint: 'Время вышло — ответ открывается автоматически', seconds: 60 },
];
