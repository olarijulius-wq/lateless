export default function ThemeInitScript() {
  const script = `
    (function() {
      try {
        var key = 'lateless-theme';
        var stored = window.localStorage.getItem(key);
        var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
        var root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
      } catch (_) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
