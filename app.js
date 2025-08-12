// app.js — RIN v2 (Supabase) + Modo Gestor + Banner de erro

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ====== CONFIG ================================================================================
// TROQUE pelas SUAS credenciais reais (Project Settings → API)
// Formato da URL: https://xxxxxxxxxxxx.supabase.co  (sem barra no final)
const SUPABASE_URL =
  (window.__ENV && window.__ENV.VITE_SUPABASE_URL) ||
  'https://slrjqqzzxxpywquphvjz.supabase.co'; // << TROCAR

// ANON PUBLIC KEY (começa com "eyJhbGciOi...")
const SUPABASE_ANON_KEY =
  (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmpxcXp6eHhweXdxdXBodmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTYyMjksImV4cCI6MjA3MDI3MjIyOX0.JuzZMOC2X4NQUXeVdYBoQDY5pN-2O2igPK0zjNdcjcU'; // << TROCAR

// Opcional: PIN simples de Gestor (apenas para ocultar UI no front)
const GESTOR_PIN = '3461'; // troque se quiser

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

// ====== BANNER DE ERRO =========================================================================
let $errorBar;
function showErrorBar(msg) {
  if (!$errorBar) {
    $errorBar = document.createElement('div');
    $errorBar.style.position = 'fixed';
    $errorBar.style.left = '0';
    $errorBar.style.right = '0';
    $errorBar.style.bottom = '0';
    $errorBar.style.padding = '10px 14px';
    $errorBar.style.background = '#3b1d1d';
    $errorBar.style.borderTop = '1px solid #5b3030';
    $errorBar.style.color = '#fca5a5';
    $errorBar.style.fontSize = '14px';
    $errorBar.style.zIndex = '9999';
    $errorBar.style.display = 'flex';
    $errorBar.style.justifyContent = 'space-between';
    const btn = document.createElement('button');
    btn.textContent = 'Tentar novamente';
    btn.style.border = '1px solid #8b4c4c';
    btn.style.background = '#522626';
    btn.style.color = '#ffd9d9';
    btn.style.borderRadius = '8px';
    btn.style.padding = '6px 10px';
    btn.addEventListener('click', fetchItems);
    $errorBarBtn = btn;
    const span = document.createElement('span');
    span.id = 'errText';
    $errorBar.appendChild(span);
    $errorBar.appendChild(btn);
    document.body.appendChild($errorBar);
  }
  $errorBar.querySelector('#errText').textContent = msg;
  $errorBar.style.display = 'flex';
}
function hideErrorBar() {
  if ($errorBar) $errorBar.style.display = 'none';
}

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
  n.style.back
