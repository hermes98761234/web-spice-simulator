import type { Lang } from './lib/storage'

export type T = (s: string, ...args: (string | number)[]) => string

/** Marks a string for translation where it is defined away from its t() call. */
export const N = (s: string) => s

/** English source string → Ukrainian. `{0}`, `{1}` are placeholders for interpolated values. */
export const UK: Record<string, string> = {
  'Web SPICE Simulator': 'Веб-симулятор SPICE',
  'ngspice in your browser: edit a netlist, run it, plot the results.': 'ngspice у браузері: редагуйте схему, запускайте, дивіться графіки.',
  'Runs entirely in your browser (ngspice compiled to WebAssembly). Nothing is uploaded.':
    'Працює повністю у браузері (ngspice, скомпільований у WebAssembly). Нічого не завантажується на сервер.',
  'Source on GitHub': 'Код на GitHub',
  Theme: 'Тема',
  System: 'Системна',
  Light: 'Світла',
  Dark: 'Темна',
  Language: 'Мова',
  Example: 'Приклад',
  'Custom netlist': 'Власна схема',
  Netlist: 'Список з’єднань (netlist)',
  Run: 'Запустити',
  'Running…': 'Виконується…',
  Stop: 'Зупинити',
  'Open .cir': 'Відкрити .cir',
  'Save .cir': 'Зберегти .cir',
  '{0} elements, {1} nodes': 'елементів: {0}, вузлів: {1}',
  'Autosaved in this browser.': 'Автозбереження в цьому браузері.',
  'Loading the simulation engine…': 'Завантаження рушія симуляції…',
  'Stopped.': 'Зупинено.',
  'Simulation failed': 'Помилка симуляції',
  'Done: {0}, {1} points, {2} ms': 'Готово: {0}, точок: {1}, {2} мс',
  'Simulation log': 'Журнал симуляції',
  'No output yet.': 'Виводу ще немає.',
  'Operating point': 'Робоча точка',
  Magnitude: 'Амплітуда',
  Waveforms: 'Осцилограми',
  Phase: 'Фаза',
  'Log frequency': 'Логарифмічна частота',
  'Unwrap phase': 'Розгорнути фазу',
  'Clear cursors': 'Прибрати курсори',
  'Select at least one vector to plot.': 'Виберіть хоча б один вектор для графіка.',
  'Frequency (Hz)': 'Частота (Гц)',
  'Magnitude (dB)': 'Амплітуда (дБ)',
  'Phase (°)': 'Фаза (°)',
  'Hover for values, click to place cursors A and B, drag to zoom, double-click to reset.':
    'Наведіть для значень, клікніть, щоб поставити курсори A і B, потягніть для масштабу, подвійний клік — скинути.',
  'First trace: peak {0}, −3 dB point at {1}': 'Перший графік: пік {0}, точка −3 дБ на {1}',
  Vectors: 'Вектори',
  Cursors: 'Курсори',
  'The netlist has no circuit elements.': 'У схемі немає елементів.',
  'No ground node 0 found.': 'Не знайдено вузла землі 0.',
  'No analysis command (.op, .dc, .ac, .tran) found.': 'Не знайдено команди аналізу (.op, .dc, .ac, .tran).',
  'Several analyses found; only the last one is plotted.': 'Знайдено кілька аналізів; показано лише останній.',
  'RC low-pass filter (.ac)': 'RC-фільтр низьких частот (.ac)',
  'Series RLC step response (.tran)': 'Перехідна характеристика послідовного RLC (.tran)',
  'Diode rectifier with filter (.tran)': 'Діодний випрямляч із фільтром (.tran)',
  'BJT common-emitter amplifier (.ac)': 'Підсилювач зі спільним емітером на BJT (.ac)',
  'MOSFET inverter transfer curve (.dc)': 'Передавальна характеристика інвертора на MOSFET (.dc)',
  'Voltage divider (.op)': 'Дільник напруги (.op)',
  'Transistor astable multivibrator (.tran)': 'Транзисторний мультивібратор (.tran)',
}

export function tr(lang: Lang, s: string, ...args: (string | number)[]): string {
  const src = lang === 'uk' ? (UK[s] ?? s) : s
  return src.replace(/\{(\d+)\}/g, (_, i: string) => String(args[+i]))
}
