// app.js
// Import dinâmico do supabase-js (ESM via esm.sh)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==== CONFIG ====================================================================================
const SUPABASE_URL = (window.__ENV && window.__ENV.VITE_SUPABASE_URL) || 'https://slrjqqzzxxpywquphvjz.supabase.co';
const SUPABASE_ANON_KEY = (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmpxcXp6eHhweXdxdXBodmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTYyMjksImV4cCI6MjA3MDI3MjIyOX0.JuzZMOC2X4NQUXeVdYBoQDY5pN-2O2igPK0zjNdcjcU
';

if (SUPABASE_URL.startsWith('COLOQUE') || SUPABASE_ANON_KEY.startsWith('COLOQUE')) {
  console.warn('Defina SUPABASE_URL e SUPABASE_ANON_KEY antes de publicar.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==== ESTADO ====================================================================================
let currentView = 'producao'; // 'producao' | 'compras'
let allItems = [];
let filtered = [];
let staged = new Map(); // id -> { status }
let selected = new Set(); // ids selecionados

// ==== ELEMENTOS =================================================================================
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

// ==== HELPERS ===================================================================================
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

function applyFilters() {
  const q = normalize($search.value);
  const f = $filter.value; // TODOS | OK | ALERTA | FALTA

  let rows = allItems.slice();

  if (currentView === 'compras') {
    // Em "Compras", mostramos só o que está ruim: ALERTA ou FALTA
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

function stageStatus(id, status) {
  const current = staged.get(id) || {};
  staged.set(id, { ...current, status });
  render();
}

// ==== SUPABASE – CRUD ===========================================================================
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

async function saveStaged() {
  if (staged.size === 0) return;

  const updates = [];
  for (const [id, patch] of staged.entries()) {
    updates.push({ id, ...patch });
  }

  const { data, error } = await supabase
    .from('itens')
    .upsert(updates, { onConflict: 'id' }) // atualiza pela PK
    .select();

  if (error) {
    console.error('Erro ao salvar alterações:', error);
    return;
  }

  // Sincroniza estado local
  for (const row of data) {
    const idx = allItems.findIndex(i => i.id === row.id);
    if (idx >= 0) allItems[idx] = { ...allItems[idx], ...row };
  }
  staged.clear();
  selected.clear();
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
    return null;
  }
  allItems.push(data);
  allItems.sort((a,b)=> a.nome.localeCompare(b.nome));
  render();
  return data;
}

function bulkStage(status) {
  for (const id of selected) {
    stageStatus(id, status);
  }
}

// ==== EVENTOS ===================================================================================
$tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    $tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentView = tab.dataset.view;
    render();
  });
});

$search.addEventListener('input', render);
$filter.addEventListener('change', render);
$refresh.addEventListener('click', fetchItems);

$markOk.addEventListener('click', () => bulkStage('OK'));
$markWarn.addEventListener('click', () => bulkStage('ALERTA'));
$markBad.addEventListener('click', () => bulkStage('FALTA'));
$save.addEventListener('click', saveStaged);

$addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    nome: $nome.value.trim(),
    categoria: $categoria.value.trim() || null,
    unidade: $unidade.value.trim() || null,
    parMin: $parMin.value ? Number($parMin.value) : null,
    status: 'OK'
  };
  if (!payload.nome) return;
  await addItem(payload);
  $addForm.reset();
  $nome.focus();
});

// ==== BOOT ======================================================================================
fetchItems();

