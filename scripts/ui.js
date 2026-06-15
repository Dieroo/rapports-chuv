// Helpers DOM, formatage, presse-papier — utilisés par les écrans.

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// HH:MM (format courant : 23h05). On utilise "h" comme séparateur.
export function formatHeure(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}h${m}`;
}

// HH:MM pour input type="time"
export function formatHeureInput(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Durée entre 2 dates en "1h10", "45 min", "1 j 02h" (au-delà de 24h)
export function formatDuree(debut, fin) {
  if (!debut || !fin) return '';
  const d1 = typeof debut === 'string' ? new Date(debut) : debut;
  const d2 = typeof fin === 'string' ? new Date(fin) : fin;
  let totalMin = Math.round((d2 - d1) / 60000);
  if (totalMin < 0) return '— (fin avant début)';
  if (totalMin === 0) return '< 1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const jours = Math.floor(totalMin / (24 * 60));
  const heures = Math.floor((totalMin - jours * 24 * 60) / 60);
  const minutes = totalMin - jours * 24 * 60 - heures * 60;
  if (jours > 0) {
    return `${jours} j ${String(heures).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;
  }
  return `${heures}h${String(minutes).padStart(2, '0')}`;
}

// Date "lundi 31 mai 2026"
export function formatDateLongue(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Date "31/05/2026"
export function formatDateCourte(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR');
}

// "Aujourd'hui" / "Hier" / "lundi 31 mai" pour les groupes de la liste
export function formatDateRelative(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const sansHeure = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const jours = Math.floor((sansHeure(now) - sansHeure(d)) / (24 * 60 * 60 * 1000));
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  if (jours < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  return formatDateCourte(d);
}

// Copie texte dans le presse-papier + feedback visuel sur le bouton source.
export async function copierDansPressePapier(texte, boutonSource = null) {
  if (!texte) return false;
  try {
    await navigator.clipboard.writeText(texte);
    if (boutonSource) showCopyFeedback(boutonSource);
    return true;
  } catch (err) {
    // Fallback ancien navigateurs
    try {
      const ta = document.createElement('textarea');
      ta.value = texte;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (boutonSource) showCopyFeedback(boutonSource);
      return true;
    } catch (e) {
      console.error('[Copie] Échec:', e);
      return false;
    }
  }
}

function showCopyFeedback(btn) {
  const original = btn.textContent;
  const wasCopied = btn.classList.contains('copie-ok');
  if (wasCopied) return;
  btn.classList.add('copie-ok');
  const previous = btn.dataset.labelOriginal || original;
  btn.dataset.labelOriginal = previous;
  btn.textContent = '✓ Copié';
  setTimeout(() => {
    btn.classList.remove('copie-ok');
    btn.textContent = btn.dataset.labelOriginal || previous;
  }, 1200);
}

// Vide un container et insère du HTML (fait via innerHTML — utilisateur unique de confiance).
export function rendu(container, html) {
  container.innerHTML = html;
}

// Crée un élément avec attributs et enfants en une ligne (pour les cas où innerHTML est dangereux).
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v === false || v == null) {}
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Confirme avec window.confirm (suffisant pour la V1).
export function confirmer(message) {
  return window.confirm(message);
}

// Prompt avec window.prompt + valeur par défaut.
export function demander(message, defaut = '') {
  const reponse = window.prompt(message, defaut);
  return reponse == null ? null : reponse.trim();
}
