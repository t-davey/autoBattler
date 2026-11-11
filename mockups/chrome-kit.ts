import '@fontsource/grenze-gotisch/600.css';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/700.css';
import '../src/ui/style.css';
import './chrome-kit.css';

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-px]')) {
  button.addEventListener('click', () => document.documentElement.style.setProperty('--px', `${button.dataset.px}px`));
}
