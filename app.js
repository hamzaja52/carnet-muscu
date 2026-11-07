/* Carnet Muscu — logique de l'application (vanilla JS, sans dépendance).
   Données : IndexedDB « carnet-muscu » v1. Rendu : fonctions → template strings.
   Tout texte venant de l'utilisateur passe par esc(). */
'use strict';
(function () {
  // =====================================================================
  // 1. Constantes & utilitaires
  // =====================================================================
  const DB_NAME = 'carnet-muscu';
  const DB_VERSION = 1;
  const EXPORT_VERSION = 1;
  const DAY_MS = 86400000;
  const WEEK_MS = 7 * DAY_MS;
  const SNAPSHOT_KEEP = 8;
  const TABS = ['seance', 'historique', 'progres', 'reglages'];
  const DEFAULT_GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Autres'];
  const DEFAULT_SETTINGS = { weightStep: 2.5, theme: 'auto', restSeconds: 90, timerAuto: true };
  const STEPS = [0.5, 1, 2.5];
  const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  const THEME_BG = { dark: '#15171a', light: '#edeff1' };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  let uidCounter = 0;
  const uid = () => Date.now().toString(36) + (uidCounter++).toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const round2 = (n) => Math.round(n * 100) / 100;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, one, many) => `${fmtInt(n)} ${n > 1 ? many : one}`;

  const NF_KG = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  const NF_1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const NF_INT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmtKg = (v) => NF_KG.format(v);
  const fmt1 = (v) => NF_1.format(v);
  const fmtInt = (v) => NF_INT.format(v);
  /** Valeur pour un champ de saisie (virgule décimale, sans séparateur de milliers). */
  const inputNum = (v) => (v == null || !Number.isFinite(v) ? '' : String(round2(v)).replace('.', ','));
  /** Lit un nombre saisi au clavier : accepte « 12,5 », « 12.5 », espaces. */
  function parseNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v == null ? '' : v).trim().replace(/[\s  ]/g, '').replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const parseIntSafe = (v) => { const n = parseNum(v); return n == null ? null : Math.round(n); };

  /** Date LOCALE « YYYY-MM-DD » (jamais toISOString, qui est en UTC). */
  function localISO(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const todayISO = () => localISO(new Date());
  function parseISO(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  }
  const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s).getTime());

  const DF = {
    long: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    longY: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }),
    shortY: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }),
    stamp: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    stampShort: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  };
  const RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const thisYear = () => new Date().getFullYear();
  const fmtLong = (iso) => { const d = parseISO(iso); return (d.getFullYear() === thisYear() ? DF.long : DF.longY).format(d); };
  const fmtShort = (iso) => { const d = parseISO(iso); return (d.getFullYear() === thisYear() ? DF.short : DF.shortY).format(d); };
  const fmtMonth = (iso) => cap(DF.month.format(parseISO(iso)));
  const fmtStamp = (ms) => DF.stamp.format(new Date(ms));
  function fmtAgo(ms) {
    const a = new Date(ms); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    const days = Math.round((b - a) / DAY_MS);
    return days <= 0 ? 'aujourd’hui' : RTF.format(-days, 'day');
  }
  const fmtDur = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  function fmtDurLong(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    if (!m) return `${s} s`;
    return s ? `${m} min ${pad(s)}` : `${m} min`;
  }

  /** 1RM estimé (Epley) : kg × (1 + reps/30). */
  function epley(kg, reps) {
    if (reps == null || !(reps > 0) || !(kg > 0)) return null;
    return reps === 1 ? kg : kg * (1 + reps / 30);
  }
  const fmtSet = (s) => `${fmtKg(s.kg)} kg × ${s.reps == null ? '?' : s.reps}${s.extra ? ` +${s.extra}` : ''}`;
  const volumeOf = (sets) => sets.reduce((a, s) => a + (s.reps ? s.kg * s.reps : 0), 0);

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignoré */ }
  }

  const ICON = (() => {
    const svg = (d, extra) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${d}</svg>`;
    return {
      minus: svg('<path d="M5 12h14"/>'),
      plus: svg('<path d="M12 5v14M5 12h14"/>'),
      back: svg('<path d="M15 18l-6-6 6-6"/>'),
      close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
      check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
      edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
      trash: svg('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'),
      up: svg('<path d="M6 15l6-6 6 6"/>'),
      down: svg('<path d="M6 9l6 6 6-6"/>'),
      timer: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 2.5h5"/>'),
      list: svg('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
      camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
      image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>'),
      download: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
      upload: svg('<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>'),
      share: svg('<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v8h14v-8"/>'),
      table: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 15h17M10 4.5v15"/>'),
      chart: svg('<path d="M3.5 20.5h17M4 16l5-5 4 3 7-7"/>'),
      dumbbell: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
      calendar: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
      archive: svg('<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v10.5h14V9M10 13h4"/>'),
      restore: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4.5v4h4"/>'),
      search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
      paste: svg('<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 11h6M9 15h4"/>'),
    };
  })();

  // =====================================================================
  // 2. IndexedDB (petite couche à promesses)
  // =====================================================================
  let idb = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB indisponible sur ce navigateur.')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('machines')) db.createObjectStore('machines', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('sets')) {
          const s = db.createObjectStore('sets', { keyPath: 'id' });
          s.createIndex('machineId', 'machineId');
          s.createIndex('sessionId', 'sessionId');
          s.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('programs')) db.createObjectStore('programs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('snapshots')) {
          const s = db.createObjectStore('snapshots', { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); toast('Mise à jour : rechargez l’appli'); };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('Ouverture de la base impossible.'));
      req.onblocked = () => reject(new Error('Base bloquée par un autre onglet : fermez-le puis rechargez.'));
    });
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  function txDone(t) {
    return new Promise((res, rej) => {
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error || new Error('Erreur de base de données'));
      t.onabort = () => rej(t.error || new Error('Transaction annulée'));
    });
  }
  function dbGetAll(store) {
    return reqP(idb.transaction(store, 'readonly').objectStore(store).getAll());
  }
  function dbGet(store, key) {
    return reqP(idb.transaction(store, 'readonly').objectStore(store).get(key));
  }
  /** Écrit dans une transaction unique ; fn(st) reçoit st(nomStore) → objectStore. */
  function dbWrite(stores, fn) {
    const t = idb.transaction(stores, 'readwrite');
    const done = txDone(t);
    try { fn((name) => t.objectStore(name)); } catch (e) { try { t.abort(); } catch (_) { /* déjà fini */ } return Promise.reject(e); }
    return done;
  }

  // =====================================================================
  // 3. État en mémoire (miroir de la base, petit volume)
  // =====================================================================
  const S = { machines: new Map(), sessions: new Map(), sets: new Map(), programs: new Map(), meta: {} };

  async function loadAll() {
    const [machines, sessions, sets, programs, meta] = await Promise.all(
      ['machines', 'sessions', 'sets', 'programs', 'meta'].map(dbGetAll));
    S.machines = new Map(machines.map((x) => [x.id, x]));
    S.sessions = new Map(sessions.map((x) => [x.id, x]));
    S.sets = new Map(sets.map((x) => [x.id, x]));
    S.programs = new Map(programs.map((x) => [x.id, x]));
    S.meta = {};
    meta.forEach((m) => { S.meta[m.key] = m.value; });
  }
  async function setMeta(key, value) {
    await dbWrite(['meta'], (st) => st('meta').put({ key, value }));
    S.meta[key] = value;
  }
  const settings = () => Object.assign({}, DEFAULT_SETTINGS, S.meta.settings || {});
  async function saveSettings(patch) { await setMeta('settings', Object.assign(settings(), patch)); }

  // --- Requêtes en mémoire ---
  const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byCreated(a, b));
  const sessionsDesc = () => [...S.sessions.values()].sort((a, b) => -byDateAsc(a, b));
  const setsOfSession = (id) => [...S.sets.values()].filter((s) => s.sessionId === id).sort(byCreated);
  const setsOfMachine = (id) => [...S.sets.values()].filter((s) => s.machineId === id).sort(byDateAsc);
  const machineName = (id) => (S.machines.get(id) ? S.machines.get(id).name : 'Machine supprimée');
  function groupByMachine(sets) {
    const g = new Map();
    sets.forEach((s) => { if (!g.has(s.machineId)) g.set(s.machineId, []); g.get(s.machineId).push(s); });
    return g;
  }
  function groupList() {
    const base = (window.SEED && Array.isArray(window.SEED.groups) && window.SEED.groups.length) ? window.SEED.groups : DEFAULT_GROUPS;
    const g = new Set(base);
    S.machines.forEach((m) => { if (m.group) g.add(m.group); });
    return [...g];
  }
  /** Séance du jour créée par l'appli (jamais une séance importée). */
  function todaySession() {
    const d = todayISO();
    const list = [...S.sessions.values()].filter((s) => s.date === d && s.source !== 'import').sort(byCreated);
    return list.length ? list[list.length - 1] : null;
  }
  function todaySets() {
    const ts = todaySession();
    return ts ? setsOfSession(ts.id) : [];
  }
  /** Dernière utilisation de chaque machine : { date, createdAt }. */
  function lastUseMap() {
    const map = new Map();
    S.sets.forEach((s) => {
      const cur = map.get(s.machineId);
      if (!cur || byDateAsc(cur, s) < 0) map.set(s.machineId, { date: s.date, createdAt: s.createdAt, set: s });
    });
    return map;
  }
  /** Dernière séance (hors séance courante) où la machine a été utilisée. */
  function lastTime(machineId, excludeSessionId) {
    const sets = setsOfMachine(machineId).filter((s) => s.sessionId !== excludeSessionId);
    if (!sets.length) return null;
    let best = null, bestSess = null;
    sets.forEach((s) => {
      const sess = S.sessions.get(s.sessionId) || { date: s.date, createdAt: 0 };
      if (!bestSess || byDateAsc(bestSess, sess) < 0) { bestSess = sess; best = s; }
    });
    return { date: bestSess.date, sets: sets.filter((s) => s.sessionId === best.sessionId).sort(byCreated) };
  }
  function recordsOf(machineId) {
    const sets = setsOfMachine(machineId);
    if (!sets.length) return null;
    let maxSet = null, ormSet = null, orm = 0, bestSet = null, bestProd = 0;
    sets.forEach((s) => {
      if (!maxSet || s.kg > maxSet.kg || (s.kg === maxSet.kg && (s.reps || 0) > (maxSet.reps || 0))) maxSet = s;
      const e = epley(s.kg, s.reps);
      if (e != null && e > orm) { orm = e; ormSet = s; }
      const p = s.reps ? s.kg * s.reps : 0;
      if (p > bestProd) { bestProd = p; bestSet = s; }
    });
    const lastDate = sets[sets.length - 1].date;
    const lastSets = sets.filter((s) => s.date === lastDate);
    return { maxSet, orm: ormSet ? orm : null, ormSet, bestSet, lastDate, lastVolume: volumeOf(lastSets), count: sets.length };
  }

  // =====================================================================
  // 4. Import initial (SEED) — une seule fois, transaction unique
  // =====================================================================
  function importSeed(seed) {
    return new Promise((resolve, reject) => {
      const t = idb.transaction(['machines', 'programs', 'sessions', 'sets', 'meta'], 'readwrite');
      let imported = false;
      t.oncomplete = () => resolve(imported);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Import annulé'));
      const metaStore = t.objectStore('meta');
      const check = metaStore.get('seeded');
      check.onsuccess = () => {
        if (check.result && check.result.value) return; // déjà importé (autre onglet)
        imported = true;
        const nSets = (seed.sessions || []).reduce((a, s) => a + (s.sets || []).length, 0);
        let clock = Date.now() - 60000 - (nSets + 200); // createdAt croissants, tous dans le passé
        const next = () => clock++;
        const mStore = t.objectStore('machines');
        const known = new Set();
        (seed.machines || []).forEach((m) => {
          known.add(m.id);
          mStore.put({ id: m.id, name: m.name, group: m.group || 'Autres', type: m.type || '', photo: null, archived: false, createdAt: next() });
        });
        (seed.programs || []).forEach((p) => {
          t.objectStore('programs').put({ id: p.id || uid(), name: p.name, machineIds: (p.machineIds || []).filter((id) => known.has(id)) });
        });
        const sessStore = t.objectStore('sessions');
        const setStore = t.objectStore('sets');
        (seed.sessions || []).forEach((sess, i) => {
          const sid = `seed-s${i + 1}-${uid()}`;
          sessStore.put({ id: sid, date: sess.date, dateToVerify: !!sess.dateToVerify, programId: null, note: sess.note || '', source: 'import', createdAt: next() });
          (sess.sets || []).forEach((x) => {
            if (!known.has(x.m)) {
              known.add(x.m);
              mStore.put({ id: x.m, name: `Machine ${x.m}`, group: 'Autres', type: '', photo: null, archived: false, createdAt: next() });
            }
            setStore.put({
              id: uid(), sessionId: sid, machineId: x.m, date: sess.date,
              setNumber: Number(x.n) || 1, kg: Number(x.kg) || 0,
              reps: x.reps == null ? null : Number(x.reps),
              extra: Number(x.extra) || 0, drop: !!x.drop, note: x.note || '',
              createdAt: next(),
            });
          });
        });
        metaStore.put({ key: 'seeded', value: seed.version || 1 });
      };
    });
  }

  // =====================================================================
  // 5. Navigation : couches (modale, détail, onglet) liées à l'historique
  //    → le bouton retour Android ferme d'abord la couche du dessus.
  // =====================================================================
  const layers = [];
  let pendingBack = 0, ignorePop = 0, ignoreUntil = 0, flushQueued = false;

  function flushBack() {
    flushQueued = false;
    if (!pendingBack) return;
    const n = pendingBack;
    pendingBack = 0;
    ignorePop++;
    ignoreUntil = Date.now() + 1500;
    history.go(-n);
  }
  function pushLayer(layer, hash) {
    if (pendingBack > 0) {
      // Une couche vient d'être fermée (retour pas encore envoyé) : on RÉUTILISE son entrée
      // d'historique au lieu de faire history.go(-1) puis pushState (course : Chrome calcule la
      // cible du go() à l'appel, l'entrée poussée serait perdue et « retour » fermerait l'appli).
      pendingBack--;
      layers.push(layer);
      if (pendingBack > 0) flushBack();
      else if (!(ignorePop > 0 && Date.now() < ignoreUntil)) history.replaceState({ carnet: layers.length }, '', hash ? `#${hash}` : undefined);
      return;
    }
    layers.push(layer);
    history.pushState({ carnet: layers.length }, '', hash ? `#${hash}` : undefined);
  }
  function popLayers(n) {
    n = Math.min(n == null ? 1 : n, layers.length);
    for (let i = 0; i < n; i++) layers.pop().close();
    if (n > 0) {
      pendingBack += n;
      if (!flushQueued) { flushQueued = true; Promise.resolve().then(flushBack); }
    }
  }
  const popLayer = () => popLayers(1);
  function countTop(pred) {
    let n = 0;
    for (let i = layers.length - 1; i >= 0 && pred(layers[i]); i--) n++;
    return n;
  }
  function syncHash() {
    const want = `#${ui.tab}`;
    if (location.hash !== want) history.replaceState(history.state, '', want);
  }
  window.addEventListener('popstate', () => {
    if (ignorePop > 0 && Date.now() < ignoreUntil) { ignorePop--; syncHash(); return; }
    ignorePop = 0;
    if (layers.length) { layers.pop().close(); return; }
    const h = location.hash.slice(1);
    if (TABS.includes(h) && h !== ui.tab) switchTab(h);
  });

  // =====================================================================
  // 6. État d'interface
  // =====================================================================
  const ui = {
    tab: 'seance',
    seance: { machineId: null, programId: null, search: '', group: '', form: null, optsOpen: false },
    histDetail: null,
    progressMachine: null,
    backupBanner: false,
    machineDraft: null,
    progDraft: null,
  };

  function switchTab(tab) {
    if (!TABS.includes(tab)) tab = 'seance';
    ui.tab = tab;
    $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === tab));
    $$('.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }
  function onTabClick(tab) {
    if (modal) return;
    const cur = ui.tab;
    if (tab === cur) {
      const n = countTop((l) => l.tab === cur && l.type !== 'tab');
      if (n) popLayers(n); else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (tab === 'seance') {
      const n = countTop((l) => l.tab !== 'seance');
      if (n) popLayers(n); else switchTab('seance');
      return;
    }
    if (cur === 'seance') {
      pushLayer({ tab, type: 'tab', close: () => switchTab('seance') }, tab);
      switchTab(tab);
      return;
    }
    // d'un onglet secondaire à un autre : on réutilise la couche « onglet »
    const n = countTop((l) => l.tab === cur && l.type !== 'tab');
    if (n) popLayers(n);
    const tl = layers[layers.length - 1];
    if (tl && tl.type === 'tab') tl.tab = tab;
    switchTab(tab);
    if (!pendingBack) syncHash();
  }
  function goHome() {
    const n = countTop((l) => l.tab !== 'seance');
    if (n) popLayers(n);
    if (ui.tab !== 'seance') switchTab('seance');
  }

  const RENDER = {
    seance: () => renderSeance(),
    historique: () => renderHistorique(),
    progres: () => renderProgres(),
    reglages: () => renderReglages(),
  };
  function render() { RENDER[ui.tab](); }

  // =====================================================================
  // 7. Toast, modales, minuteur
  // =====================================================================
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  let modal = null; // { resolve, result, opts }

  /**
   * Ouvre une boîte de dialogue maison. Résout avec la valeur de l'action
   * (ou null si fermée par retour/fond/Échap).
   * opts.actions : [{ label, value, cls }] ; opts.onAction(value, el) → false = rester ouvert,
   * undefined = renvoyer value, autre = renvoyer ce résultat.
   */
  function openModal(opts) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      const actions = opts.actions || [{ label: 'OK', value: true, cls: 'btn-primary' }];
      if (modal) { const old = modal; modal = null; old.resolve(null); }
      else pushLayer({ tab: ui.tab, type: 'modal', close: closeModalDom });
      modal = { resolve, result: null, opts, actions };
      const tEl = $('#toast'); if (tEl) tEl.classList.remove('show'); // ne pas masquer le formulaire
      root.innerHTML = `
        <div class="modal-backdrop" data-modal-backdrop>
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
            <h2 class="modal-title" id="modal-title">${esc(opts.title)}</h2>
            ${opts.text ? `<p>${esc(opts.text)}</p>` : ''}
            ${opts.body || ''}
            <p data-modal-error role="alert" class="hidden" style="color:var(--danger);font-weight:600"></p>
            <div class="modal-actions">
              ${actions.map((a, i) => `<button type="button" class="btn ${esc(a.cls || 'btn-secondary')}" data-modal-value="${i}">${a.html || esc(a.label)}</button>`).join('')}
            </div>
          </div>
        </div>`;
      const m = $('.modal', root);
      if (opts.onMount) opts.onMount(m);
      m.focus({ preventScroll: true });
    });
  }
  function closeModalDom() {
    const root = $('#modal-root');
    if (root) root.innerHTML = '';
    const st = modal;
    modal = null;
    ui.machineDraft = null;
    ui.progDraft = null;
    if (st) st.resolve(st.result);
  }
  function modalError(msg) {
    const el = $('[data-modal-error]');
    if (!el) { toast(msg); return; }
    el.textContent = msg;
    el.classList.remove('hidden');
    buzz(60);
  }
  function modalChoose(value) {
    if (!modal) return;
    const el = $('.modal');
    let r = value;
    if (modal.opts.onAction && value != null) {
      const out = modal.opts.onAction(value, el);
      if (out === false) return;
      if (out !== undefined) r = out;
    }
    modal.result = r;
    popLayer();
  }
  function confirmModal(title, text, okLabel, danger) {
    return openModal({
      title, text,
      actions: [
        { label: 'Annuler', value: null, cls: 'btn-secondary' },
        { label: okLabel || 'Confirmer', value: true, cls: danger ? 'btn-danger' : 'btn-primary' },
      ],
    }).then((v) => v === true);
  }
  function alertModal(title, text) {
    return openModal({ title, text, actions: [{ label: 'OK', value: true, cls: 'btn-primary' }] });
  }

  // --- Minuteur de repos ---
  const timer = { end: 0, running: false, duration: 90, interval: null, resetT: null };
  function timerEl() { return $('#timer'); }
  function timerShowValue(sec) {
    const v = $('#timer-value');
    if (v) v.textContent = fmtDur(Math.max(0, sec));
  }
  function timerLabel() {
    const v = $('#timer-value');
    if (v) v.setAttribute('aria-label', timer.running
      ? `Repos en cours (${fmtDurLong(timer.duration)}) : toucher pour arrêter`
      : `Minuteur de repos ${fmtDurLong(timer.duration)} : toucher pour lancer`);
  }
  function timerStart(sec) {
    clearTimeout(timer.resetT);
    timer.duration = Math.max(5, Math.round(sec || timer.duration || settings().restSeconds));
    timer.end = Date.now() + timer.duration * 1000;
    timer.running = true;
    clearInterval(timer.interval);
    timer.interval = setInterval(timerTick, 250);
    const el = timerEl();
    el.classList.remove('hidden');
    el.classList.add('running');
    timerLabel();
    timerTick();
  }
  function timerTick() {
    if (!timer.running) return;
    const left = Math.ceil((timer.end - Date.now()) / 1000);
    timerShowValue(left);
    if (left <= 0) timerDone();
  }
  function timerStop(hide) {
    timer.running = false;
    clearInterval(timer.interval);
    clearTimeout(timer.resetT);
    const el = timerEl();
    el.classList.remove('running');
    timerShowValue(timer.duration);
    timerLabel();
    if (hide) el.classList.add('hidden');
  }
  function timerDone() {
    timer.running = false;
    clearInterval(timer.interval);
    timerEl().classList.remove('running');
    timerShowValue(0);
    timerLabel();
    buzz([300, 120, 300, 120, 300]);
    toast('Repos terminé : série suivante !');
    timer.resetT = setTimeout(() => { if (!timer.running) timerShowValue(timer.duration); }, 4000);
  }
  function timerAdjust(delta) {
    if (timer.running) {
      timer.end += delta * 1000;
      timer.duration = Math.max(5, timer.duration + delta);
      timerTick();
    } else {
      timer.duration = Math.min(900, Math.max(15, timer.duration + delta));
      timerShowValue(timer.duration);
    }
    timerLabel();
  }

  // =====================================================================
  // 8. Photos (Blob) : URL d'affichage + redimensionnement
  // =====================================================================
  const photoURLs = new Map();
  function photoURL(m) {
    if (!m || !m.photo || !(m.photo instanceof Blob)) return null;
    const c = photoURLs.get(m.id);
    if (c && c.blob === m.photo) return c.url;
    if (c) URL.revokeObjectURL(c.url);
    const url = URL.createObjectURL(m.photo);
    photoURLs.set(m.id, { blob: m.photo, url });
    return url;
  }
  function clearPhotoURLs() {
    photoURLs.forEach((c) => URL.revokeObjectURL(c.url));
    photoURLs.clear();
  }
  async function resizeImage(file, max) {
    max = max || 600;
    let src, w, h, cleanup = () => {};
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w = src.width; h = src.height;
      cleanup = () => { if (src.close) src.close(); };
    } catch (e) {
      const url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('Image illisible'));
        img.src = url;
      });
      w = src.naturalWidth; h = src.naturalHeight;
      cleanup = () => URL.revokeObjectURL(url);
    }
    const scale = Math.min(1, max / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    canvas.getContext('2d').drawImage(src, 0, 0, cw, ch);
    cleanup();
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Conversion impossible'))), 'image/jpeg', 0.82));
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(url) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m) return null;
    const type = m[1] || 'application/octet-stream';
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
    const bin = atob(m[3]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }

  // =====================================================================
  // 9. Fragments HTML communs
  // =====================================================================
  function topbarHTML(title, sub, backAction, backLabel) {
    return `<header class="topbar">
      <h1 class="topbar-title">${esc(title)}</h1>
      ${backAction ? `<button type="button" class="btn btn-icon btn-secondary" style="order:-1" data-action="${backAction}" aria-label="${esc(backLabel || 'Retour')}">${ICON.back}</button>` : ''}
      ${sub ? `<p class="topbar-sub">${esc(sub)}</p>` : ''}
    </header>`;
  }
  // --- Photo de machine : recherche internet + ajout direct (galerie / presse-papiers) ---
  function photoSearchURL(m) {
    const q = `${m.name} ${/haltère|halteres|haltères/i.test(m.name) ? 'exercice' : 'machine musculation'}`;
    return `https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`;
  }
  function photoToolsHTML(m, scope) {
    // scope = 'logger' (enregistre directement sur la machine) ou 'form' (brouillon de la modale)
    const input = scope === 'logger' ? 'logger-photo' : 'machine-photo';
    const paste = scope === 'logger' ? 'photo-paste' : 'photo-paste-form';
    const pasteBtn = navigator.clipboard && navigator.clipboard.read
      ? `<button type="button" class="btn btn-secondary" data-action="${paste}" data-id="${esc(m ? m.id : '')}">${ICON.paste} Coller</button>` : '';
    return `<div class="banner-actions">
      <button type="button" class="btn btn-secondary" data-action="photo-search" data-id="${esc(m ? m.id : '')}">${ICON.search} Chercher sur internet</button>
      <label class="btn btn-secondary">${ICON.image} Galerie<input type="file" class="hidden" accept="image/*" data-input="${input}" data-id="${esc(m ? m.id : '')}"></label>
      ${pasteBtn}
    </div>`;
  }
  function loggerPhotoHTML(m) {
    const url = photoURL(m);
    if (url) return `<img class="machine-photo" src="${esc(url)}" alt="Photo : ${esc(m.name)}">`;
    return `<div class="card photo-empty">
      <div class="card-sub">Pas encore de photo pour reconnaître cette machine. Cherche-la, enregistre l’image (appui long → « Télécharger l’image » ou « Copier l’image »), puis ajoute-la ici : elle restera dans l’appli.</div>
      ${photoToolsHTML(m, 'logger')}
    </div>`;
  }
  async function saveMachinePhoto(id, blob) {
    const m = S.machines.get(id);
    if (!m) return;
    const upd = Object.assign({}, m, { photo: blob });
    await dbWrite(['machines'], (st) => st('machines').put(upd));
    S.machines.set(id, upd);
    ui.pendingPhotoFor = null;
    buzz(30);
    toast('Photo enregistrée dans l’appli');
    render();
  }
  async function readClipboardImage() {
    if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('unsupported');
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith('image/'));
      if (type) return it.getType(type);
    }
    return null;
  }
  async function pasteImage(onBlob) {
    try {
      const raw = await readClipboardImage();
      if (!raw) { toast('Aucune image copiée. Fais un appui long sur l’image → « Copier l’image ».'); return; }
      onBlob(await resizeImage(raw, 600));
    } catch (e) {
      toast('Collage impossible ici : utilise plutôt « Galerie ».');
    }
  }

  function thumbHTML(m) {
    const url = photoURL(m);
    if (url) return `<span class="machine-thumb" data-group="${esc(m.group)}"><img src="${esc(url)}" alt="" loading="lazy"></span>`;
    const words = String(m.name || '').split(/[\s/()'’-]+/).filter((w) => /^[\p{L}\p{N}]/u.test(w) && (w.length > 2 || /^\p{Lu}/u.test(w)));
    const letters = (words.length ? words.slice(0, 2).map((w) => w[0]).join('') : '?').toUpperCase();
    return `<span class="machine-thumb" data-group="${esc(m.group)}" aria-hidden="true">${esc(letters)}</span>`;
  }
  function statsHTML(nMachines, nSets, volume) {
    return `<div class="session-stats">
      <span class="stat"><span class="stat-value">${fmtInt(nMachines)}</span><span class="stat-label">${nMachines > 1 ? 'machines' : 'machine'}</span></span>
      <span class="stat"><span class="stat-value">${fmtInt(nSets)}</span><span class="stat-label">${nSets > 1 ? 'séries' : 'série'}</span></span>
      <span class="stat"><span class="stat-value">${fmtInt(volume)} <small>kg</small></span><span class="stat-label">volume</span></span>
    </div>`;
  }
  function setTagsHTML(s) {
    let t = '';
    if (s.drop) t += '<span class="tag tag-drop">dégressive</span>';
    if (s.extra) t += `<span class="tag tag-extra">+${fmtInt(s.extra)} ${s.extra > 1 ? 'aidées' : 'aidée'}</span>`;
    if (s.reps == null) t += '<span class="tag tag-warn">reps ?</span>';
    if (s.note) t += `<span class="tag tag-note" title="${esc(s.note)}">${esc(s.note)}</span>`;
    return t;
  }
  function setRowHTML(s) {
    return `<div class="set-row" data-set="${esc(s.id)}">
      <span class="set-n" aria-label="Série ${esc(s.setNumber)}${s.drop ? ', dégressive' : ''}">${s.drop ? '↳' : ''}${esc(s.setNumber)}</span>
      <span class="set-main">${esc(fmtKg(s.kg))} kg × ${s.reps == null ? '?' : esc(s.reps)}</span>
      <span class="set-tags">${setTagsHTML(s)}</span>
      <div class="list-item-actions">
        <button type="button" class="btn btn-icon" data-action="edit-set" data-id="${esc(s.id)}" aria-label="Modifier la série ${esc(s.setNumber)}">${ICON.edit}</button>
        <button type="button" class="btn btn-icon btn-danger" data-action="delete-set" data-id="${esc(s.id)}" aria-label="Supprimer la série ${esc(s.setNumber)}">${ICON.trash}</button>
      </div>
    </div>`;
  }
  function emptyHTML(icon, title, text, btn) {
    return `<div class="empty">
      <span class="empty-icon">${icon}</span>
      <p class="empty-text"><strong>${esc(title)}</strong>${esc(text)}</p>
      ${btn || ''}
    </div>`;
  }
  function backupBannerHTML() {
    const le = S.meta.lastExportAt;
    return `<section class="banner banner-backup" aria-label="Sauvegarde hebdomadaire">
      <div>
        <strong>Sauvegarde de la semaine prête</strong>
        <p>${le ? `Dernier export ${esc(fmtAgo(le))}.` : 'Aucun export pour l’instant.'} Enregistrez une copie sur Google Drive pour ne rien perdre.</p>
      </div>
      <div class="banner-actions">
        <button type="button" class="btn btn-primary" data-action="backup-share">${ICON.share} Enregistrer sur Drive</button>
        <button type="button" class="btn btn-ghost" data-action="backup-later">Plus tard</button>
      </div>
    </section>`;
  }

  // =====================================================================
  // 10. Vue Séance
  // =====================================================================
  function renderSeance() {
    const el = $('#view-seance');
    const today = todayISO();
    const m = ui.seance.machineId ? S.machines.get(ui.seance.machineId) : null;
    if (ui.seance.machineId && !m) ui.seance.machineId = null;
    let h = topbarHTML('Séance', cap(fmtLong(today)));
    if (m) {
      h += loggerHTML(m);
    } else {
      if (ui.backupBanner) h += backupBannerHTML();
      h += pickerHTML();
    }
    el.innerHTML = h;
  }

  function pickerHTML() {
    let h = '';
    const prog = ui.seance.programId ? S.programs.get(ui.seance.programId) : null;
    const done = new Set(todaySets().map((s) => s.machineId));
    if (prog) {
      const ids = prog.machineIds.filter((id) => S.machines.has(id));
      const nDone = ids.filter((id) => done.has(id)).length;
      h += `<h2 class="section-title">${ICON.list} ${esc(prog.name)} <span class="badge">${fmtInt(nDone)}/${fmtInt(ids.length)}</span></h2>`;
      h += `<div class="machine-list">${ids.map((id) => machineItemHTML(S.machines.get(id), done.has(id))).join('')}</div>`;
      h += `<button type="button" class="btn btn-ghost btn-block" data-action="program-quit">${ICON.close} Quitter le programme</button>`;
    } else if (S.programs.size) {
      h += `<button type="button" class="btn btn-secondary btn-block" data-action="program-start">${ICON.list} Démarrer un programme</button>`;
    }
    h += summaryHTML();
    h += `<h2 class="section-title">Choisir une machine</h2>`;
    h += `<input type="search" class="search" data-input="search" placeholder="Rechercher une machine…" aria-label="Rechercher une machine" autocomplete="off" enterkeyhint="search" value="${esc(ui.seance.search)}">`;
    const groups = groupList().filter((g) => [...S.machines.values()].some((m) => !m.archived && m.group === g));
    h += `<div class="chips" role="group" aria-label="Filtrer par groupe musculaire">
      <button type="button" class="chip${ui.seance.group ? '' : ' active'}" data-action="filter-group" data-group-filter="" aria-pressed="${!ui.seance.group}">Toutes</button>
      ${groups.map((g) => `<button type="button" class="chip${ui.seance.group === g ? ' active' : ''}" data-action="filter-group" data-group-filter="${esc(g)}" aria-pressed="${ui.seance.group === g}"><span class="group-dot" data-group="${esc(g)}"></span>${esc(g)}</button>`).join('')}
    </div>`;
    h += `<div class="machine-list" id="machine-list">${machineListHTML()}</div>`;
    return h;
  }

  function machineMeta(m, last) {
    const parts = [m.group];
    if (last) parts.push(`${fmtSet(last.set)} · ${fmtShort(last.date)}`);
    return parts.join(' · ');
  }
  function machineItemHTML(m, done, lastMap) {
    const last = (lastMap || lastUseMap()).get(m.id);
    return `<button type="button" class="machine-item" data-action="pick-machine" data-id="${esc(m.id)}">
      ${thumbHTML(m)}
      <span class="machine-name">${esc(m.name)}</span>
      <span class="machine-meta"><span class="group-dot" data-group="${esc(m.group)}"></span>${esc(machineMeta(m, last))}</span>
      ${done ? `<span class="tag tag-extra">${ICON.check} fait</span>` : ''}
    </button>`;
  }
  function filteredMachines() {
    const q = norm(ui.seance.search).trim().split(/\s+/).filter(Boolean);
    const lm = lastUseMap();
    const list = [...S.machines.values()].filter((m) => !m.archived
      && (!ui.seance.group || m.group === ui.seance.group)
      && q.every((w) => norm(`${m.name} ${m.group} ${m.type || ''}`).includes(w)));
    list.sort((a, b) => {
      const la = lm.get(a.id), lb = lm.get(b.id);
      if (la && lb) return -byDateAsc(la, lb);
      if (la) return -1;
      if (lb) return 1;
      return a.name.localeCompare(b.name, 'fr');
    });
    return { list, lm };
  }
  function machineListHTML() {
    const { list, lm } = filteredMachines();
    const done = new Set(todaySets().map((s) => s.machineId));
    if (!list.length) {
      const q = ui.seance.search.trim();
      return `<div class="empty" style="border:0">
        <p class="empty-text"><strong>Aucune machine trouvée</strong>${q ? 'Vérifiez l’orthographe ou créez-la.' : 'Aucune machine dans ce groupe.'}</p>
        <button type="button" class="btn btn-secondary" data-action="machine-add" data-name="${esc(q)}">${ICON.plus} ${q ? `Créer « ${esc(q)} »` : 'Ajouter une machine'}</button>
      </div>`;
    }
    return list.map((m) => machineItemHTML(m, done.has(m.id), lm)).join('');
  }
  function refreshMachineList() {
    const el = $('#machine-list');
    if (el) el.innerHTML = machineListHTML();
  }

  function summaryHTML() {
    const sets = todaySets();
    if (!sets.length) return '';
    const g = groupByMachine(sets);
    return `<h2 class="section-title">Aujourd’hui</h2>
      ${statsHTML(g.size, sets.length, volumeOf(sets))}
      <div class="machine-list">
        ${[...g].map(([mid, ss]) => {
          const m = S.machines.get(mid) || { id: mid, name: machineName(mid), group: 'Autres' };
          return `<button type="button" class="machine-item" data-action="pick-machine" data-id="${esc(mid)}">
            ${thumbHTML(m)}
            <span class="machine-name">${esc(m.name)}</span>
            <span class="machine-meta wrap">${esc(plural(ss.filter((s) => !s.drop).length, 'série', 'séries'))} · ${esc(ss.map(fmtSet).join(', '))}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  /** Valeurs pré-remplies du logger pour une machine. */
  function prefillFor(machineId) {
    const sets = setsOfMachine(machineId);
    let lastMain = null;
    for (let i = sets.length - 1; i >= 0; i--) { if (!sets[i].drop) { lastMain = sets[i]; break; } }
    if (!lastMain && sets.length) lastMain = sets[sets.length - 1];
    const maxN = currentMaxSetNumber(machineId);
    return {
      kg: lastMain ? lastMain.kg : 10,
      reps: lastMain && lastMain.reps != null ? lastMain.reps : 10,
      setNumber: maxN + 1,
      extra: 0, drop: false, note: '',
      step: settings().weightStep,
    };
  }
  /** Recalcule le n° de série proposé si le logger est ouvert (après suppression, changement de date…). */
  function refreshLoggerSetNumber() {
    const f = ui.seance.form, mid = ui.seance.machineId;
    if (f && mid) { const maxN = currentMaxSetNumber(mid); f.setNumber = f.drop ? Math.max(1, maxN) : maxN + 1; }
  }
  function currentMaxSetNumber(machineId) {
    return todaySets().filter((s) => s.machineId === machineId).reduce((a, s) => Math.max(a, s.setNumber || 0), 0);
  }

  function stepperHTML(o) {
    return `<div class="stepper">
      <span class="stepper-label" id="lbl-${o.key}">${esc(o.label)}</span>
      ${o.extra || ''}
      <button type="button" class="stepper-btn" data-action="${o.key}-dec" aria-label="${esc(o.decLabel)}">${ICON.minus}</button>
      <div class="stepper-value">
        <input type="text" class="stepper-input" id="in-${o.key}" data-input="${o.key}" inputmode="${o.mode}" ${o.mode === 'numeric' ? 'pattern="[0-9]*"' : ''} enterkeyhint="done" autocomplete="off" aria-labelledby="lbl-${o.key}" value="${esc(o.value)}">
        <span class="stepper-unit">${esc(o.unit)}</span>
      </div>
      <button type="button" class="stepper-btn" data-action="${o.key}-inc" aria-label="${esc(o.incLabel)}">${ICON.plus}</button>
    </div>`;
  }
  function smallCounterHTML(key, label, value, decLabel, incLabel) {
    return `<div class="set-number">
      <span id="lbl-${key}">${esc(label)}</span>
      <button type="button" class="btn btn-icon btn-secondary" data-action="${key}-dec" aria-label="${esc(decLabel)}">${ICON.minus}</button>
      <input type="text" id="in-${key}" data-input="${key}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-labelledby="lbl-${key}" value="${esc(value)}">
      <button type="button" class="btn btn-icon btn-secondary" data-action="${key}-inc" aria-label="${esc(incLabel)}">${ICON.plus}</button>
    </div>`;
  }

  function loggerHTML(m) {
    const f = ui.seance.form || (ui.seance.form = prefillFor(m.id));
    const ts = todaySession();
    const last = lastTime(m.id, ts ? ts.id : null);
    const rec = recordsOf(m.id);
    const todayM = ts ? setsOfSession(ts.id).filter((s) => s.machineId === m.id) : [];
    let lt = '';
    if (last) {
      lt += `<div>Dernière fois : <strong>${esc(last.sets.map(fmtSet).join(', '))}</strong> (<span class="nowrap">${esc(fmtShort(last.date))}</span>)</div>`;
    } else if (!todayM.length) {
      lt += '<div>Première fois sur cette machine : à vous de poser la référence !</div>';
    }
    if (rec && rec.maxSet) {
      lt += `<div>Record : <strong>${esc(fmtSet(rec.maxSet))}</strong>${rec.orm ? ` · 1RM est. <strong>${esc(fmt1(rec.orm))} kg</strong>` : ''}</div>`;
    }
    const optsCount = (f.extra ? 1 : 0) + (f.drop ? 1 : 0) + (f.note ? 1 : 0);
    let h = `<section class="logger" aria-label="Saisie d’une série">
      <div class="machine-item">
        ${thumbHTML(m)}
        <span class="machine-name">${esc(m.name)}</span>
        <span class="machine-meta"><span class="group-dot" data-group="${esc(m.group)}"></span>${esc(m.group)}${m.type ? ` · ${esc(m.type)}` : ''}</span>
        <button type="button" class="btn btn-secondary" data-action="logger-back" aria-label="Changer de machine">Changer</button>
      </div>
      ${loggerPhotoHTML(m)}
      ${lt ? `<div class="last-time">${lt}</div>` : ''}
      ${stepperHTML({
        key: 'kg', label: 'Poids', unit: 'kg', mode: 'decimal', value: inputNum(f.kg),
        decLabel: `Diminuer le poids de ${fmtKg(f.step)} kg`, incLabel: `Augmenter le poids de ${fmtKg(f.step)} kg`,
        extra: `<div class="step-select" role="group" aria-label="Pas du poids">${STEPS.map((s) =>
          `<button type="button" class="${s === f.step ? 'active' : ''}" data-action="set-step" data-step="${s}" aria-pressed="${s === f.step}" aria-label="Pas de ${fmtKg(s)} kg">${fmtKg(s)}</button>`).join('')}</div>`,
      })}
      ${stepperHTML({
        key: 'reps', label: 'Répétitions', unit: 'reps', mode: 'numeric', value: f.reps == null ? '' : String(f.reps),
        decLabel: 'Une répétition de moins', incLabel: 'Une répétition de plus',
      })}
      ${smallCounterHTML('setn', 'N° de série', f.setNumber, 'Numéro de série précédent', 'Numéro de série suivant')}
      <details class="details" data-details="opts"${ui.seance.optsOpen || optsCount ? ' open' : ''}>
        <summary class="details-summary">Options : aidées, dégressive, note${optsCount ? ` (${optsCount})` : ''}</summary>
        ${smallCounterHTML('extra', 'Reps aidées', f.extra, 'Une rep aidée de moins', 'Une rep aidée de plus')}
        <label class="toggle"><span>Série dégressive (même n° de série)</span><input type="checkbox" data-input="drop" id="in-drop"${f.drop ? ' checked' : ''}></label>
        <label class="field"><span class="field-label">Note</span><input type="text" class="input" id="in-note" data-input="note" maxlength="200" placeholder="ex. chaque bras, difficile…" value="${esc(f.note)}"></label>
      </details>
      <button type="button" class="btn btn-primary btn-lg btn-block" data-action="save-set">${ICON.check} Enregistrer la série</button>
    </section>`;
    h += `<button type="button" class="btn btn-ghost btn-block" data-action="timer-start">${ICON.timer} Lancer le repos (${esc(fmtDurLong(settings().restSeconds))})</button>`;
    if (todayM.length) {
      h += `<h2 class="section-title">Aujourd’hui sur cette machine</h2>
        <div class="card"><div class="set-list">${todayM.map(setRowHTML).join('')}</div></div>`;
    }
    return h;
  }

  function openLogger(machineId) {
    const wasOpen = !!ui.seance.machineId;
    ui.seance.machineId = machineId;
    ui.seance.form = prefillFor(machineId);
    ui.seance.optsOpen = false;
    if (!wasOpen) {
      pushLayer({ tab: 'seance', type: 'logger', close: () => { ui.seance.machineId = null; ui.seance.form = null; if (ui.tab === 'seance') renderSeance(); } });
    }
    if (ui.tab !== 'seance') switchTab('seance'); else renderSeance();
    window.scrollTo(0, 0);
  }

  /** Lit le formulaire du logger depuis le DOM (source de vérité). */
  function readLoggerForm() {
    const f = ui.seance.form;
    const kgIn = $('#in-kg'), repsIn = $('#in-reps');
    if (kgIn) f.kg = parseNum(kgIn.value);
    if (repsIn) f.reps = repsIn.value.trim() === '' ? null : parseIntSafe(repsIn.value);
    const sn = $('#in-setn'); if (sn) f.setNumber = parseIntSafe(sn.value);
    const ex = $('#in-extra'); if (ex) f.extra = parseIntSafe(ex.value) || 0;
    const dr = $('#in-drop'); if (dr) f.drop = dr.checked;
    const no = $('#in-note'); if (no) f.note = no.value.trim();
    return f;
  }

  /** Anti double-tap : un seul enregistrement à la fois, et pas deux en moins de 800 ms. */
  let savingSet = false, lastSaveAt = 0;
  async function saveSet() {
    if (savingSet || Date.now() - lastSaveAt < 800) return;
    savingSet = true;
    try { await saveSetInner(); } finally { savingSet = false; }
  }
  async function saveSetInner() {
    const machineId = ui.seance.machineId;
    if (!machineId) return;
    const f = readLoggerForm();
    if (f.kg == null || f.kg < 0 || f.kg > 1000) { toast('Poids invalide'); buzz(80); $('#in-kg') && $('#in-kg').focus(); return; }
    if (f.reps != null && (f.reps < 0 || f.reps > 1000)) { toast('Nombre de répétitions invalide'); buzz(80); return; }
    if (!f.setNumber || f.setNumber < 1) f.setNumber = currentMaxSetNumber(machineId) + 1;
    let sess = todaySession();
    const isNew = !sess;
    const now = Date.now();
    if (isNew) {
      sess = { id: uid(), date: todayISO(), dateToVerify: false, programId: ui.seance.programId || null, note: '', source: 'app', createdAt: now };
    } else if (!sess.programId && ui.seance.programId) {
      sess = Object.assign({}, sess, { programId: ui.seance.programId });
    }
    const set = {
      id: uid(), sessionId: sess.id, machineId, date: sess.date,
      setNumber: f.setNumber, kg: round2(f.kg), reps: f.reps, extra: Math.max(0, f.extra || 0),
      drop: !!f.drop, note: f.note || '', createdAt: now,
    };
    try {
      await dbWrite(['sessions', 'sets'], (st) => { st('sessions').put(sess); st('sets').put(set); });
    } catch (e) {
      toast('Échec de l’enregistrement : réessayez');
      console.warn(e);
      return;
    }
    lastSaveAt = Date.now();
    S.sessions.set(sess.id, sess);
    S.sets.set(set.id, set);
    buzz(40);
    toast(`Série ${set.setNumber} enregistrée : ${fmtSet(set)}`);
    // Série suivante : mêmes poids/reps, n° + 1, options remises à zéro.
    Object.assign(f, { setNumber: currentMaxSetNumber(machineId) + 1, extra: 0, drop: false, note: '' });
    renderSeance();
    if (settings().timerAuto) timerStart(settings().restSeconds);
  }

  // =====================================================================
  // 11. Édition / suppression de séries et de séances (partagé)
  // =====================================================================
  async function editSet(id) {
    const s = S.sets.get(id);
    if (!s) return;
    const body = `
      <p>${esc(machineName(s.machineId))} · ${esc(fmtLong(s.date))}</p>
      <label class="field"><span class="field-label">Poids (kg)</span><input type="text" class="input" id="es-kg" inputmode="decimal" autocomplete="off" value="${esc(inputNum(s.kg))}"></label>
      <label class="field"><span class="field-label">Répétitions (vide = inconnu)</span><input type="text" class="input" id="es-reps" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${s.reps == null ? '' : esc(s.reps)}"></label>
      <label class="field"><span class="field-label">N° de série</span><input type="text" class="input" id="es-n" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${esc(s.setNumber)}"></label>
      <label class="field"><span class="field-label">Reps aidées</span><input type="text" class="input" id="es-extra" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${esc(s.extra || 0)}"></label>
      <label class="toggle"><span>Série dégressive</span><input type="checkbox" id="es-drop"${s.drop ? ' checked' : ''}></label>
      <label class="field"><span class="field-label">Note</span><input type="text" class="input" id="es-note" maxlength="200" value="${esc(s.note || '')}"></label>`;
    const res = await openModal({
      title: 'Modifier la série',
      body,
      actions: [
        { label: 'Supprimer', html: `${ICON.trash} Supprimer`, value: 'delete', cls: 'btn-ghost btn-danger' },
        { label: 'Annuler', value: null, cls: 'btn-secondary' },
        { label: 'Enregistrer', value: 'save', cls: 'btn-primary' },
      ],
      onAction(v, el) {
        if (v !== 'save') return undefined;
        const kg = parseNum($('#es-kg', el).value);
        const repsRaw = $('#es-reps', el).value.trim();
        const reps = repsRaw === '' ? null : parseIntSafe(repsRaw);
        const n = parseIntSafe($('#es-n', el).value);
        const extra = parseIntSafe($('#es-extra', el).value) || 0;
        if (kg == null || kg < 0 || kg > 1000) { modalError('Poids invalide (ex. 12,5).'); return false; }
        if (repsRaw !== '' && (reps == null || reps < 0 || reps > 1000)) { modalError('Répétitions invalides.'); return false; }
        if (!n || n < 1 || n > 99) { modalError('N° de série invalide.'); return false; }
        return { kg: round2(kg), reps, setNumber: n, extra: Math.max(0, extra), drop: $('#es-drop', el).checked, note: $('#es-note', el).value.trim() };
      },
    });
    if (!res) return;
    if (res === 'delete') { await deleteSet(id, true); return; }
    const upd = Object.assign({}, s, res);
    await dbWrite(['sets'], (st) => st('sets').put(upd));
    S.sets.set(id, upd);
    toast('Série modifiée');
    if (ui.tab === 'seance' && ui.seance.form && ui.seance.machineId === s.machineId) {
      ui.seance.form.setNumber = currentMaxSetNumber(s.machineId) + 1;
    }
    render();
  }

  async function deleteSet(id) {
    const s = S.sets.get(id);
    if (!s) return;
    const ok = await confirmModal('Supprimer cette série ?', `${machineName(s.machineId)} — série ${s.setNumber} : ${fmtSet(s)}.`, 'Supprimer', true);
    if (!ok) return;
    const remaining = setsOfSession(s.sessionId).filter((x) => x.id !== id);
    const dropSession = remaining.length === 0;
    await dbWrite(['sets', 'sessions'], (st) => {
      st('sets').delete(id);
      if (dropSession) st('sessions').delete(s.sessionId);
    });
    S.sets.delete(id);
    if (dropSession) S.sessions.delete(s.sessionId);
    toast(dropSession ? 'Série supprimée (séance vide retirée)' : 'Série supprimée');
    refreshLoggerSetNumber();
    if (dropSession && ui.histDetail === s.sessionId) {
      const n = countTop((l) => l.type === 'detail');
      if (n) popLayers(n); else { ui.histDetail = null; render(); }
      return;
    }
    render();
  }

  async function changeSessionDate(id) {
    const s = S.sessions.get(id);
    if (!s) return;
    const res = await openModal({
      title: 'Changer la date',
      body: `<label class="field"><span class="field-label">Date de la séance</span><input type="date" class="input" id="sd-date" value="${esc(s.date)}" max="${esc(todayISO())}"></label>
        <label class="toggle"><span>Date encore à vérifier</span><input type="checkbox" id="sd-verify"></label>`,
      actions: [
        { label: 'Annuler', value: null, cls: 'btn-secondary' },
        { label: 'Enregistrer', value: 'save', cls: 'btn-primary' },
      ],
      onAction(v, el) {
        const d = $('#sd-date', el).value;
        if (!isISODate(d)) { modalError('Choisissez une date valide.'); return false; }
        return { date: d, dateToVerify: $('#sd-verify', el).checked };
      },
    });
    if (!res) return;
    const upd = Object.assign({}, s, res);
    const sets = setsOfSession(id).map((x) => Object.assign({}, x, { date: res.date }));
    await dbWrite(['sessions', 'sets'], (st) => { st('sessions').put(upd); sets.forEach((x) => st('sets').put(x)); });
    S.sessions.set(id, upd);
    sets.forEach((x) => S.sets.set(x.id, x));
    refreshLoggerSetNumber();
    toast(`Date changée : ${fmtLong(res.date)}`);
    render();
  }

  async function deleteSession(id) {
    const s = S.sessions.get(id);
    if (!s) return;
    const sets = setsOfSession(id);
    const ok = await confirmModal('Supprimer la séance ?',
      `Séance du ${fmtLong(s.date)} et ses ${plural(sets.length, 'série', 'séries')}. Cette action est définitive.`, 'Supprimer', true);
    if (!ok) return;
    await dbWrite(['sessions', 'sets'], (st) => { st('sessions').delete(id); sets.forEach((x) => st('sets').delete(x.id)); });
    S.sessions.delete(id);
    sets.forEach((x) => S.sets.delete(x.id));
    refreshLoggerSetNumber();
    toast('Séance supprimée');
    if (ui.histDetail === id) {
      const n = countTop((l) => l.type === 'detail');
      if (n) popLayers(n); else { ui.histDetail = null; render(); }
    } else render();
  }

  // =====================================================================
  // 12. Vue Historique
  // =====================================================================
  function renderHistorique() {
    const el = $('#view-historique');
    if (ui.histDetail && S.sessions.has(ui.histDetail)) { el.innerHTML = sessionDetailHTML(S.sessions.get(ui.histDetail)); return; }
    const sessions = sessionsDesc();
    const totalSets = S.sets.size;
    let h = topbarHTML('Historique', sessions.length ? `${plural(sessions.length, 'séance', 'séances')} · ${plural(totalSets, 'série', 'séries')}` : '');
    if (!sessions.length) {
      h += emptyHTML(ICON.calendar, 'Aucune séance', 'Vos séances apparaîtront ici dès la première série enregistrée.',
        '<button type="button" class="btn btn-primary" data-action="go-seance">Commencer une séance</button>');
      el.innerHTML = h;
      return;
    }
    const all = [...S.sets.values()];
    const bySession = new Map();
    all.forEach((s) => { if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []); bySession.get(s.sessionId).push(s); });
    let month = '';
    sessions.forEach((s) => {
      const mk = s.date.slice(0, 7);
      if (mk !== month) { month = mk; h += `<h2 class="section-title">${esc(fmtMonth(s.date))}</h2>`; }
      const sets = (bySession.get(s.id) || []).sort(byCreated);
      const g = groupByMachine(sets);
      const names = [...g.keys()].map(machineName);
      const prog = s.programId && S.programs.get(s.programId);
      const sub = (prog ? `${prog.name} · ` : '') + (names.length > 4 ? `${names.slice(0, 4).join(' · ')}…` : names.join(' · '));
      h += `<button type="button" class="session-card" data-action="open-session" data-id="${esc(s.id)}">
        <span class="session-date">${esc(cap(fmtLong(s.date)))}${s.dateToVerify ? ' <span class="badge badge-warn">date à vérifier</span>' : ''}${s.date === todayISO() && s.source !== 'import' ? ' <span class="badge">aujourd’hui</span>' : ''}</span>
        ${sub ? `<span class="card-sub" style="display:block">${esc(sub)}</span>` : ''}
        ${statsHTML(g.size, sets.length, volumeOf(sets))}
      </button>`;
    });
    el.innerHTML = h;
  }

  function sessionDetailHTML(s) {
    const sets = setsOfSession(s.id);
    const g = groupByMachine(sets);
    const prog = s.programId && S.programs.get(s.programId);
    let h = topbarHTML(cap(fmtLong(s.date)),`${prog ? `${prog.name} · ` : ''}${s.source === 'import' ? 'Importée des notes' : 'Saisie dans l’appli'}`, 'back', 'Retour à l’historique');
    if (s.dateToVerify) {
      h += `<section class="banner" aria-label="Date à vérifier">
        <div><strong><span class="badge badge-warn">date à vérifier</span></strong>
        <p>Cette séance vient de vos notes : sa date a été déduite du nom du fichier et peut être fausse.</p></div>
        <div class="banner-actions"><button type="button" class="btn btn-secondary" data-action="session-date" data-id="${esc(s.id)}">${ICON.calendar} Corriger la date</button></div>
      </section>`;
    }
    h += statsHTML(g.size, sets.length, volumeOf(sets));
    h += `<div class="banner-actions">
      ${s.dateToVerify ? '' : `<button type="button" class="btn btn-secondary" data-action="session-date" data-id="${esc(s.id)}">${ICON.calendar} Changer la date</button>`}
      <button type="button" class="btn btn-ghost btn-danger" data-action="session-delete" data-id="${esc(s.id)}">${ICON.trash} Supprimer</button>
    </div>`;
    g.forEach((ss, mid) => {
      const m = S.machines.get(mid);
      h += `<div class="card">
        <div class="card-title">${esc(machineName(mid))}</div>
        <div class="card-sub">${m ? `<span class="group-dot" data-group="${esc(m.group)}"></span> ${esc(m.group)} · ` : ''}${volumeOf(ss) || !ss.some((x) => x.reps == null) ? `volume ${esc(fmtInt(volumeOf(ss)))} kg` : 'reps non notées'}</div>
        <div class="set-list">${ss.map(setRowHTML).join('')}</div>
      </div>`;
    });
    if (!sets.length) h += emptyHTML(ICON.list, 'Séance vide', 'Aucune série dans cette séance.');
    return h;
  }

  function openSession(id) {
    if (!S.sessions.has(id)) return;
    ui.histDetail = id;
    pushLayer({ tab: 'historique', type: 'detail', close: () => { ui.histDetail = null; if (ui.tab === 'historique') renderHistorique(); } });
    renderHistorique();
    window.scrollTo(0, 0);
  }

  // =====================================================================
  // 13. Vue Progrès (graphique SVG fait main)
  // =====================================================================
  function niceStep(range, count) {
    const raw = range / count;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }
  function dailyPoints(sets) {
    const byDate = new Map();
    sets.forEach((s) => {
      let p = byDate.get(s.date);
      if (!p) { p = { date: s.date, maxKg: -Infinity, orm: null }; byDate.set(s.date, p); }
      if (s.kg > p.maxKg) p.maxKg = s.kg;
      const e = epley(s.kg, s.reps);
      if (e != null && (p.orm == null || e > p.orm)) p.orm = e;
    });
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  function chartSVG(points, name) {
    const W = 340, H = 210, L = 38, R = 14, T = 12, B = 30;
    const pw = W - L - R, ph = H - T - B;
    const vals = [];
    points.forEach((p) => { vals.push(p.maxKg); if (p.orm != null) vals.push(p.orm); });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 2) { lo -= 2; hi += 2; }
    const step = niceStep(hi - lo, 4);
    lo = Math.max(0, Math.floor(lo / step) * step);
    hi = Math.ceil(hi / step) * step;
    if (hi <= lo) hi = lo + step;
    const ts = points.map((p) => parseISO(p.date).getTime());
    const t0 = ts[0], t1 = ts[ts.length - 1];
    const x = (t) => (t1 === t0 ? L + pw / 2 : L + ((t - t0) / (t1 - t0)) * pw);
    const y = (v) => T + ((hi - v) / (hi - lo)) * ph;
    const f = (n) => n.toFixed(1);
    let g = '';
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = f(y(v));
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="currentColor" stroke-opacity="0.2"/>`;
      g += `<text class="axis" x="${L - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle" fill="currentColor" font-size="11">${esc(fmtKg(round2(v)))}</text>`;
    }
    g += `<line class="axis" x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="currentColor"/>`;
    // Libellés de dates : on évite les chevauchements.
    let lastX = -Infinity;
    const labelIdx = [];
    points.forEach((p, i) => {
      const xx = x(ts[i]);
      const isLast = i === points.length - 1;
      if (xx - lastX >= 52 || (isLast && points.length > 1)) {
        if (isLast && labelIdx.length && xx - lastX < 52) labelIdx.pop();
        labelIdx.push(i);
        lastX = xx;
      }
    });
    labelIdx.forEach((i) => {
      const xx = x(ts[i]);
      const anchor = points.length === 1 ? 'middle' : xx < L + 18 ? 'start' : xx > W - R - 18 ? 'end' : 'middle';
      g += `<line class="axis" x1="${f(xx)}" x2="${f(xx)}" y1="${T + ph}" y2="${T + ph + 4}" stroke="currentColor"/>`;
      g += `<text class="axis" x="${f(xx)}" y="${H - 8}" text-anchor="${anchor}" fill="currentColor" font-size="11">${esc(DF.short.format(parseISO(points[i].date)))}</text>`;
    });
    const ormPts = points.map((p, i) => (p.orm == null ? null : `${f(x(ts[i]))},${f(y(p.orm))}`)).filter(Boolean);
    const maxPts = points.map((p, i) => `${f(x(ts[i]))},${f(y(p.maxKg))}`);
    if (ormPts.length > 1) g += `<polyline class="line-1rm" points="${ormPts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 5"/>`;
    if (maxPts.length > 1) g += `<polyline class="line-max" points="${maxPts.join(' ')}" fill="none" stroke="currentColor" stroke-width="3"/>`;
    points.forEach((p, i) => {
      const d = DF.short.format(parseISO(p.date));
      if (p.orm != null) g += `<circle class="point point-1rm" cx="${f(x(ts[i]))}" cy="${f(y(p.orm))}" r="3.5"><title>${esc(d)} : 1RM estimé ${esc(fmt1(p.orm))} kg</title></circle>`;
      g += `<circle class="point" cx="${f(x(ts[i]))}" cy="${f(y(p.maxKg))}" r="4.5"><title>${esc(d)} : poids max ${esc(fmtKg(p.maxKg))} kg</title></circle>`;
    });
    const first = points[0], lastP = points[points.length - 1];
    const label = points.length > 1
      ? `Progression ${name} : poids max de ${fmtKg(first.maxKg)} kg (${fmtShort(first.date)}) à ${fmtKg(lastP.maxKg)} kg (${fmtShort(lastP.date)}), ${points.length} séances`
      : `Progression ${name} : une séance, ${fmtKg(first.maxKg)} kg`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}">${g}</svg>`;
  }

  function renderProgres() {
    const el = $('#view-progres');
    const lm = lastUseMap();
    if (!ui.progressMachine || !S.machines.has(ui.progressMachine)) {
      let best = null;
      lm.forEach((v, id) => { if (S.machines.has(id) && (!best || byDateAsc(best.v, v) < 0)) best = { id, v }; });
      ui.progressMachine = best ? best.id : (S.machines.size ? [...S.machines.keys()][0] : null);
    }
    let h = topbarHTML('Progrès', 'Poids max et 1RM estimé par séance');
    if (!ui.progressMachine) {
      el.innerHTML = h + emptyHTML(ICON.chart, 'Aucune machine', 'Ajoutez des machines dans Réglages pour suivre vos progrès.');
      return;
    }
    const opts = groupList().map((g) => {
      const ms = [...S.machines.values()].filter((m) => m.group === g && (!m.archived || lm.has(m.id)))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!ms.length) return '';
      return `<optgroup label="${esc(g)}">${ms.map((m) => `<option value="${esc(m.id)}"${m.id === ui.progressMachine ? ' selected' : ''}>${esc(m.name)}${lm.has(m.id) ? '' : ' (aucune donnée)'}</option>`).join('')}</optgroup>`;
    }).join('');
    h += `<label class="field"><span class="field-label">Machine</span><select class="select" data-input="progress-machine">${opts}</select></label>`;
    const m = S.machines.get(ui.progressMachine);
    const sets = setsOfMachine(m.id);
    if (!sets.length) {
      h += emptyHTML(ICON.chart, 'Pas encore de données', 'Enregistrez une première série sur cette machine pour voir votre courbe de progression.',
        `<button type="button" class="btn btn-primary" data-action="go-log" data-id="${esc(m.id)}">${ICON.dumbbell} Faire une série</button>`);
      el.innerHTML = h;
      return;
    }
    const points = dailyPoints(sets);
    h += `<figure class="chart">${chartSVG(points, m.name)}
      <figcaption class="chart-legend"><span class="legend-item">Poids max</span><span class="legend-item">1RM estimé (Epley)</span></figcaption>
    </figure>`;
    if (points.length === 1) h += '<p class="card-sub">Une seule séance pour l’instant : la courbe apparaîtra dès la deuxième.</p>';
    const r = recordsOf(m.id);
    h += `<h2 class="section-title">Records</h2>
    <div class="records">
      <div class="record"><span class="record-value">${esc(fmtKg(r.maxSet.kg))} <small>kg</small></span><span class="record-label">Poids max · ${esc(fmtShort(r.maxSet.date))}</span></div>
      <div class="record"><span class="record-value">${r.orm ? `${esc(fmt1(r.orm))} <small>kg</small>` : '—'}</span><span class="record-label">Meilleur 1RM estimé${r.ormSet ? ` · ${esc(fmtSet(r.ormSet))}` : ''}</span></div>
      <div class="record"><span class="record-value">${r.bestSet ? `${esc(fmtKg(r.bestSet.kg))} × ${esc(r.bestSet.reps)}` : '—'}</span><span class="record-label">Meilleure série (kg × reps)</span></div>
      <div class="record"><span class="record-value">${r.lastVolume ? `${esc(fmtInt(r.lastVolume))} <small>kg</small>` : '—'}</span><span class="record-label">Volume dernière séance · ${esc(fmtShort(r.lastDate))}</span></div>
    </div>`;
    const byDate = new Map();
    sets.forEach((s) => { if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(s); });
    const days = [...byDate.keys()].sort().reverse().slice(0, 30);
    h += `<h2 class="section-title">Séances sur cette machine</h2>
      <div class="list">${days.map((d) => `<div class="list-item"><span class="list-item-main"><span>${esc(cap(fmtLong(d)))}</span><span>${esc(byDate.get(d).sort(byCreated).map(fmtSet).join(', '))}</span></span></div>`).join('')}</div>`;
    el.innerHTML = h;
  }

  // =====================================================================
  // 14. Vue Réglages
  // =====================================================================
  function renderReglages() {
    const el = $('#view-reglages');
    const st = settings();
    const le = S.meta.lastExportAt, ls = S.meta.lastSnapshotAt;
    const active = [...S.machines.values()].filter((m) => !m.archived);
    const archived = [...S.machines.values()].filter((m) => m.archived);
    const gl = groupList();
    const sortM = (a, b) => (gl.indexOf(a.group) - gl.indexOf(b.group)) || a.name.localeCompare(b.name, 'fr');
    const mItem = (m) => `<div class="list-item">
      ${thumbHTML(m)}
      <span class="list-item-main"><span>${esc(m.name)}</span><span>${esc(m.group)}${m.type ? ` · ${esc(m.type)}` : ''}</span></span>
      <span class="list-item-actions"><button type="button" class="btn btn-icon" data-action="machine-edit" data-id="${esc(m.id)}" aria-label="Modifier ${esc(m.name)}">${ICON.edit}</button></span>
    </div>`;
    let h = topbarHTML('Réglages', 'Machines, programmes et sauvegardes');

    // --- Sauvegarde ---
    h += `<h2 class="section-title">Sauvegarde</h2>
    <div class="card">
      <div class="card-title">Dernier export : ${le ? esc(fmtAgo(le)) : 'jamais'}</div>
      <div class="card-sub">${le ? esc(fmtStamp(le)) : 'Exportez au moins une fois par semaine.'}${ls ? ` · Copie interne : ${esc(fmtAgo(ls))}` : ''}</div>
      <button type="button" class="btn btn-primary btn-block" data-action="backup-share">${ICON.share} Enregistrer sur Drive</button>
      <button type="button" class="btn btn-secondary btn-block" data-action="export-json">${ICON.download} Télécharger en JSON</button>
      <button type="button" class="btn btn-secondary btn-block" data-action="export-csv">${ICON.table} Exporter pour Excel (CSV)</button>
      <button type="button" class="btn btn-secondary btn-block" data-action="import-json">${ICON.upload} Importer une sauvegarde…</button>
      <input type="file" id="import-file" class="hidden" accept="application/json,.json" data-input="import-file">
    </div>
    <h2 class="section-title">Copies internes</h2>
    <p class="card-sub">Une copie automatique par semaine, les 8 plus récentes sont gardées sur ce téléphone (sans les photos).</p>
    <div class="list" id="snapshot-list"><div class="list-item"><span class="list-item-main"><span>Chargement…</span></span></div></div>
    <button type="button" class="btn btn-ghost btn-block" data-action="snapshot-now">${ICON.archive} Créer une copie maintenant</button>`;

    // --- Machines ---
    h += `<h2 class="section-title">Machines <span class="badge">${fmtInt(active.length)}</span></h2>
    <div class="list">${active.sort(sortM).map(mItem).join('') || '<div class="list-item"><span class="list-item-main"><span>Aucune machine</span></span></div>'}</div>
    <button type="button" class="btn btn-secondary btn-block" data-action="machine-add">${ICON.plus} Ajouter une machine</button>`;
    if (archived.length) {
      h += `<details class="details"><summary class="details-summary">Machines archivées (${fmtInt(archived.length)})</summary>
        <div class="list">${archived.sort(sortM).map(mItem).join('')}</div></details>`;
    }

    // --- Programmes ---
    const progs = [...S.programs.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    h += `<h2 class="section-title">Programmes</h2>
    <div class="list">${progs.map((p) => {
      const names = p.machineIds.filter((id) => S.machines.has(id)).map(machineName);
      return `<div class="list-item">
        <span class="list-item-main"><span>${esc(p.name)}</span><span>${esc(plural(names.length, 'machine', 'machines'))}${names.length ? ` : ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? '…' : ''}` : ''}</span></span>
        <span class="list-item-actions"><button type="button" class="btn btn-icon" data-action="program-edit" data-id="${esc(p.id)}" aria-label="Modifier le programme ${esc(p.name)}">${ICON.edit}</button></span>
      </div>`;
    }).join('') || '<div class="list-item"><span class="list-item-main"><span>Aucun programme</span></span></div>'}</div>
    <button type="button" class="btn btn-secondary btn-block" data-action="program-new">${ICON.plus} Nouveau programme</button>`;

    // --- Saisie ---
    h += `<h2 class="section-title">Saisie & repos</h2>
    <div class="card">
      <label class="field"><span class="field-label">Pas du poids par défaut</span>
        <select class="select" data-input="setting-step">${STEPS.map((s) => `<option value="${s}"${s === st.weightStep ? ' selected' : ''}>${esc(fmtKg(s))} kg</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">Durée du repos</span>
        <select class="select" data-input="setting-rest">${REST_CHOICES.map((s) => `<option value="${s}"${s === st.restSeconds ? ' selected' : ''}>${esc(fmtDurLong(s))}</option>`).join('')}</select></label>
      <label class="toggle"><span>Lancer le minuteur après chaque série</span><input type="checkbox" data-input="setting-timer-auto"${st.timerAuto ? ' checked' : ''}></label>
    </div>`;

    // --- Apparence ---
    h += `<h2 class="section-title">Apparence</h2>
    <div class="card">
      <label class="field"><span class="field-label">Thème</span>
        <select class="select" data-input="setting-theme">
          <option value="auto"${st.theme === 'auto' ? ' selected' : ''}>Automatique (comme le téléphone)</option>
          <option value="light"${st.theme === 'light' ? ' selected' : ''}>Clair</option>
          <option value="dark"${st.theme === 'dark' ? ' selected' : ''}>Sombre</option>
        </select></label>
    </div>`;

    // --- À propos ---
    h += `<h2 class="section-title">À propos</h2>
    <div class="card">
      <div class="card-title">Carnet Muscu</div>
      <div class="card-sub">${esc(plural(S.machines.size, 'machine', 'machines'))} · ${esc(plural(S.sessions.size, 'séance', 'séances'))} · ${esc(plural(S.sets.size, 'série', 'séries'))}. Données stockées uniquement sur cet appareil (IndexedDB), utilisables hors ligne.</div>
      <div class="card-sub" id="storage-info"></div>
    </div>`;
    el.innerHTML = h;
    fillSnapshots();
    fillStorageInfo();
  }

  async function fillSnapshots() {
    const el = $('#snapshot-list');
    if (!el) return;
    let all = [];
    try { all = await dbGetAll('snapshots'); } catch (e) { /* ignoré */ }
    all.sort((a, b) => b.createdAt - a.createdAt);
    const target = $('#snapshot-list');
    if (!target) return;
    const reason = { auto: 'Hebdomadaire', manuel: 'Manuelle', 'avant import': 'Avant import', 'avant restauration': 'Avant restauration' };
    target.innerHTML = all.length ? all.map((s) => {
      const c = s.counts || { sessions: (s.data.sessions || []).length, sets: (s.data.sets || []).length };
      return `<div class="list-item">
        <span class="list-item-main"><span>${esc(DF.stampShort.format(new Date(s.createdAt)))}</span><span>${esc(reason[s.reason] || 'Copie')} · ${esc(plural(c.sessions, 'séance', 'séances'))} · ${esc(plural(c.sets, 'série', 'séries'))}</span></span>
        <span class="list-item-actions"><button type="button" class="btn btn-secondary" data-action="snapshot-restore" data-id="${esc(s.id)}">Restaurer</button></span>
      </div>`;
    }).join('') : '<div class="list-item"><span class="list-item-main"><span>Aucune copie pour l’instant</span></span></div>';
  }
  async function fillStorageInfo() {
    const el = $('#storage-info');
    if (!el || !navigator.storage || !navigator.storage.persisted) return;
    try {
      const p = await navigator.storage.persisted();
      const t = $('#storage-info');
      if (t) t.textContent = p ? 'Stockage persistant activé : le navigateur ne videra pas les données.' : 'Stockage non garanti par le navigateur : exportez régulièrement.';
    } catch (e) { /* ignoré */ }
  }

  // --- Machines : ajout / modification ---
  function photoPreviewHTML(blob) {
    if (!blob) return '<p>Aucune photo.</p>';
    const url = URL.createObjectURL(blob);
    ui.machineDraft && ui.machineDraft.urls.push(url);
    return `<span class="machine-thumb" style="width:120px;height:120px"><img src="${esc(url)}" alt="Photo de la machine"></span>`;
  }
  function refreshPhotoPreview() {
    const box = $('#mf-photo');
    if (box && ui.machineDraft) box.innerHTML = photoPreviewHTML(ui.machineDraft.photo);
    const rm = $('#mf-photo-remove');
    if (rm && ui.machineDraft) rm.classList.toggle('hidden', !ui.machineDraft.photo);
  }
  async function editMachine(id, presetName) {
    const m = id ? S.machines.get(id) : null;
    const draft = { photo: m ? m.photo || null : null, urls: [] };
    ui.machineDraft = draft;
    const types = [...new Set([...S.machines.values()].map((x) => x.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const groups = groupList();
    const curGroup = m ? m.group : (ui.seance.group || 'Autres');
    const body = `
      <label class="field"><span class="field-label">Nom</span><input type="text" class="input" id="mf-name" maxlength="80" autocomplete="off" value="${esc(m ? m.name : presetName || '')}"></label>
      <label class="field"><span class="field-label">Groupe musculaire</span><select class="select" id="mf-group">${groups.map((g) => `<option${g === curGroup ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">Type (facultatif)</span><input type="text" class="input" id="mf-type" maxlength="60" list="mf-types" autocomplete="off" placeholder="ex. poulie, haltères" value="${esc(m ? m.type || '' : '')}"><datalist id="mf-types">${types.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist></label>
      <div class="field"><span class="field-label">Photo (facultatif)</span>
        <div id="mf-photo">${photoPreviewHTML(draft.photo)}</div>
        <div class="banner-actions" style="margin-top:10px">
          <label class="btn btn-secondary">${ICON.camera} Photo<input type="file" class="hidden" accept="image/*" capture="environment" data-input="machine-photo"></label>
          <button type="button" class="btn btn-ghost btn-danger${draft.photo ? '' : ' hidden'}" id="mf-photo-remove" data-action="machine-photo-remove">Retirer</button>
        </div>
        <div style="margin-top:8px">${photoToolsHTML(m || { id: '', name: presetName || '' }, 'form')}</div>
      </div>`;
    const actions = [];
    if (m) actions.push({ label: m.archived ? 'Désarchiver' : 'Archiver', html: `${ICON.archive} ${m.archived ? 'Désarchiver' : 'Archiver'}`, value: 'archive', cls: 'btn-ghost' });
    actions.push({ label: 'Annuler', value: null, cls: 'btn-secondary' }, { label: 'Enregistrer', value: 'save', cls: 'btn-primary' });
    const res = await openModal({
      title: m ? 'Modifier la machine' : 'Nouvelle machine',
      body, actions,
      onAction(v, el) {
        if (v === 'archive') return { action: 'archive' };
        const name = $('#mf-name', el).value.trim();
        if (!name) { modalError('Donnez un nom à la machine.'); $('#mf-name', el).focus(); return false; }
        return { action: 'save', name, group: $('#mf-group', el).value, type: $('#mf-type', el).value.trim(), photo: draft.photo };
      },
    });
    draft.urls.forEach((u) => URL.revokeObjectURL(u));
    if (!res) return;
    if (res.action === 'archive') {
      const upd = Object.assign({}, m, { archived: !m.archived });
      await dbWrite(['machines'], (st) => st('machines').put(upd));
      S.machines.set(m.id, upd);
      toast(upd.archived ? 'Machine archivée (historique conservé)' : 'Machine réactivée');
      render();
      return;
    }
    const rec = m
      ? Object.assign({}, m, { name: res.name, group: res.group, type: res.type, photo: res.photo || null })
      : { id: uid(), name: res.name, group: res.group, type: res.type, photo: res.photo || null, archived: false, createdAt: Date.now() };
    await dbWrite(['machines'], (st) => st('machines').put(rec));
    S.machines.set(rec.id, rec);
    toast(m ? 'Machine modifiée' : 'Machine ajoutée');
    if (!m && ui.tab === 'seance') { ui.seance.search = ''; openLogger(rec.id); return; }
    render();
  }

  // --- Programmes ---
  function progEditorHTML() {
    const d = ui.progDraft;
    if (!d) return '';
    const sel = d.ids.filter((id) => S.machines.has(id));
    const avail = [...S.machines.values()].filter((m) => !m.archived && !sel.includes(m.id))
      .sort((a, b) => (groupList().indexOf(a.group) - groupList().indexOf(b.group)) || a.name.localeCompare(b.name, 'fr'));
    let h = `<span class="field-label">Machines dans l’ordre (${fmtInt(sel.length)})</span>`;
    h += sel.length ? `<div class="list">${sel.map((id, i) => `<div class="list-item">
        <span class="list-item-main"><span>${i + 1}. ${esc(machineName(id))}</span><span>${esc(S.machines.get(id).group)}</span></span>
        <span class="list-item-actions">
          <button type="button" class="btn btn-icon" data-action="prog-up" data-i="${i}" aria-label="Monter ${esc(machineName(id))}"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
          <button type="button" class="btn btn-icon" data-action="prog-down" data-i="${i}" aria-label="Descendre ${esc(machineName(id))}"${i === sel.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
          <button type="button" class="btn btn-icon btn-danger" data-action="prog-remove" data-i="${i}" aria-label="Retirer ${esc(machineName(id))}">${ICON.close}</button>
        </span></div>`).join('')}</div>`
      : '<p>Aucune machine : ajoutez-en ci-dessous.</p>';
    h += `<details class="details" data-details="prog-add" style="margin-top:12px"${d.addOpen ? ' open' : ''}>
      <summary class="details-summary">Ajouter des machines (${fmtInt(avail.length)})</summary>
      <div class="machine-list">${avail.map((m) => `<button type="button" class="machine-item" data-action="prog-add" data-id="${esc(m.id)}">
        ${thumbHTML(m)}<span class="machine-name">${esc(m.name)}</span>
        <span class="machine-meta"><span class="group-dot" data-group="${esc(m.group)}"></span>${esc(m.group)}</span>
        <span class="btn btn-icon btn-secondary" aria-hidden="true">${ICON.plus}</span></button>`).join('')}</div>
    </details>`;
    return h;
  }
  function refreshProgEditor() {
    const el = $('#prog-editor');
    if (el) el.innerHTML = progEditorHTML();
  }
  async function editProgram(id) {
    const p = id ? S.programs.get(id) : null;
    ui.progDraft = { ids: p ? p.machineIds.filter((x) => S.machines.has(x)) : [], addOpen: !p };
    const draft = ui.progDraft;
    const actions = [];
    if (p) actions.push({ label: 'Supprimer', html: `${ICON.trash} Supprimer`, value: 'delete', cls: 'btn-ghost btn-danger' });
    actions.push({ label: 'Annuler', value: null, cls: 'btn-secondary' }, { label: 'Enregistrer', value: 'save', cls: 'btn-primary' });
    const res = await openModal({
      title: p ? 'Modifier le programme' : 'Nouveau programme',
      body: `<label class="field"><span class="field-label">Nom</span><input type="text" class="input" id="pf-name" maxlength="60" autocomplete="off" placeholder="ex. Poitrine + Triceps" value="${esc(p ? p.name : '')}"></label>
        <div id="prog-editor">${progEditorHTML()}</div>`,
      actions,
      onAction(v, el) {
        if (v === 'delete') return { action: 'delete' };
        const name = $('#pf-name', el).value.trim();
        if (!name) { modalError('Donnez un nom au programme.'); return false; }
        if (!draft.ids.length) { modalError('Ajoutez au moins une machine.'); return false; }
        return { action: 'save', name, ids: draft.ids.slice() };
      },
    });
    if (!res) return;
    if (res.action === 'delete') {
      const ok = await confirmModal('Supprimer le programme ?', `« ${p.name} » sera supprimé. Les séances déjà faites sont conservées.`, 'Supprimer', true);
      if (!ok) return;
      await dbWrite(['programs'], (st) => st('programs').delete(p.id));
      S.programs.delete(p.id);
      if (ui.seance.programId === p.id) ui.seance.programId = null;
      toast('Programme supprimé');
      render();
      return;
    }
    const rec = p ? Object.assign({}, p, { name: res.name, machineIds: res.ids }) : { id: uid(), name: res.name, machineIds: res.ids };
    await dbWrite(['programs'], (st) => st('programs').put(rec));
    S.programs.set(rec.id, rec);
    toast(p ? 'Programme modifié' : 'Programme créé');
    render();
  }
  async function startProgram() {
    const progs = [...S.programs.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!progs.length) { toast('Créez d’abord un programme dans Réglages'); return; }
    const res = await openModal({
      title: 'Démarrer un programme',
      body: `<div class="machine-list">${progs.map((p) => {
        const names = p.machineIds.filter((id) => S.machines.has(id)).map(machineName);
        return `<button type="button" class="machine-item" data-modal-return="${esc(p.id)}">
          <span class="machine-thumb" aria-hidden="true">${ICON.list}</span>
          <span class="machine-name">${esc(p.name)}</span>
          <span class="machine-meta">${esc(plural(names.length, 'machine', 'machines'))} · ${esc(names.join(', '))}</span>
        </button>`;
      }).join('')}</div>`,
      actions: [{ label: 'Annuler', value: null, cls: 'btn-secondary' }],
    });
    if (!res || !S.programs.has(res)) return;
    ui.seance.programId = res;
    renderSeance();
    window.scrollTo(0, 0);
  }

  // =====================================================================
  // 15. Sauvegardes : export JSON/CSV, import, snapshots, partage
  // =====================================================================
  function exportObject(photoMap) {
    const clone = (o) => JSON.parse(JSON.stringify(o));
    return {
      format: 'carnet-muscu',
      version: EXPORT_VERSION,
      app: 'Carnet Muscu',
      exportedAt: new Date().toISOString(),
      settings: settings(),
      machines: [...S.machines.values()].sort(byCreated).map((m) => ({
        id: m.id, name: m.name, group: m.group, type: m.type || '', archived: !!m.archived, createdAt: m.createdAt,
        photo: photoMap && photoMap.get(m.id) ? photoMap.get(m.id) : null,
      })),
      programs: [...S.programs.values()].map((p) => ({ id: p.id, name: p.name, machineIds: p.machineIds.slice() })),
      sessions: [...S.sessions.values()].sort(byDateAsc).map(clone),
      sets: [...S.sets.values()].sort(byDateAsc).map(clone),
    };
  }
  async function photoDataURLs() {
    const map = new Map();
    for (const m of S.machines.values()) {
      if (m.photo instanceof Blob) {
        try { map.set(m.id, await blobToDataURL(m.photo)); } catch (e) { /* photo ignorée */ }
      }
    }
    return map;
  }
  async function backupJSON() { return JSON.stringify(exportObject(await photoDataURLs())); }
  const backupName = (ext) => `carnet-muscu-${todayISO()}.${ext}`;

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  async function markExported() {
    await setMeta('lastExportAt', Date.now());
    ui.backupBanner = false;
  }
  async function exportJSONDownload() {
    const json = await backupJSON();
    downloadBlob(new Blob([json], { type: 'application/json' }), backupName('json'));
    await markExported();
    toast('Sauvegarde téléchargée');
    render();
  }
  /** Feuille de partage Android (→ Google Drive) ; repli : téléchargement. */
  async function shareBackup() {
    const json = await backupJSON();
    const name = backupName('json');
    let shared = false;
    if (navigator.share && navigator.canShare) {
      const candidates = [
        new File([json], name, { type: 'application/json' }),
        new File([json], name, { type: 'text/plain' }),
      ];
      const file = candidates.find((f) => { try { return navigator.canShare({ files: [f] }); } catch (e) { return false; } });
      if (file) {
        try {
          await navigator.share({ files: [file], title: 'Sauvegarde Carnet Muscu' });
          shared = true;
        } catch (e) {
          if (e && e.name === 'AbortError') { toast('Partage annulé'); return; }
          console.warn('Partage impossible, téléchargement à la place', e);
        }
      }
    }
    if (!shared) downloadBlob(new Blob([json], { type: 'application/json' }), name);
    await markExported();
    toast(shared ? 'Sauvegarde envoyée' : 'Sauvegarde téléchargée');
    render();
  }
  function exportCSV() {
    const cell = (v) => { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const dec = (v) => (v == null ? '' : String(v).replace('.', ','));
    const rows = [['date', 'machine', 'groupe', 'série', 'kg', 'reps', 'aidées', 'dégressive', 'note']];
    [...S.sets.values()].sort(byDateAsc).forEach((s) => {
      const m = S.machines.get(s.machineId);
      rows.push([s.date, m ? m.name : s.machineId, m ? m.group : '', s.setNumber, dec(s.kg), s.reps == null ? '' : s.reps, s.extra || 0, s.drop ? 'oui' : 'non', s.note || '']);
    });
    const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), backupName('csv'));
    toast('Fichier CSV exporté');
  }

  /** Valide et normalise une sauvegarde JSON ; lève une Error en français si invalide. */
  function validateBackup(o) {
    const fail = (msg) => { throw new Error(msg); };
    if (!o || typeof o !== 'object' || Array.isArray(o)) fail('Le fichier ne contient pas une sauvegarde.');
    if (o.format !== 'carnet-muscu') fail('Ce fichier n’est pas une sauvegarde Carnet Muscu.');
    if (typeof o.version === 'number' && o.version > EXPORT_VERSION) fail('Sauvegarde créée par une version plus récente de l’appli.');
    ['machines', 'sessions', 'sets'].forEach((k) => { if (!Array.isArray(o[k])) fail(`Section « ${k} » manquante ou invalide.`); });
    const str = (v) => typeof v === 'string' && v.length > 0;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const now = Date.now();
    const machines = o.machines.map((m, i) => {
      if (!m || !str(m.id) || typeof m.name !== 'string') fail(`Machine n° ${i + 1} invalide.`);
      return {
        id: m.id, name: m.name.trim() || 'Sans nom', group: str(m.group) ? m.group : 'Autres', type: typeof m.type === 'string' ? m.type : '',
        archived: !!m.archived, createdAt: num(m.createdAt) == null ? now + i : m.createdAt,
        photo: typeof m.photo === 'string' && m.photo.startsWith('data:image/') ? m.photo : null,
      };
    });
    const mIds = new Set(machines.map((m) => m.id));
    if (mIds.size !== machines.length) fail('Identifiants de machines en double.');
    const sessions = o.sessions.map((s, i) => {
      if (!s || !str(s.id) || !isISODate(s.date)) fail(`Séance n° ${i + 1} invalide (date attendue AAAA-MM-JJ).`);
      return {
        id: s.id, date: s.date, dateToVerify: !!s.dateToVerify, programId: str(s.programId) ? s.programId : null,
        note: typeof s.note === 'string' ? s.note : '', source: s.source === 'import' ? 'import' : 'app',
        createdAt: num(s.createdAt) == null ? now + i : s.createdAt,
      };
    });
    const sMap = new Map(sessions.map((s) => [s.id, s]));
    if (sMap.size !== sessions.length) fail('Identifiants de séances en double.');
    const seen = new Set();
    const sets = o.sets.map((x, i) => {
      if (!x || !str(x.id) || seen.has(x.id)) fail(`Série n° ${i + 1} invalide.`);
      seen.add(x.id);
      if (!sMap.has(x.sessionId)) fail(`Série n° ${i + 1} : séance introuvable.`);
      if (!mIds.has(x.machineId)) fail(`Série n° ${i + 1} : machine introuvable.`);
      const kg = num(x.kg);
      if (kg == null || kg < 0) fail(`Série n° ${i + 1} : poids invalide.`);
      const reps = x.reps == null ? null : num(x.reps);
      if (x.reps != null && reps == null) fail(`Série n° ${i + 1} : répétitions invalides.`);
      return {
        id: x.id, sessionId: x.sessionId, machineId: x.machineId, date: sMap.get(x.sessionId).date,
        setNumber: Math.max(1, Math.round(num(x.setNumber) || 1)), kg, reps,
        extra: Math.max(0, Math.round(num(x.extra) || 0)), drop: !!x.drop, note: typeof x.note === 'string' ? x.note : '',
        createdAt: num(x.createdAt) == null ? now + i : x.createdAt,
      };
    });
    const programs = (Array.isArray(o.programs) ? o.programs : []).filter((p) => p && str(p.id) && typeof p.name === 'string')
      .map((p) => ({ id: p.id, name: p.name, machineIds: (Array.isArray(p.machineIds) ? p.machineIds : []).filter((id) => mIds.has(id)) }));
    const st = o.settings && typeof o.settings === 'object' ? o.settings : null;
    return { machines, sessions, sets, programs, settings: st, exportedAt: o.exportedAt };
  }

  /** Remplace toute la base (machines, séances, séries, programmes) en une transaction. */
  async function replaceAllData(data, keepCurrentPhotos) {
    const machines = data.machines.map((m) => {
      let photo = null;
      if (typeof m.photo === 'string') photo = dataURLToBlob(m.photo);
      else if (m.photo instanceof Blob) photo = m.photo;
      if (!photo && keepCurrentPhotos && S.machines.get(m.id)) photo = S.machines.get(m.id).photo || null;
      return Object.assign({}, m, { photo });
    });
    await dbWrite(['machines', 'sessions', 'sets', 'programs'], (st) => {
      ['machines', 'sessions', 'sets', 'programs'].forEach((n) => st(n).clear());
      machines.forEach((m) => st('machines').put(m));
      data.sessions.forEach((s) => st('sessions').put(s));
      data.sets.forEach((s) => st('sets').put(s));
      (data.programs || []).forEach((p) => st('programs').put(p));
    });
    clearPhotoURLs();
    S.machines = new Map(machines.map((m) => [m.id, m]));
    S.sessions = new Map(data.sessions.map((s) => [s.id, s]));
    S.sets = new Map(data.sets.map((s) => [s.id, s]));
    S.programs = new Map((data.programs || []).map((p) => [p.id, p]));
    if (data.settings) {
      const clean = {};
      if (STEPS.includes(data.settings.weightStep)) clean.weightStep = data.settings.weightStep;
      if (['auto', 'light', 'dark'].includes(data.settings.theme)) clean.theme = data.settings.theme;
      if (Number.isFinite(data.settings.restSeconds)) clean.restSeconds = Math.min(900, Math.max(5, data.settings.restSeconds));
      if (typeof data.settings.timerAuto === 'boolean') clean.timerAuto = data.settings.timerAuto;
      await saveSettings(clean);
      applyTheme();
    }
    ui.seance.machineId = null;
    ui.seance.form = null;
    if (ui.seance.programId && !S.programs.has(ui.seance.programId)) ui.seance.programId = null;
    ui.histDetail = null;
    ui.progressMachine = null;
  }

  async function createSnapshot(reason) {
    const data = exportObject(null);
    const snap = {
      id: uid(), createdAt: Date.now(), reason: reason || 'auto',
      counts: { machines: data.machines.length, sessions: data.sessions.length, sets: data.sets.length },
      data,
    };
    await dbWrite(['snapshots', 'meta'], (st) => {
      st('snapshots').put(snap);
      st('meta').put({ key: 'lastSnapshotAt', value: snap.createdAt });
    });
    S.meta.lastSnapshotAt = snap.createdAt;
    const all = (await dbGetAll('snapshots')).sort((a, b) => b.createdAt - a.createdAt);
    const old = all.slice(SNAPSHOT_KEEP);
    if (old.length) await dbWrite(['snapshots'], (st) => old.forEach((s) => st('snapshots').delete(s.id)));
    return snap;
  }

  async function importFromFile(file) {
    let data;
    try {
      const text = await file.text();
      let raw;
      try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error('Le fichier n’est pas un JSON valide.'); }
      data = validateBackup(raw);
    } catch (e) {
      await alertModal('Import impossible', e.message || 'Fichier illisible.');
      return;
    }
    const when = data.exportedAt && !isNaN(Date.parse(data.exportedAt)) ? ` (exportée le ${fmtStamp(Date.parse(data.exportedAt))})` : '';
    const ok = await confirmModal('Remplacer toutes les données ?',
      `Sauvegarde${when} : ${plural(data.machines.length, 'machine', 'machines')}, ${plural(data.sessions.length, 'séance', 'séances')}, ${plural(data.sets.length, 'série', 'séries')}. Toutes les données actuelles seront remplacées ; une copie interne est créée avant, au cas où.`,
      'Remplacer', true);
    if (!ok) return;
    try {
      await createSnapshot('avant import');
      await replaceAllData(data, false);
    } catch (e) {
      console.warn(e);
      await alertModal('Import impossible', 'Erreur pendant l’écriture des données. Rien n’a été modifié.');
      return;
    }
    toast('Sauvegarde importée');
    render();
  }

  async function restoreSnapshot(id) {
    const snap = await dbGet('snapshots', id);
    if (!snap) { toast('Copie introuvable'); return; }
    let data;
    try { data = validateBackup(snap.data); } catch (e) { await alertModal('Restauration impossible', e.message); return; }
    const ok = await confirmModal('Restaurer cette copie ?',
      `Copie du ${fmtStamp(snap.createdAt)} : ${plural(data.sessions.length, 'séance', 'séances')}, ${plural(data.sets.length, 'série', 'séries')}. Les données actuelles seront remplacées (une copie en est faite avant). Les photos actuelles sont conservées.`,
      'Restaurer', true);
    if (!ok) return;
    await createSnapshot('avant restauration');
    await replaceAllData(data, true);
    toast('Copie restaurée');
    render();
  }

  // =====================================================================
  // 16. Thème
  // =====================================================================
  function applyTheme() {
    const t = settings().theme;
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    $$('meta[name="theme-color"]').forEach((meta) => {
      if (!meta.dataset.orig) meta.dataset.orig = meta.getAttribute('content');
      meta.setAttribute('content', t === 'light' || t === 'dark' ? THEME_BG[t] : meta.dataset.orig);
    });
  }

  // =====================================================================
  // 17. Événements (délégation)
  // =====================================================================
  function stepValue(inputId, delta, opts) {
    const el = $(inputId);
    if (!el) return null;
    const cur = parseNum(el.value);
    let v = (cur == null ? opts.fallback : cur) + delta;
    v = Math.min(opts.max, Math.max(opts.min, round2(v)));
    el.value = opts.decimal ? inputNum(v) : String(Math.round(v));
    return v;
  }

  const ACTIONS = {
    'back': () => popLayer(),
    'go-seance': () => goHome(),
    'pick-machine': (t) => openLogger(t.dataset.id),
    'photo-search': (t) => {
      let m = S.machines.get(t.dataset.id);
      if (!m) { const n = $('#mf-name'); m = { name: (n && n.value.trim()) || 'machine musculation' }; }
      ui.pendingPhotoFor = t.dataset.id || null;
      window.open(photoSearchURL(m), '_blank', 'noopener');
    },
    'photo-paste': (t) => { const id = t.dataset.id; pasteImage((b) => saveMachinePhoto(id, b)); },
    'photo-paste-form': () => pasteImage((b) => { if (ui.machineDraft) { ui.machineDraft.photo = b; refreshPhotoPreview(); } }),
    'logger-back': () => { if (countTop((l) => l.type === 'logger')) popLayer(); else { ui.seance.machineId = null; renderSeance(); } },
    'kg-dec': () => { const f = ui.seance.form; f.kg = stepValue('#in-kg', -f.step, { min: 0, max: 1000, fallback: 0, decimal: true }); },
    'kg-inc': () => { const f = ui.seance.form; f.kg = stepValue('#in-kg', f.step, { min: 0, max: 1000, fallback: 0, decimal: true }); },
    'reps-dec': () => { ui.seance.form.reps = stepValue('#in-reps', -1, { min: 0, max: 999, fallback: 1 }); },
    'reps-inc': () => { ui.seance.form.reps = stepValue('#in-reps', 1, { min: 0, max: 999, fallback: 0 }); },
    'setn-dec': () => { ui.seance.form.setNumber = stepValue('#in-setn', -1, { min: 1, max: 99, fallback: 2 }); },
    'setn-inc': () => { ui.seance.form.setNumber = stepValue('#in-setn', 1, { min: 1, max: 99, fallback: 0 }); },
    'extra-dec': () => { ui.seance.form.extra = stepValue('#in-extra', -1, { min: 0, max: 99, fallback: 1 }); },
    'extra-inc': () => { ui.seance.form.extra = stepValue('#in-extra', 1, { min: 0, max: 99, fallback: 0 }); },
    'set-step': (t) => {
      const f = ui.seance.form;
      readLoggerForm();
      f.step = Number(t.dataset.step);
      $$('.step-select > button').forEach((b) => {
        const on = Number(b.dataset.step) === f.step;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const dec = $('[data-action="kg-dec"]'), inc = $('[data-action="kg-inc"]');
      if (dec) dec.setAttribute('aria-label', `Diminuer le poids de ${fmtKg(f.step)} kg`);
      if (inc) inc.setAttribute('aria-label', `Augmenter le poids de ${fmtKg(f.step)} kg`);
    },
    'save-set': () => saveSet(),
    'edit-set': (t) => editSet(t.dataset.id),
    'delete-set': (t) => deleteSet(t.dataset.id),
    'timer-start': () => timerStart(settings().restSeconds),
    'timer-toggle': () => { if (timer.running) timerStop(false); else timerStart(timer.duration); },
    'timer-plus': () => timerAdjust(15),
    'timer-minus': () => timerAdjust(-15),
    'timer-stop': () => timerStop(true),
    'program-start': () => startProgram(),
    'program-quit': () => { ui.seance.programId = null; renderSeance(); },
    'filter-group': (t) => {
      ui.seance.group = t.dataset.groupFilter || '';
      $$('.chip[data-action="filter-group"]').forEach((c) => {
        const on = (c.dataset.groupFilter || '') === ui.seance.group;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      refreshMachineList();
    },
    'backup-share': () => shareBackup().catch((e) => { console.warn(e); toast('Export impossible'); }),
    'backup-later': () => { ui.backupBanner = false; renderSeance(); },
    'open-session': (t) => openSession(t.dataset.id),
    'session-date': (t) => changeSessionDate(t.dataset.id),
    'session-delete': (t) => deleteSession(t.dataset.id),
    'go-log': (t) => { const id = t.dataset.id; goHome(); openLogger(id); },
    'machine-add': (t) => editMachine(null, t.dataset.name || ''),
    'machine-edit': (t) => editMachine(t.dataset.id),
    'machine-photo-remove': () => { if (ui.machineDraft) { ui.machineDraft.photo = null; refreshPhotoPreview(); } },
    'program-new': () => editProgram(null),
    'program-edit': (t) => editProgram(t.dataset.id),
    'prog-up': (t) => { const d = ui.progDraft, i = Number(t.dataset.i); if (d && i > 0) { [d.ids[i - 1], d.ids[i]] = [d.ids[i], d.ids[i - 1]]; refreshProgEditor(); } },
    'prog-down': (t) => { const d = ui.progDraft, i = Number(t.dataset.i); if (d && i < d.ids.length - 1) { [d.ids[i + 1], d.ids[i]] = [d.ids[i], d.ids[i + 1]]; refreshProgEditor(); } },
    'prog-remove': (t) => { const d = ui.progDraft; if (d) { d.ids.splice(Number(t.dataset.i), 1); refreshProgEditor(); } },
    'prog-add': (t) => { const d = ui.progDraft; if (d && !d.ids.includes(t.dataset.id)) { d.ids.push(t.dataset.id); refreshProgEditor(); } },
    'export-json': () => exportJSONDownload().catch((e) => { console.warn(e); toast('Export impossible'); }),
    'export-csv': () => exportCSV(),
    'import-json': () => { const i = $('#import-file'); if (i) i.click(); },
    'snapshot-restore': (t) => restoreSnapshot(t.dataset.id),
    'snapshot-now': async () => { await createSnapshot('manuel'); toast('Copie interne créée'); fillSnapshots(); },
  };

  const INPUTS = {
    'search': (t) => { ui.seance.search = t.value; refreshMachineList(); },
    'kg': (t) => { const v = parseNum(t.value); if (v != null && ui.seance.form) ui.seance.form.kg = v; },
    'reps': (t) => { if (ui.seance.form) ui.seance.form.reps = t.value.trim() === '' ? null : parseIntSafe(t.value); },
    'setn': (t) => { const v = parseIntSafe(t.value); if (v && ui.seance.form) ui.seance.form.setNumber = v; },
    'extra': (t) => { if (ui.seance.form) ui.seance.form.extra = parseIntSafe(t.value) || 0; },
    'note': (t) => { if (ui.seance.form) ui.seance.form.note = t.value; },
  };
  const CHANGES = {
    'kg': (t) => { const v = parseNum(t.value); if (v != null) t.value = inputNum(v); },
    'drop': (t) => {
      const f = ui.seance.form;
      if (!f) return;
      f.drop = t.checked;
      const maxN = currentMaxSetNumber(ui.seance.machineId);
      f.setNumber = f.drop ? Math.max(1, maxN) : maxN + 1;
      const sn = $('#in-setn');
      if (sn) sn.value = String(f.setNumber);
    },
    'progress-machine': (t) => { ui.progressMachine = t.value; renderProgres(); },
    'setting-step': async (t) => { await saveSettings({ weightStep: Number(t.value) }); toast('Pas du poids enregistré'); },
    'setting-rest': async (t) => { await saveSettings({ restSeconds: Number(t.value) }); if (!timer.running) { timer.duration = Number(t.value); timerShowValue(timer.duration); } toast('Durée du repos enregistrée'); },
    'setting-timer-auto': async (t) => { await saveSettings({ timerAuto: t.checked }); },
    'setting-theme': async (t) => { await saveSettings({ theme: t.value }); applyTheme(); },
    'import-file': (t) => { const f = t.files && t.files[0]; t.value = ''; if (f) importFromFile(f); },
    'logger-photo': async (t) => {
      const f = t.files && t.files[0];
      const id = t.dataset.id;
      t.value = '';
      if (!f || !id) return;
      try { await saveMachinePhoto(id, await resizeImage(f, 600)); } catch (e) { toast('Impossible de lire cette image.'); }
    },
    'machine-photo': async (t) => {
      const f = t.files && t.files[0];
      t.value = '';
      if (!f || !ui.machineDraft) return;
      try {
        const blob = await resizeImage(f, 600);
        if (ui.machineDraft) { ui.machineDraft.photo = blob; refreshPhotoPreview(); }
      } catch (e) { modalError('Impossible de lire cette image.'); }
    },
  };

  // Appui long sur un +/− : répète l'action (de plus en plus vite) tant que le doigt reste posé.
  const REPEATABLE = new Set(['kg-dec', 'kg-inc', 'reps-dec', 'reps-inc', 'setn-dec', 'setn-inc', 'extra-dec', 'extra-inc', 'timer-plus', 'timer-minus']);
  const hold = { timer: null, btn: null, fired: false, suppressUntil: 0 };
  function holdStop() {
    clearTimeout(hold.timer);
    hold.timer = null;
    if (hold.fired) hold.suppressUntil = Date.now() + 400; // ignore le « click » qui suit le relâchement
    hold.btn = null;
    hold.fired = false;
  }
  function bindHold() {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const b = e.target.closest && e.target.closest('[data-action]');
      if (!b || b.disabled || !REPEATABLE.has(b.dataset.action)) return;
      holdStop();
      hold.btn = b;
      let delay = 380;
      const tick = () => {
        if (!hold.btn || !hold.btn.isConnected) { holdStop(); return; }
        const fn = ACTIONS[hold.btn.dataset.action];
        if (fn) fn(hold.btn);
        hold.fired = true;
        delay = Math.max(50, delay * 0.82);
        hold.timer = setTimeout(tick, delay);
      };
      hold.timer = setTimeout(tick, 450);
    });
    ['pointerup', 'pointercancel', 'blur'].forEach((ev) => (ev === 'blur' ? window : document).addEventListener(ev, holdStop));
    document.addEventListener('pointerout', (e) => { if (hold.btn && e.target === hold.btn && !hold.btn.contains(e.relatedTarget)) holdStop(); });
    document.addEventListener('contextmenu', (e) => {
      const b = e.target.closest && e.target.closest('[data-action]');
      if (b && REPEATABLE.has(b.dataset.action)) e.preventDefault();
    });
  }

  function bindEvents() {
    bindHold();
    document.addEventListener('click', (e) => {
      if (hold.suppressUntil && Date.now() < hold.suppressUntil) {
        const b = e.target.closest && e.target.closest('[data-action]');
        hold.suppressUntil = 0;
        if (b && REPEATABLE.has(b.dataset.action)) return;
      }
      const tab = e.target.closest('.tab[data-tab]');
      if (tab) { onTabClick(tab.dataset.tab); return; }
      if (modal) {
        const mv = e.target.closest('[data-modal-value]');
        if (mv) { const a = modal.actions[Number(mv.dataset.modalValue)]; modalChoose(a ? a.value : null); return; }
        const mr = e.target.closest('[data-modal-return]');
        if (mr) { modalChoose(mr.dataset.modalReturn); return; }
        if (e.target.matches('[data-modal-backdrop]')) { popLayer(); return; }
      }
      const t = e.target.closest('[data-action]');
      if (!t || t.disabled) return;
      const fn = ACTIONS[t.dataset.action];
      if (fn) fn(t, e);
    });
    document.addEventListener('input', (e) => {
      const k = e.target.dataset && e.target.dataset.input;
      if (k && INPUTS[k]) INPUTS[k](e.target, e);
    });
    document.addEventListener('change', (e) => {
      const k = e.target.dataset && e.target.dataset.input;
      if (k && CHANGES[k]) CHANGES[k](e.target, e);
    });
    document.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d || !d.dataset) return;
      if (d.dataset.details === 'opts') ui.seance.optsOpen = d.open;
      if (d.dataset.details === 'prog-add' && ui.progDraft) ui.progDraft.addOpen = d.open;
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal) { e.preventDefault(); popLayer(); return; }
      if (e.key === 'Enter' && e.target.matches && e.target.matches('input')) {
        if (modal && !e.target.matches('[type="checkbox"], [type="file"]')) {
          const primary = $('.modal-actions .btn-primary');
          if (primary) { e.preventDefault(); primary.click(); }
        } else if (e.target.matches('.stepper-input, .set-number input')) {
          e.preventDefault();
          e.target.blur();
        }
      }
    });
    // Sélectionner tout le contenu d'un compteur au focus : on retape directement.
    document.addEventListener('focusin', (e) => {
      if (e.target.matches && e.target.matches('.stepper-input, .set-number input')) {
        setTimeout(() => { try { e.target.select(); } catch (_) { /* ignoré */ } }, 0);
      }
    });
    // Changement de jour (appli laissée ouverte, retour au premier plan).
    let lastDay = todayISO();
    const checkDay = () => {
      const d = todayISO();
      if (d !== lastDay) {
        lastDay = d;
        if (ui.seance.form && ui.seance.machineId) ui.seance.form.setNumber = currentMaxSetNumber(ui.seance.machineId) + 1;
        if (ui.tab === 'seance' && !modal) renderSeance();
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      checkDay();
      if (timer.running) timerTick();
      if (ui.pendingPhotoFor) toast('Image enregistrée ? Appuie sur « Galerie » ou « Coller » pour l’ajouter.');
    });
    setInterval(checkDay, 60000);
  }

  // =====================================================================
  // 18. Démarrage
  // =====================================================================
  function fatal(err) {
    console.error(err);
    const el = $('#view-seance');
    if (el) {
      el.innerHTML = topbarHTML('Carnet Muscu', 'Erreur au démarrage') +
        emptyHTML(ICON.close, 'Impossible d’ouvrir les données', `${err && err.message ? err.message : String(err)} Essayez de recharger la page.`,
          '<button type="button" class="btn btn-primary" onclick="location.reload()">Recharger</button>');
    }
  }

  async function init() {
    bindEvents();
    idb = await openDB();
    await loadAll();
    if (!S.meta.seeded && window.SEED) {
      await importSeed(window.SEED);
      await loadAll();
    }
    applyTheme();
    timer.duration = settings().restSeconds;
    timerShowValue(timer.duration);
    timerLabel();
    try {
      if (!S.meta.lastSnapshotAt || Date.now() - S.meta.lastSnapshotAt > WEEK_MS) await createSnapshot('auto');
    } catch (e) { console.warn('Copie interne impossible', e); }
    const le = S.meta.lastExportAt;
    ui.backupBanner = le ? Date.now() - le > WEEK_MS : S.sets.size > 0;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    const initial = location.hash.slice(1);
    history.replaceState({ carnet: 0 }, '', '#seance');
    switchTab('seance');
    if (TABS.includes(initial) && initial !== 'seance') onTabClick(initial);
  }

  // Petit accès de diagnostic (tests, console) — lecture seule.
  window.CarnetMuscu = {
    stats: () => ({ machines: S.machines.size, sessions: S.sessions.size, sets: S.sets.size, layers: layers.length }),
    todayISO,
  };

  const start = () => init().catch(fatal);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
