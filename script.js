// Estes credencials públiques són les mateixes que utilitza el formulari.
const SUPABASE_URL = 'https://snxkaxlxypmqevfsksul.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dbfGWZXvN3cVWrYNnIE2tg_D-x-siVb';

const FILES_PER_REQUEST = 500;
const RESULTATS_PER_PAGINA = 5;
const TEMPS_MAXIM_CARREGA = 20000;
const DURACIO_RECOMPTE = 900;
const LLAVOR_BLOBS = String(Date.now());
const CATEGORIES = ['General', 'Femení', 'Masculí'];
const CAMPS_PUBLICS = [
  'id', 'nombre', 'genero',
  'bloque1', 'bloque2', 'bloque3', 'bloque4', 'bloque5',
  'bloque6', 'bloque7', 'bloque8', 'bloque9', 'bloque10',
  'via1', 'via2', 'total'
];

const PROBLEMES = [
  ...Array.from({ length: 10 }, (_, index) => ({
    camp: `bloque${index + 1}`,
    etiqueta: `Bloc ${index + 1}`,
    zona: 5,
    top: 15
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    camp: `via${index + 1}`,
    etiqueta: `Via ${index + 1}`,
    zona: 20,
    top: 50
  }))
];

const PAGINES_GRAFIC = [
  PROBLEMES.slice(0, 4),
  PROBLEMES.slice(4, 8),
  PROBLEMES.slice(8, 12)
];

const elements = {
  estatCarrega: document.getElementById('estat-carrega'),
  indicadorCarrega: document.getElementById('indicador-carrega'),
  textEstat: document.getElementById('text-estat'),
  reintentar: document.getElementById('reintentar'),
  contingut: document.getElementById('contingut'),
  senseResultats: document.getElementById('sense-resultats'),
  pestanyes: [...document.querySelectorAll('[role="tab"]')],
  panellRanquing: document.getElementById('panell-ranquing'),
  cosRanquing: document.getElementById('cos-ranquing'),
  paginaRanquing: document.getElementById('pagina-ranquing'),
  ranquingAnterior: document.getElementById('ranquing-anterior'),
  ranquingSeguent: document.getElementById('ranquing-seguent'),
  resumEstadistiques: document.getElementById('resum-estadistiques'),
  totalParticipants: document.getElementById('total-participants'),
  etiquetaParticipants: document.getElementById('etiqueta-participants'),
  puntuacioMitjana: document.getElementById('puntuacio-mitjana'),
  etiquetaMitjana: document.getElementById('etiqueta-mitjana'),
  maximEscala: document.getElementById('maxim-escala'),
  grafic: document.getElementById('grafic'),
  descripcioGrafic: document.getElementById('descripcio-grafic'),
  paginaGrafic: document.getElementById('pagina-grafic'),
  graficAnterior: document.getElementById('grafic-anterior'),
  graficSeguent: document.getElementById('grafic-seguent'),
  anunciCanvis: document.getElementById('anunci-canvis')
};

const formatEnter = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
const ordenaNoms = new Intl.Collator('ca-ES', { sensitivity: 'base', numeric: true });

let resultats = [];
let categoriaActual = 'General';
let paginaRanquingActual = 0;
let paginaGraficActual = 0;
let versioAnimacioEstadistiques = 0;
let observadorEstadistiques = null;
let versioAnimacioGrafic = 0;
let observadorGrafic = null;
let graficVisible = false;

function normalitzaResultat(fila) {
  const resultat = {
    id: String(fila.id ?? ''),
    nombre: String(fila.nombre ?? ''),
    genero: String(fila.genero ?? ''),
    total: Number(fila.total) || 0
  };
  for (const problema of PROBLEMES) {
    resultat[problema.camp] = Number(fila[problema.camp]) || 0;
  }
  return resultat;
}

async function lligResultats() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Falta configurar la connexió amb Supabase.');
  }

  const files = [];
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  const controller = new AbortController();
  const temporitzador = setTimeout(() => controller.abort(), TEMPS_MAXIM_CARREGA);

  try {
    for (let offset = 0; ; offset += FILES_PER_REQUEST) {
      const endpoint = new URL(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/resultados`);
      endpoint.searchParams.set('select', CAMPS_PUBLICS.join(','));
      endpoint.searchParams.set('order', 'id.asc');
      endpoint.searchParams.set('limit', String(FILES_PER_REQUEST));
      endpoint.searchParams.set('offset', String(offset));

      const resposta = await fetch(endpoint, { headers, signal: controller.signal });
      if (!resposta.ok) {
        const detall = await resposta.json().catch(() => ({}));
        console.error('Error de Supabase:', {
          status: resposta.status,
          code: detall.code,
          message: detall.message
        });
        throw new Error(`Supabase ha respost amb l’estat ${resposta.status}.`);
      }

      const pagina = await resposta.json();
      if (!Array.isArray(pagina)) {
        throw new Error('Supabase ha retornat una resposta inesperada.');
      }
      files.push(...pagina);
      if (pagina.length < FILES_PER_REQUEST) break;
    }
  } finally {
    clearTimeout(temporitzador);
  }

  return files.map(normalitzaResultat);
}

function filtraCategoria(categoria) {
  if (categoria === 'General') return [...resultats];
  return resultats.filter(resultat => resultat.genero === categoria);
}

function calculaRanquing(categoria) {
  const ordenats = filtraCategoria(categoria).sort((a, b) =>
    b.total - a.total ||
    ordenaNoms.compare(a.nombre, b.nombre) ||
    a.id.localeCompare(b.id)
  );

  let puntuacioAnterior = null;
  let posicio = 0;
  return ordenats.map(resultat => {
    if (puntuacioAnterior === null || resultat.total !== puntuacioAnterior) {
      posicio += 1;
      puntuacioAnterior = resultat.total;
    }
    return { ...resultat, posicio };
  });
}

function creaCelda(text, classe) {
  const celda = document.createElement('td');
  if (classe) celda.className = classe;
  celda.textContent = text;
  return celda;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function creaGenerador(seedInicial) {
  let seed = seedInicial || 1;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function creaBlobRanquing(resultat) {
  const blob = document.createElement('span');
  blob.className = `blob-ranquing blob-posicio-${resultat.posicio}`;
  blob.setAttribute('aria-hidden', 'true');

  const aleatori = creaGenerador(hashText(`${LLAVOR_BLOBS}-${resultat.id}-${resultat.posicio}`));
  function creaForma() {
    const radis = Array.from({ length: 8 }, () => `${Math.round(15 + aleatori() * 70)}%`);
    return `${radis.slice(0, 4).join(' ')} / ${radis.slice(4).join(' ')}`;
  }

  blob.style.setProperty('--forma-blob-a', creaForma());
  blob.style.setProperty('--forma-blob-b', creaForma());
  blob.style.setProperty('--gir-blob-a', `${Math.round(-18 + aleatori() * 36)}deg`);
  blob.style.setProperty('--gir-blob-b', `${Math.round(-18 + aleatori() * 36)}deg`);
  blob.style.setProperty('--escala-x-blob-a', (0.85 + aleatori() * 0.3).toFixed(2));
  blob.style.setProperty('--escala-y-blob-a', (0.85 + aleatori() * 0.3).toFixed(2));
  blob.style.setProperty('--escala-x-blob-b', (0.85 + aleatori() * 0.3).toFixed(2));
  blob.style.setProperty('--escala-y-blob-b', (0.85 + aleatori() * 0.3).toFixed(2));
  blob.style.setProperty('--retard-blob', `${(-aleatori() * 9).toFixed(2)}s`);
  return blob;
}

function creaCeldaPuntuacio(resultat) {
  const celda = document.createElement('td');
  const contingut = document.createElement('span');
  contingut.className = 'contingut-puntuacio';

  if (resultat.posicio >= 1 && resultat.posicio <= 3) {
    contingut.append(creaBlobRanquing(resultat));
  }

  const puntuacio = document.createElement('span');
  puntuacio.textContent = String(resultat.total);
  contingut.append(puntuacio);
  celda.append(contingut);
  return celda;
}

function renderitzaRanquing(anuncia = false) {
  const ranquing = calculaRanquing(categoriaActual);
  const totalPagines = Math.ceil(ranquing.length / RESULTATS_PER_PAGINA);
  paginaRanquingActual = totalPagines === 0
    ? 0
    : Math.min(paginaRanquingActual, totalPagines - 1);

  elements.cosRanquing.replaceChildren();

  if (ranquing.length === 0) {
    const fila = document.createElement('tr');
    fila.className = 'fila-buida';
    const celda = creaCelda('Encara no hi ha participants en esta categoria.');
    celda.colSpan = 3;
    fila.append(celda);
    elements.cosRanquing.append(fila);
  } else {
    const inici = paginaRanquingActual * RESULTATS_PER_PAGINA;
    const pagina = ranquing.slice(inici, inici + RESULTATS_PER_PAGINA);
    for (const resultat of pagina) {
      const fila = document.createElement('tr');
      fila.append(creaCelda(String(resultat.posicio)));

      const celdaNom = document.createElement('td');
      const nom = document.createElement('span');
      nom.className = 'nom-participant';
      nom.textContent = resultat.nombre;
      nom.title = resultat.nombre;
      celdaNom.append(nom);
      fila.append(celdaNom, creaCeldaPuntuacio(resultat));
      elements.cosRanquing.append(fila);
    }
  }

  const paginaVisible = totalPagines === 0 ? 0 : paginaRanquingActual + 1;
  elements.paginaRanquing.textContent = `${paginaVisible}/${totalPagines}`;
  elements.paginaRanquing.setAttribute('aria-label', `Pàgina ${paginaVisible} de ${totalPagines}`);
  elements.ranquingAnterior.disabled = paginaRanquingActual <= 0;
  elements.ranquingSeguent.disabled = totalPagines === 0 || paginaRanquingActual >= totalPagines - 1;
  elements.panellRanquing.setAttribute('aria-label', `Rànquing ${categoriaActual}`);
  elements.panellRanquing.querySelector('caption').textContent = `Classificació de la categoria ${categoriaActual}`;

  if (anuncia) {
    elements.anunciCanvis.textContent = `${categoriaActual}. Pàgina ${paginaVisible} de ${totalPagines}.`;
  }
}

function seleccionaCategoria(categoria, mouFocus = false) {
  if (!CATEGORIES.includes(categoria)) return;
  categoriaActual = categoria;
  paginaRanquingActual = 0;

  for (const pestanya of elements.pestanyes) {
    const activa = pestanya.dataset.categoria === categoria;
    pestanya.setAttribute('aria-selected', String(activa));
    pestanya.tabIndex = activa ? 0 : -1;
    if (activa) {
      elements.panellRanquing.setAttribute('aria-labelledby', pestanya.id);
      if (mouFocus) pestanya.focus();
    }
  }
  renderitzaRanquing(true);
}

function calculaProblema(problema) {
  let zones = 0;
  let tops = 0;
  for (const resultat of resultats) {
    const puntuacio = resultat[problema.camp];
    if (puntuacio === problema.zona) zones += 1;
    if (puntuacio === problema.top) tops += 1;
  }
  return { ...problema, zones, tops, total: zones + tops };
}

function animaBarresGrafic() {
  versioAnimacioGrafic += 1;
  const versio = versioAnimacioGrafic;
  elements.grafic.classList.remove('grafic-animat');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (versio === versioAnimacioGrafic) {
        elements.grafic.classList.add('grafic-animat');
      }
    });
  });
}

function preparaAnimacioInicialGrafic() {
  versioAnimacioGrafic += 1;
  graficVisible = false;
  elements.grafic.classList.remove('grafic-animat');

  if (observadorGrafic) {
    observadorGrafic.disconnect();
    observadorGrafic = null;
  }

  function iniciaAnimacio() {
    graficVisible = true;
    animaBarresGrafic();
  }

  if (!('IntersectionObserver' in window)) {
    requestAnimationFrame(iniciaAnimacio);
    return;
  }

  const observador = new IntersectionObserver(entrades => {
    if (!entrades.some(entrada => entrada.isIntersecting)) return;
    observador.disconnect();
    if (observadorGrafic === observador) observadorGrafic = null;
    iniciaAnimacio();
  }, { threshold: 0.25 });
  observadorGrafic = observador;
  observador.observe(elements.grafic);
}

function creaBarra(dades, maxim) {
  const item = document.createElement('div');
  item.className = 'barra-item';
  item.setAttribute('role', 'listitem');
  item.setAttribute(
    'aria-label',
    `${dades.etiqueta}: ${dades.zones} en zona, ${dades.tops} en top, ${dades.total} en total.`
  );

  const area = document.createElement('div');
  area.className = 'barra-area';
  const escala = document.createElement('div');
  escala.className = 'barra-escala';

  const percentatge = maxim > 0 ? (dades.total / maxim) * 100 : 0;
  item.style.setProperty('--altura-barra', `${percentatge}%`);
  const total = document.createElement('span');
  total.className = 'total-barra';
  total.textContent = String(dades.total);
  total.setAttribute('aria-hidden', 'true');

  const barra = document.createElement('div');
  barra.className = 'barra-apilada';

  if (dades.tops > 0) {
    const segmentTop = document.createElement('button');
    segmentTop.type = 'button';
    segmentTop.className = 'segment segment-top';
    segmentTop.style.flexGrow = String(dades.tops);
    segmentTop.setAttribute('aria-label', `${dades.etiqueta}, Top: ${dades.tops}`);
    const valorTop = document.createElement('span');
    valorTop.className = 'valor-segment';
    valorTop.textContent = String(dades.tops);
    segmentTop.append(valorTop);
    barra.append(segmentTop);
  }
  if (dades.zones > 0) {
    const segmentZona = document.createElement('button');
    segmentZona.type = 'button';
    segmentZona.className = 'segment segment-zona';
    segmentZona.style.flexGrow = String(dades.zones);
    segmentZona.setAttribute('aria-label', `${dades.etiqueta}, Zona: ${dades.zones}`);
    const valorZona = document.createElement('span');
    valorZona.className = 'valor-segment';
    valorZona.textContent = String(dades.zones);
    segmentZona.append(valorZona);
    barra.append(segmentZona);
  }

  escala.append(total, barra);
  area.append(escala);

  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta-barra';
  etiqueta.textContent = dades.etiqueta;

  item.append(area, etiqueta);
  return item;
}

function renderitzaGrafic(anuncia = false) {
  const problemes = PAGINES_GRAFIC[paginaGraficActual];
  const maxim = resultats.length;
  elements.grafic.replaceChildren(...problemes.map(problema => creaBarra(calculaProblema(problema), maxim)));
  elements.maximEscala.textContent = String(maxim);
  elements.paginaGrafic.textContent = `${paginaGraficActual + 1}/${PAGINES_GRAFIC.length}`;
  elements.paginaGrafic.setAttribute(
    'aria-label',
    `Pàgina ${paginaGraficActual + 1} de ${PAGINES_GRAFIC.length}`
  );
  elements.graficAnterior.disabled = paginaGraficActual === 0;
  elements.graficSeguent.disabled = paginaGraficActual === PAGINES_GRAFIC.length - 1;
  elements.descripcioGrafic.textContent =
    `Gràfic de barres apilades, amb una escala comuna de 0 a ${maxim} participants. ` +
    `Pàgina ${paginaGraficActual + 1} de ${PAGINES_GRAFIC.length}.`;

  if (anuncia) {
    elements.anunciCanvis.textContent =
      `Gràfic. Pàgina ${paginaGraficActual + 1} de ${PAGINES_GRAFIC.length}.`;
  }

  if (graficVisible) animaBarresGrafic();
}

function animaNumero(element, valorFinal, versio) {
  const redueixMoviment = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (redueixMoviment || valorFinal === 0) {
    element.textContent = formatEnter.format(valorFinal);
    return Promise.resolve();
  }

  element.textContent = '0';
  const inici = performance.now();

  return new Promise(resolve => {
    function actualitza(ara) {
      if (versio !== versioAnimacioEstadistiques) {
        resolve();
        return;
      }

      const progres = Math.min((ara - inici) / DURACIO_RECOMPTE, 1);
      const suavitzat = 1 - Math.pow(1 - progres, 3);
      const valorActual = Math.round(valorFinal * suavitzat);
      element.textContent = formatEnter.format(valorActual);

      if (progres < 1) {
        requestAnimationFrame(actualitza);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(actualitza);
  });
}

function animaEstadistica(element, etiqueta, valorFinal, versio) {
  etiqueta.classList.remove('etiqueta-visible');
  animaNumero(element, valorFinal, versio).then(() => {
    if (versio === versioAnimacioEstadistiques) {
      etiqueta.classList.add('etiqueta-visible');
    }
  });
}

function preparaAnimacioEstadistiques(total, mitjana) {
  versioAnimacioEstadistiques += 1;
  const versio = versioAnimacioEstadistiques;

  if (observadorEstadistiques) {
    observadorEstadistiques.disconnect();
    observadorEstadistiques = null;
  }

  elements.totalParticipants.textContent = '0';
  elements.puntuacioMitjana.textContent = '0';
  elements.etiquetaParticipants.classList.remove('etiqueta-visible');
  elements.etiquetaMitjana.classList.remove('etiqueta-visible');

  function iniciaAnimacio() {
    animaEstadistica(elements.totalParticipants, elements.etiquetaParticipants, total, versio);
    animaEstadistica(elements.puntuacioMitjana, elements.etiquetaMitjana, mitjana, versio);
  }

  if (!('IntersectionObserver' in window)) {
    iniciaAnimacio();
    return;
  }

  const observador = new IntersectionObserver(entrades => {
    if (!entrades.some(entrada => entrada.isIntersecting)) return;
    observador.disconnect();
    if (observadorEstadistiques === observador) observadorEstadistiques = null;
    iniciaAnimacio();
  }, { threshold: 0.35 });
  observadorEstadistiques = observador;
  observador.observe(elements.resumEstadistiques);
}

function renderitzaEstadistiques() {
  const total = resultats.length;
  const suma = resultats.reduce((acumulat, resultat) => acumulat + resultat.total, 0);
  const mitjana = total > 0 ? Math.round(suma / total) : 0;
  preparaAnimacioEstadistiques(total, mitjana);
  preparaAnimacioInicialGrafic();
  renderitzaGrafic();
}

function renderitzaTot() {
  elements.senseResultats.hidden = resultats.length !== 0;
  renderitzaRanquing();
  renderitzaEstadistiques();
}

function mostraCarrega() {
  elements.contingut.hidden = true;
  elements.estatCarrega.hidden = false;
  elements.estatCarrega.classList.add('estat-carrega-actiu');
  elements.estatCarrega.classList.remove('missatge-error');
  elements.estatCarrega.setAttribute('aria-busy', 'true');
  elements.indicadorCarrega.hidden = false;
  elements.textEstat.classList.add('visually-hidden');
  elements.textEstat.textContent = 'Carregant resultats…';
  elements.reintentar.hidden = true;
}

function mostraError(error) {
  console.error('No s’han pogut carregar els resultats:', error);
  elements.estatCarrega.classList.remove('estat-carrega-actiu');
  elements.estatCarrega.classList.add('missatge-error');
  elements.estatCarrega.removeAttribute('aria-busy');
  elements.indicadorCarrega.hidden = true;
  elements.textEstat.classList.remove('visually-hidden');
  elements.textEstat.textContent = error.name === 'AbortError'
    ? 'La connexió ha tardat massa. Torna-ho a provar.'
    : 'No s’han pogut carregar els resultats. Comprova la connexió i torna-ho a provar.';
  elements.reintentar.hidden = false;
}

async function carrega() {
  mostraCarrega();
  try {
    resultats = await lligResultats();
    paginaRanquingActual = 0;
    paginaGraficActual = 0;
    renderitzaTot();
    elements.estatCarrega.hidden = true;
    elements.estatCarrega.removeAttribute('aria-busy');
    elements.contingut.hidden = false;
  } catch (error) {
    mostraError(error);
  }
}

for (const pestanya of elements.pestanyes) {
  pestanya.addEventListener('click', () => seleccionaCategoria(pestanya.dataset.categoria));
  pestanya.addEventListener('keydown', event => {
    const index = CATEGORIES.indexOf(pestanya.dataset.categoria);
    let nouIndex = null;
    if (event.key === 'ArrowRight') nouIndex = (index + 1) % CATEGORIES.length;
    if (event.key === 'ArrowLeft') nouIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    if (event.key === 'Home') nouIndex = 0;
    if (event.key === 'End') nouIndex = CATEGORIES.length - 1;
    if (nouIndex !== null) {
      event.preventDefault();
      seleccionaCategoria(CATEGORIES[nouIndex], true);
    }
  });
}

elements.ranquingAnterior.addEventListener('click', () => {
  if (paginaRanquingActual > 0) {
    paginaRanquingActual -= 1;
    renderitzaRanquing(true);
  }
});

elements.ranquingSeguent.addEventListener('click', () => {
  const totalPagines = Math.ceil(calculaRanquing(categoriaActual).length / RESULTATS_PER_PAGINA);
  if (paginaRanquingActual < totalPagines - 1) {
    paginaRanquingActual += 1;
    renderitzaRanquing(true);
  }
});

elements.graficAnterior.addEventListener('click', () => {
  if (paginaGraficActual > 0) {
    paginaGraficActual -= 1;
    renderitzaGrafic(true);
  }
});

elements.graficSeguent.addEventListener('click', () => {
  if (paginaGraficActual < PAGINES_GRAFIC.length - 1) {
    paginaGraficActual += 1;
    renderitzaGrafic(true);
  }
});

elements.grafic.addEventListener('click', event => {
  const segment = event.target.closest('.segment');
  if (!segment) return;
  const jaEstavaActiu = segment.classList.contains('segment-actiu');
  for (const segmentActiu of elements.grafic.querySelectorAll('.segment-actiu')) {
    segmentActiu.classList.remove('segment-actiu');
  }
  if (!jaEstavaActiu) segment.classList.add('segment-actiu');
});

elements.reintentar.addEventListener('click', carrega);

carrega();
