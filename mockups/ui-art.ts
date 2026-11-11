/* Throwaway mockups: UI elements painted as pixel art at the Battle scene's density, from the scene's own ramps. */
import '@fontsource/grenze-gotisch/600.css';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/700.css';
import '../src/ui/style.css';
import './ui-art.css';
import { nextFrame, paint, setAct, type ActKey } from './painters';

const elements = [...document.querySelectorAll<HTMLElement>('[data-art]')];
const observer = new ResizeObserver((entries) => entries.forEach((entry) => paint(entry.target as HTMLElement)));
elements.forEach((el) => observer.observe(el));

setInterval(() => {
  nextFrame();
  document.querySelectorAll<HTMLElement>('[data-art="nameplate"]').forEach(paint);
}, 260);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-scale]')) {
  button.addEventListener('click', () => {
    document.documentElement.style.setProperty('--art', `${button.dataset.scale}px`);
    elements.forEach(paint);
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-act-preview]')) {
  button.addEventListener('click', () => {
    const act = button.dataset.actPreview as ActKey;
    setAct(act);
    document.querySelectorAll('[data-run]').forEach((el) => el.setAttribute('data-act', act === 'town' ? '' : act));
    document.querySelectorAll('[data-act-preview]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    elements.forEach(paint);
  });
}

const TYPE_LEGENDS: Record<string, string> = {
  current: 'In the game now: Letterpress civic, from style.css.',
  letterpress: 'Signs and titles: Grenze Gotisch · Brass plates: Cinzel · Forms and tickets: IM Fell English · UI text: Alegreya · Pencil: Cedarville Cursive',
  pixel: 'Signs: Jacquard 24 · Titles: Jacquarda Bastarda 9 · Brass plates: Silkscreen · Forms and tickets: IM Fell English · UI text: Alegreya · Pencil: Cedarville Cursive',
  fraktur: 'Signs and titles: UnifrakturCook · Brass plates: IM Fell English SC · Forms and tickets: IM Fell English · UI text: EB Garamond · Pencil: Homemade Apple',
};
const legend = document.querySelector('#type-legend');
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-type]')) {
  button.addEventListener('click', () => {
    const type = button.dataset.type ?? 'current';
    if (type === 'current') delete document.documentElement.dataset.type;
    else document.documentElement.dataset.type = type;
    document.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (legend) legend.textContent = TYPE_LEGENDS[type] ?? '';
  });
}
if (legend) legend.textContent = TYPE_LEGENDS.current!;
