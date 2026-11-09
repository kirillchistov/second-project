# Как создать первый стор на Zustand и обновлять список в нём?
@slug zustand-first-store
@topic state
@verified react@19.3
@updated 2026-11

> `create()` принимает функцию, которая получает `set` (и `get`) и возвращает объект — это и есть стор: данные вперемешку с действиями, которые их меняют. Сам стор — обычный хук: `useCartStore()` без аргументов отдаёт весь объект целиком, а с селектором — только нужный срез, подписывая компонент лишь на его изменения.

```tsx
import { create } from 'zustand';

interface CartStore {
  items: { id: string; title: string; qty: number }[];
  addItem: (item: { id: string; title: string }) => void;
  removeItem: (id: string) => void;
}

const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, { ...item, qty: 1 }] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}));

function CartBadge() {
  const count = useCartStore((state) => state.items.length); // подписка только на длину списка
  return <span>{count}</span>;
}

function AddToCartButton({ item }: { item: { id: string; title: string } }) {
  const addItem = useCartStore((state) => state.addItem); // действия стабильны, не меняются между рендерами
  return <button onClick={() => addItem(item)}>В корзину</button>;
}
```

`set` принимает либо объект (поверхностно сливается с текущим состоянием — как `setState` классов), либо функцию от текущего состояния, как во `addItem` выше — функциональная форма нужна, когда новое значение зависит от старого, иначе можно поймать то же устаревшее значение, что и с `setState` в React. В отличие от Redux, здесь не нужен `Provider`: стор живёт вне дерева компонентов, в обычной переменной модуля, и доступен из любого места, которое его импортировало.

### Подводные камни
- Мутировать массив `items` напрямую (`state.items.push(...)`) вместо `set` с новым массивом — Zustand сравнивает состояние по ссылке, мутация без `set` не вызовет перерисовку.
- Брать из стора весь объект (`const { items, addItem } = useCartStore()`) вместо отдельных селекторов — компонент перерисовывается при изменении любого поля стора, даже не используемого им.
- Забыть типизировать стор через `create<CartStore>()` — без явного типа TypeScript выведет его из первого вызова `set` и может ошибиться с типом полей.

### Что спросят дальше
- Чем `set((state) => ...)` отличается от `set({ ...прямой объект... })` и когда каждый вариант безопасен?
- Как Zustand вызывает повторный рендер — на чём основано сравнение `items.length` между рендерами?

### Ссылки
- [Zustand — Getting Started](https://zustand.docs.pmnd.rs/getting-started/introduction)
- [Zustand — Updating state](https://zustand.docs.pmnd.rs/guides/updating-state)

# Чем отличается production-сборка от development и что при этом реально меняется?
@slug production-vs-development-build
@topic ecosystem
@verified react@19.3
@updated 2026-11

> В режиме разработки (`npm run dev`) бандлер отдаёт код быстро и без минификации, сохраняет компонентные имена и строки для понятных сообщений об ошибках, включает React DevTools хуки и дополнительные предупреждения (`console.warn` о депрекейтах, двойные вызовы в Strict Mode). Production-сборка (`npm run build`) минифицирует и удаляет мёртвый код (tree-shaking), выбрасывает `process.env.NODE_ENV === 'development'`-ветки целиком (включая сами предупреждения React, которых в production-бандле физически нет), и обычно генерирует отдельные source map-файлы вместо встроенных.

```tsx
if (process.env.NODE_ENV !== 'production') {
  console.warn('Этот компонент скоро устареет, используйте <NewButton>');
}
```

Бандлер статически видит условие на `NODE_ENV` и в production-сборке вырезает весь `if`-блок как недостижимый код — отсюда и экономия размера: сам React в dev-сборке весит значительно больше, чем в production, именно за счёт таких проверок и расширенных сообщений об ошибках. Важно не путать `NODE_ENV` с произвольными флагами окружения (`VITE_API_URL` и подобные) — первый управляет поведением самого фреймворка и бандлера, вторые — это обычные переменные конфигурации приложения, подставляемые на этапе сборки.

### Подводные камни
- Тестировать производительность или размер бандла в dev-режиме — результаты не отражают то, что реально получит пользователь.
- Оставлять в коде тяжёлые debug-утилиты без обёртки в проверку `NODE_ENV` — они попадают в production-бандл и работают (и весят) там, где не нужны.
- Путать `NODE_ENV=production` с источником секретов — он только переключает режим сборки, ключи API в бандл всё равно попадать не должны ни в одном режиме.

### Что спросят дальше
- Как убедиться, что в production-сборке действительно используется production-версия React, а не dev по ошибке?
- Зачем source map генерируют отдельно для production и как их не выкладывать публично вместе с бандлом?

### Ссылки
- [Vite — Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [React — Error Decoder и production vs development React](https://react.dev/errors)
