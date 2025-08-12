// app.js — RIN v2 (Supabase) — Tema Claro + Modo Gestor + Exportar CSV (Otimizado para Mobile)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ====== CONFIG ================================================================================
// Preencha com suas credenciais do Supabase (Project Settings → API)
const SUPABASE_URL =
  (window.__ENV && window.__ENV.VITE_SUPABASE_URL) ||
  'https://slrjqqzzxxpywquphvjz.supabase.co'; // <-- troque

const SUPABASE_ANON_KEY =
  (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmpxcXp6eHhweXdxdXBodmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTYyMjksImV4cCI6MjA3MDI3MjIyOX0.JuzZMOC2X4NQUXeVdYBoQDY5pN-2O2igPK0zjNdcjcU'; // <-- troque

// PIN simples para liberar UI de Gestor (apenas ocultação de UI)
const GESTOR_PIN = '3461'; // <-- troque

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== ESTADO ================================================================================
let currentView = 'producao';
let allItems = [];
let filtered = [];
let staged = new Map();  // id -> { status }
let selected = new Set();
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
const $exportCsv = document.getElementById('exportCsv');

const $adminBtn = document.getElementById('adminBtn');
const $adminBadge = document.getElementById('adminBadge');

// ====== HELPERS ===============================================================================
const statusToEmoji = (s) => {
  switch (s) {
    case 'OK': return { label: 'OK', cls: 'ok', next: 'ALERTA' };
    case 'ALERTA': return { label: '⚠ Alerta', cls: 'warn', next: 'FALTA' };
    case 'FALTA': return { label: '❌ Falta', cls: 'bad', next: 'OK' };
    default: return { label: s, cls: '', next: 'OK' }; // Default para OK
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
  n.style.bottom = '24px';
  n.style.background = '#111827';
  n.style.color = '#f8fafc';
  n.style.border = '1px solid #1f2937';
  n.style.borderRadius = '10px';
  n.style.padding = '8px 12px';
  n.style.boxShadow = '0 6px 20px rgba(0,0,0,.20)';
  n.style.zIndex = '9999';
  n.style.opacity = '0'; // Começa transparente
  n.style.transition = 'opacity 0.3s ease-in-out'; // Transição suave
  document.body.appendChild(n);
  
  // Animação de entrada
  requestAnimationFrame(() => {
    n.style.opacity = '1';
  });

  setTimeout(() => {
    n.style.opacity = '0'; // Animação de saída
    setTimeout(() => n.remove(), 300); // Remove depois da transição
  }, 1600);
}

function updateSaveButton() {
  const n = staged.size;
  $save.textContent = n ? `Salvar alterações (${n})` : 'Salvar alterações';
  $save.disabled = n === 0;
}

function updateGestorUI() {
  if ($addForm) $addForm.style.display = isGestor ? 'grid' : 'none';
  if ($adminBadge) $adminBadge.style.display = isGestor ? 'inline-block' : 'none';
  if ($adminBtn) $adminBtn.textContent = isGestor ? 'Sair do modo Gestor' : 'Entrar como Gestor';
}

function applyFilters() {
  const q = normalize($search?.value);
  const f = $filter?.value || 'TODOS';

  let rows = allItems.slice();

  if (currentView === 'compras') {
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
    card.dataset.id = item.id; // Adiciona ID para facilitar a seleção e referência

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
      // Opcional: Adicionar classe para visual de selecionado no card
      card.classList.toggle('selected', e.target.checked);
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
    
    // TORNA O PILL CLICÁVEL PARA CICLAR STATUS
    pill.addEventListener('click', () => {
      const currentStatus = staged.get(item.id)?.status || item.status;
      const nextStatus = statusToEmoji(currentStatus).next; // Obtém o próximo status do helper
      stageStatus(item.id, nextStatus);
    });

    statusRow.appendChild(pill);

    // REMOVIDO: botões individuais de OK/Alerta/Falta para mobile
    // const btns = document.createElement('div');
    // btns.className = 'btnbar';
    // ... (restante dos botões individuais removido)
    // card.appendChild(btns);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(statusRow);
    // Btns já foram removidos

    $list.appendChild(card);
  }
}

// ====== MUTAÇÕES LOCAIS ========================================================================
function stageStatus(id, status) {
  const current = staged.get(id) || {};
  staged.set(id, { ...current, status });
  updateSaveButton();
  render(); // Re-renderiza para atualizar o visual do pill
}

function bulkStage(status) {
  if (selected.size === 0) {
    notify('Nenhum item selecionado!');
    return;
  }
  for (const id of selected) stageStatus(id, status);
  updateSaveButton();
  render(); // Re-renderiza para atualizar os cards
}

// ====== SUPABASE – CRUD ========================================================================
async function fetchItems() {
  const { data, error } = await supabase
    .from('itens')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar itens:', error);
    notify('Erro ao carregar itens.');
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
    alert('Não consegui adicionar o item. Veja o console para detalhes.');
    return null;
  }
  allItems.push(data);
  allItems.sort((a,b)=> a.nome.localeCompare(b.nome));
  render();
  notify('Item adicionado!');
  return data;
}

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

    // Após salvar, buscar os itens novamente para refletir o estado do banco
    await fetchItems(); 
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

// ====== EXPORTAR CSV ===========================================================================
// Gera CSV dos itens que **aparecem na tela** se você estiver em "Compras",
// ou de todos em ALERTA/FALTA se estiver em "Produção".
function buildCsvRows() {
  // Se estiver na aba Compras, o filtro já remove OK — então exporta 'filtered'.
  if (currentView === 'compras') return filtered.slice();

  // Na aba Produção, exporta apenas ALERTA/FALTA (independente do select 'Todos').
  // Considera o estado atual do item (staged ou DB)
  return (filtered.length ? filtered : allItems).filter(
    r => (staged.get(r.id)?.status || r.status) !== 'OK'
  );
}

function toCsv(rows) {
  const header = ['nome','categoria','unidade','parMin','status'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    // Adiciona aspas se o valor contiver vírgula, ponto e vírgula, aspas ou nova linha
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = [header.map(esc).join(';')]; // Garante que o cabeçalho também seja escapado
  for (const r of rows) {
    const status = staged.get(r.id)?.status || r.status;
    lines.push([r.nome, r.categoria || '', r.unidade || '', r.parMin ?? '', status].map(esc).join(';'));
  }
  return lines.join('\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = buildCsvRows();
  if (!rows.length) { notify('Nada para exportar'); return; }
  const csv = toCsv(rows);
  const stamp = new Date().toISOString().slice(0,10);
  download(`lista-compras-${stamp}.csv`, csv);
  notify('CSV gerado');
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
$search?.addEventListener('input', render);
$filter?.addEventListener('change', render);
$refresh?.addEventListener('click', fetchItems);

$markOk.addEventListener('click', () => bulkStage('OK'));
$markWarn.addEventListener('click', () => bulkStage('ALERTA'));
$markBad.addEventListener('click', () => bulkStage('FALTA'));
$save.addEventListener('click', saveStaged);
$exportCsv.addEventListener('click', exportCsv);

// Form (Gestor)
$addForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isGestor) { alert('Somente Gestor pode adicionar itens.'); return; }
  const payload = {
    nome: ($nome.value || '').trim(),
    categoria: ($categoria.value || '').trim() || null,
    unidade: ($unidade.value || '').trim() || null,
    parMin: $parMin.value ? Number($parMin.value) : null,
    status: 'OK'
  };
  if (!payload.nome) {
    notify('O nome do item é obrigatório!');
    $nome.focus();
    return;
  }
  await addItem(payload);
  $addForm.reset();
  $nome.focus();
});

// Modo Gestor
$adminBtn?.addEventListener('click', () => {
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
