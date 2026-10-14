import { useState } from 'react';
import { applyTheme, readTheme, rememberTheme, themes } from '../data/theme';

export function ThemePicker() {
  const [theme, setTheme] = useState(readTheme);

  return (
    <div className="theme-picker">
      <label htmlFor="colour-theme">Colour theme</label>
      <div className="theme-select-wrap select-wrap">
        <span className="theme-swatch" aria-hidden="true" />
        <select id="colour-theme" value={theme} onChange={(event) => {
          const next = themes.find((item) => item.id === event.target.value)?.id ?? 'midnight';
          setTheme(next);
          applyTheme(next);
          rememberTheme(next);
        }}>
          {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
    </div>
  );
}
