// Gestion des thèmes — clair / auto / sombre
// L'application initiale (anti-FOUC) est faite par un petit script inline
// dans index.html, AVANT le chargement du CSS. Ce module gère ensuite les
// interactions utilisateur et la synchronisation de la barre statut Android.

const STORAGE_KEY = 'rapports-chuv-theme';
const THEMES = ['clair', 'auto', 'sombre'];

// Couleurs utilisées pour la barre statut Android (meta theme-color).
// Doivent rester alignées avec --fond du CSS.
const META_COLORS = {
  clair: '#F6F8FA',
  sombre: '#14181D'
};

/** Détermine la couleur effective de la barre statut selon le thème. */
function resolveMetaColor(theme) {
  if (theme === 'clair' || theme === 'sombre') {
    return META_COLORS[theme];
  }
  // auto → suit le système
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark ? META_COLORS.sombre : META_COLORS.clair;
}

/** Applique un thème : attribut HTML, localStorage, meta theme-color, aria. */
export function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'auto';

  document.documentElement.setAttribute('data-theme', theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (err) {
    // localStorage peut être indisponible (mode privé) — pas bloquant
    console.warn('[Theme] localStorage indisponible:', err);
  }

  // Met à jour la barre statut Android
  const metaTag = document.querySelector('meta[name="theme-color"]');
  if (metaTag) {
    metaTag.setAttribute('content', resolveMetaColor(theme));
  }

  // Met à jour aria-pressed sur les boutons du sélecteur (s'il existe)
  document.querySelectorAll('[data-theme-set]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.themeSet === theme ? 'true' : 'false');
  });
}

/** Initialise le sélecteur de thème — à appeler APRÈS que le DOM est construit. */
export function initThemeSelector() {
  // Récupère le thème déjà appliqué par le script anti-FOUC
  const themeActuel = document.documentElement.getAttribute('data-theme') || 'auto';

  // Synchronise l'état visuel des boutons + meta-color avec le thème courant
  applyTheme(themeActuel);

  // Bind clicks
  document.querySelectorAll('[data-theme-set]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeSet));
  });

  // En mode "auto", si le système change de thème, on met à jour la meta-color
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'auto') applyTheme('auto');
  });
}
