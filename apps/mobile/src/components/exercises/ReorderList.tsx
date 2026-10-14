import { useScrollLock } from '@/lib/scrollLock';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

/** Расстояние между строками — как gap у контейнера ответа */
const GAP = 6;

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Куда встанет элемент `from`, сдвинутый на dy: сколько соседей он «перешагнул» своей серединой. */
function targetIndex(heights: number[], from: number, dy: number): number {
  let to = from;
  let travelled = Math.abs(dy);
  const step = dy > 0 ? 1 : -1;
  for (let i = from + step; i >= 0 && i < heights.length && travelled > (heights[i] + GAP) / 2; i += step) {
    to = i;
    travelled -= heights[i] + GAP;
  }
  return to;
}

interface Sync {
  ids: number[];
  onChange: (ids: number[]) => void;
  lockScroll: (locked: boolean) => void;
  setLifted: (id: number | null) => void;
}

/**
 * Состояние жеста вне React: обработчики PanResponder создаются один раз на строку,
 * а актуальный порядок и колбэки контроллер получает после каждого рендера.
 */
class ReorderController {
  private sync: Sync = { ids: [], onChange: () => {}, lockScroll: () => {}, setLifted: () => {} };
  private heights = new Map<number, number>();
  private offsets = new Map<number, Animated.Value>();
  private drag: { id: number; from: number; to: number } | null = null;

  update(sync: Sync) {
    this.sync = sync;
  }

  register(id: number, offset: Animated.Value) {
    this.offsets.set(id, offset);
    // Высоту не стираем: при повторном запуске эффекта onLayout её заново не пришлёт
    return () => {
      if (this.offsets.get(id) === offset) this.offsets.delete(id);
    };
  }

  measure(id: number, height: number) {
    this.heights.set(id, height);
  }

  /**
   * После перестановки строки уже на новых местах — сдвиги обнуляются без анимации.
   * Анимации здесь на JS-драйвере: строк немного, а нативная пружина асинхронно возвращала своё значение
   * после обнуления, и строки залипали со сдвигом.
   */
  settle() {
    this.offsets.forEach((value) => {
      value.stopAnimation();
      value.setValue(0);
    });
  }

  start(id: number) {
    const from = this.sync.ids.indexOf(id);
    this.drag = { id, from, to: from };
    this.sync.lockScroll(true);
    this.sync.setLifted(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  move(dy: number) {
    const d = this.drag;
    if (!d) return;
    this.offsets.get(d.id)?.setValue(dy);
    const to = targetIndex(this.sync.ids.map((id) => this.heights.get(id) ?? 0), d.from, dy);
    if (to === d.to) return;
    d.to = to;
    Haptics.selectionAsync();
    // Соседи между старым и новым местом расступаются на высоту перетаскиваемой строки
    const size = (this.heights.get(d.id) ?? 0) + GAP;
    this.sync.ids.forEach((id, index) => {
      if (id === d.id) return;
      const shift = d.from < index && index <= to ? -size : to <= index && index < d.from ? size : 0;
      const value = this.offsets.get(id);
      if (value) Animated.spring(value, { toValue: shift, useNativeDriver: false, speed: 24, bounciness: 4 }).start();
    });
  }

  end() {
    const d = this.drag;
    this.drag = null;
    this.sync.setLifted(null);
    this.sync.lockScroll(false);
    if (!d) return;
    if (d.to !== d.from) {
      this.sync.onChange(move(this.sync.ids, d.from, d.to));
    } else {
      const value = this.offsets.get(d.id);
      if (value) Animated.spring(value, { toValue: 0, useNativeDriver: false }).start();
    }
  }
}

function ReorderRow({
  id,
  index,
  count,
  controller,
  lifted,
  disabled,
  label,
  onMove,
  children,
}: {
  id: number;
  index: number;
  count: number;
  controller: ReorderController;
  lifted: boolean;
  disabled?: boolean;
  label: string;
  onMove: (to: number) => void;
  children: ReactNode;
}) {
  const c = useColors();
  const [offset] = useState(() => new Animated.Value(0));
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Жест не отдаём ScrollView, пока палец не отпущен
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => controller.start(id),
      onPanResponderMove: (_, g) => controller.move(g.dy),
      onPanResponderRelease: () => controller.end(),
      onPanResponderTerminate: () => controller.end(),
    }),
  );
  useLayoutEffect(() => controller.register(id, offset), [controller, id, offset]);

  return (
    <Animated.View
      onLayout={(e) => controller.measure(id, e.nativeEvent.layout.height)}
      accessible={!disabled}
      accessibilityLabel={`${label}. Позиция ${index + 1} из ${count}`}
      accessibilityActions={
        disabled
          ? undefined
          : [
              { name: 'up', label: 'Переместить выше' },
              { name: 'down', label: 'Переместить ниже' },
            ]
      }
      onAccessibilityAction={(e) => onMove(index + (e.nativeEvent.actionName === 'up' ? -1 : 1))}
      // Сдвиг — на внешнем слое, «подъём» (масштаб и тень) — на внутреннем, чтобы они не делили один transform
      style={[styles.item, lifted && styles.above, { transform: [{ translateY: offset }] }]}
    >
      <View style={[styles.row, lifted && [styles.lifted, { shadowColor: c.accent }]]}>
        {!disabled && (
          <View {...pan.panHandlers} style={styles.handle} hitSlop={8}>
            <Ionicons name="reorder-three" size={24} color={lifted ? c.accent : c.textMuted} />
          </View>
        )}
        <View style={styles.body}>{children}</View>
      </View>
    </Animated.View>
  );
}

/**
 * Список с перетаскиванием за ручку: PanResponder и Animated из React Native, без нативных зависимостей.
 * Пока тащат строку, прокрутка экрана выключена, соседи расступаются пружиной, каждое новое место — лёгкая вибрация.
 * Для VoiceOver у строки есть действия «Переместить выше» и «Переместить ниже».
 */
export function ReorderList({
  ids,
  onChange,
  disabled,
  describe,
  renderItem,
}: {
  ids: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  describe: (id: number) => string;
  renderItem: (id: number, index: number) => ReactNode;
}) {
  const lockScroll = useScrollLock();
  const [controller] = useState(() => new ReorderController());
  const [lifted, setLifted] = useState<number | null>(null);

  useLayoutEffect(() => {
    controller.update({ ids, onChange, lockScroll, setLifted });
  }, [controller, ids, onChange, lockScroll]);
  useLayoutEffect(() => {
    controller.settle();
  }, [controller, ids]);

  return (
    <View style={styles.list}>
      {ids.map((id, index) => (
        <ReorderRow
          key={id}
          id={id}
          index={index}
          count={ids.length}
          controller={controller}
          lifted={lifted === id}
          disabled={disabled}
          label={describe(id)}
          onMove={(to) => {
            if (to >= 0 && to < ids.length) onChange(move(ids, index, to));
          }}
        >
          {renderItem(id, index)}
        </ReorderRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  item: {},
  above: { zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  lifted: { transform: [{ scale: 1.03 }], shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  handle: { width: 34, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
