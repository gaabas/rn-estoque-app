// app.js — RIN v2 (Supabase) + Modo Gestor

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ====== CONFIG ================================================================================
// Troque URL e ANON KEY pelas suas (ou injete via window.__ENV, se preferir).
const SUPABASE_URL =
  (window.__ENV && window.__ENV.VITE_SUPABASE_URL) ||
  'https://slrjqqzzxxpywquphvjz.supabase.co';

const SUPABASE_ANON_KEY =
  (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmpxcXp6eHhweXdxdXBodmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTYyMjksImV4cCI6MjA3MDI3MjIyOX0.JuzZMOC2X4NQUXeVdYBoQDY5pN-2O2igPK0zjNdcjcU';

// PIN simples de gestor (MVP). Guarde isso fora do código depois.
const GESTOR_PIN = '3461'; // <<< troque

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== ESTADO ================================================================================
let currentView = 'producao';
let allItems = [];
let filtered = [];
let staged = new Map(); // id -> { status }
let selected = new Set(); // ids selecionados
let isGestor = !!localStorage.getItem('rin_is_gestor');

// ====== ELEMENTOS =============================================================================
const $tabs = document.querySelectorAll('.tab');
const $search = document.getElementById('search');
const $filter = document.getElementById('filter');
const $refresh = document.getElementById('refresh');
const $list = document.getElementById('list');
const $empty = document.getElementById('empty');
const $addForm = document.getElementById('addForm');
const $nome = document.getElementById('nome');
const $categoria = document.getElementById('categoria');
const $unidade = document.getElementById('unidade');
const $parMin = document.getElementById('parMin');

const $markOk = document.getElementById('markOk');
const $markWarn = document.getElementById('markWarn');
const $markBad = document.getElementById('markBad');
const $save = document.getElementById('save');

const $adminBtn = document.getElementById('adminBtn');
const $adminBadge = document.getElementById('adminBadge');

// ====== HELPERS ===============================================================================
const statusToEmoji = (s) => {
  switch (s) {
    case 'OK': return { label: 'OK', cls: 'ok' };
    case 'ALERTA': return { label: '⚠ alerta', cls: 'warn' };
    case 'FALTA': return { label: '❌ falta', cls: 'bad' };
    default: return { label: s, cls: '' };
  }
};

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function notify(msg) {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.position = 'fixed';
  n.style.right = '16px';
  n.style.bottom = '72px';
  n.style.background = '#1a2230';
  n.style.border = '1px solid #2b3545';
  n.style.borderRadius = '10px';
  n.style.padding = '8px 12px';
  n.style.boxShadow = '0 6px 20px rgba(0,0,0,.35)';
  n.style.zIndex = '9999';
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1600);
}

function updateSaveButton() {
  const n = staged.size;
  $save.textContent = n ? `Salvar alterações (${n})` : 'Salvar alterações';
  $save.disabled = n === 0;
}

function updateGestorUI() {
  if (isGestor) {
    $addForm.style.display = 'grid';
    $adminBadge.style.display = 'inline-block';
    $adminBtn.textContent = 'Sair do modo Gestor';
  } else {
    $addForm.style.display = 'none';
    $adminBadge.style.display = 'none';
    $adminBtn.textContent = 'Entrar como Gestor';
  }
}

function applyFilters() {
  const q = normalize($search.value);
  const f = $filter.value; // TODOS | OK | ALERTA | FALTA

  let rows = allItems.slice();

  if (currentView === 'compras') {
    // Em "Compras", só o que NÃO está OK
    rows = rows.filter(r => (staged.get(r.id)?.status || r.status) !== 'OK');
  }

  if (f !== 'TODOS') {
    rows = rows.filter(r => (staged.get(r.id)?.status || r.status) === f);
  }

  if (q) {
    rows = rows.filter(r =>
      normalize(r.nome).includes(q) ||
      normalize(r.categoria).includes(q) ||
      normalize(r.unidade).includes(q)
    );
  }

  filtered = rows;
}

function render() {
  applyFilters();
  $list.innerHTML = '';
  if (filtered.length === 0) {
    $empty.style.display = 'block';
    return;
  }
  $empty.style.display = 'none';

  for (const item of filtered) {
    const effectiveStatus = staged.get(item.id)?.status || item.status;
    const s = statusToEmoji(effectiveStatus);

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.nome;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(item.id);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) selected.add(item.id);
      else selected.delete(item.id);
    });

    header.appendChild(name);
    header.appendChild(checkbox);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <span>${item.categoria || '–'}</span>
      <span>•</span>
      <span>${item.unidade || '–'}</span>
      <span>•</span>
      <span>par mín.: ${item.parMin ?? '–'}</span>
    `;

    const statusRow = document.createElement('div');
    statusRow.className = 'status';
    const pill = document.createElement('span');
    pill.className = `pill ${s.cls}`;
    pill.textContent = s.label;
    statusRow.appendChild(pill);

    const btns = document.createElement('div');
    btns.className = 'btnbar';

    const bOk = document.createElement('button');
    bOk.textContent = 'OK';
    bOk.addEventListener('click', () => { stageStatus(item.id, 'OK'); });

    const bWarn = document.createElement('button');
    bWarn.textContent = '⚠ Alerta';
    bWarn.addEventListener('click', () => { stageStatus(item.id, 'ALERTA'); });

    const bBad = document.createElement('button');
    bBad.textContent = '❌ Falta';
    bBad.addEventListener('click', () => { stageStatus(item.id, 'FALTA'); });

    btns.appendChild(bOk);
    btns.appendChild(bWarn);
    btns.appendChild(bBad);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(statusRow);
    card.appendChild(btns);

    $list.appendChild(card);
  }
}

// ====== MUTAÇÕES LOCAIS ========================================================================
function stageStatus(id, status) {
  const current = staged.get(id) || {};
  staged.set(id, { ...current, status });
  updateSaveButton();
  render();
}

function bulkStage(status) {
  for (const id of selected) stageStatus(id, status);
  updateSaveButton();
}

// ====== SUPABASE – CRUD ========================================================================
async function fetchItems() {
  const { data, error } = await supabase
    .from('itens')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar itens:', error);
    return;
  }
  allItems = data || [];
  render();
}

async function addItem(payload) {
  const { data, error } = await supabase
    .from('itens')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Erro ao adicionar item:', error);
    alert('Não consegui adicionar o item.');
    return null;
  }
  allItems.push(data);
  allItems.sort((a,b)=> a.nome.localeCompare(b.nome));
  render();
  return data;
}

// Atualiza status por ID (mais previsível que upsert)
async function saveStaged() {
  if (staged.size === 0) return;

  $save.disabled = true;
  const originalLabel = $save.textContent;
  $save.textContent = 'Salvando…';

  try {
    const ops = [];
    for (const [id, patch] of staged.entries()) {
      ops.push(
        supabase.from('itens').update(patch).eq('id', id).select().single()
      );
    }

    const results = await Promise.all(ops);
    const failed = results.find(r => r && r.error);

    if (failed) {
      console.error('Falha ao salvar:', failed.error);
      alert('Não consegui salvar algumas alterações. Veja o console (F12).');
      return;
    }

    await fetchItems();   // garante estado sincronizado
    staged.clear();
    selected.clear();
    notify('Alterações salvas');
  } catch (e) {
    console.error('Erro inesperado no save:', e);
    alert('Erro inesperado ao salvar. Veja o console.');
  } finally {
    $save.disabled = false;
    $save.textContent = originalLabel;
    updateSaveButton();
  }
}

// ====== EVENTOS ================================================================================
// Tabs
$tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    $tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentView = tab.dataset.view;
    render();
  });
});

// Filtros e ações
$search.addEventListener('input', render);
$filter.addEventListener('change', render);
$refresh.addEventListener('click', fetchItems);

$markOk.addEventListener('click', () => bulkStage('OK'));
$markWarn.addEventListener('click', () => bulkStage('ALERTA'));
$markBad.addEventListener('click', () => bulkStage('FALTA'));
$save.addEventListener('click', saveStaged);

// Form (apenas se Gestor estiver ativo e o form visível)
$addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isGestor) { alert('Somente Gestor pode adicionar itens.'); return; }
  const payload = {
    nome: ($nome.value || '').trim(),
    categoria: ($categoria.value || '').trim() || null,
    unidade: ($unidade.value || '').trim() || null,
    parMin: $parMin.value ? Number($parMin.value) : null,
    status: 'OK'
  };
  if (!payload.nome) return;
  await addItem(payload);
  $addForm.reset();
  $nome.focus();
});

// Modo Gestor
$adminBtn.addEventListener('click', () => {
  if (isGestor) {
    isGestor = false;
    localStorage.removeItem('rin_is_gestor');
    updateGestorUI();
    notify('Saiu do modo Gestor');
    return;
  }
  const pin = prompt('PIN do Gestor:');
  if (pin === GESTOR_PIN) {
    isGestor = true;
    localStorage.setItem('rin_is_gestor', '1');
    updateGestorUI();
    notify('Modo Gestor ativado');
  } else if (pin !== null) {
    alert('PIN incorreto.');
  }
});

// ====== BOOT ===================================================================================
updateGestorUI();
updateSaveButton();
fetchItems();
