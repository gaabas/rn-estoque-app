// =================================================================
// !!! CONFIGURAÇÃO OBRIGATÓRIA !!!
// =================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyIMJjpuzSRo8qAbyPKwxOsBkIBFGXF_61LQBe-D2P0aji7t7kx_Do7IA5-9TM-5aa-lw/exec";
const API_KEY = "teste123";
// =================================================================

let allItems = []; let localChanges = {};
const itemListEl = document.getElementById('item-list'); const sendBtnEl = document.getElementById('send-batch-btn'); const userSelectorEl = document.getElementById('user');
document.addEventListener('DOMContentLoaded', initializeApp);
function initializeApp() { loadLocalChanges(); fetchData(); sendBtnEl.addEventListener('click', sendBatch); }

// O TRUQUE SUJO PARA CONTORNAR O BUG DO GOOGLE
async function apiCall(payload) {
    // A chave agora vai dentro do corpo da requisição
    const body = JSON.stringify({ ...payload, apiKey: API_KEY });

    const response = await fetch(API_URL, {
        method: 'POST',
        // O header é text/plain para evitar a pergunta de permissão (preflight)
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        mode: 'cors' // Mantemos o modo cors
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `Erro HTTP ${response.status}` }));
        throw new Error(err.error || `Erro desconhecido`);
    }
    return response.json();
}

async function fetchData() {
    itemListEl.innerHTML = '<p class="loading-message">Carregando itens...</p>';
    try {
        const data = await apiCall({ action: 'fetchData' });
        const { items, pendencias } = data;
        allItems = items.map(item => { const pendencia = pendencias.find(p => p.itemId === item.id); return { ...item, status: pendencia ? pendencia.status : 'OK', nota: pendencia ? pendencia.nota : '' }; });
        renderItems(); updateSendButtonVisibility();
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        itemListEl.innerHTML = `<p class="loading-message" style="color:red;">Erro ao carregar: ${error.message}.</p>`;
    }
}

async function sendBatch() {
    if (Object.keys(localChanges).length === 0) return;
    sendBtnEl.textContent = '...'; sendBtnEl.disabled = true;
    const entries = Object.keys(localChanges).map(itemId => ({ itemId: itemId, status: localChanges[itemId].status }));
    try {
        await apiCall({ action: 'submitBatch', user: userSelectorEl.value, entries: entries, batchId: crypto.randomUUID(), sentAt: new Date().toISOString() });
        alert('Alterações enviadas com sucesso!');
        localChanges = {}; clearLocalChanges(); updateSendButtonVisibility(); await fetchData();
    } catch (error) {
        console.error("Erro ao enviar lote:", error);
        alert(`Falha ao enviar: ${error.message}.`);
    } finally {
        sendBtnEl.innerHTML = '<span>&#10148;</span>'; sendBtnEl.disabled = false;
    }
}

// --- Funções de renderização sem mudanças ---
function renderItems() { itemListEl.innerHTML = ''; allItems.forEach(item => { const localStatus = localChanges[item.id]?.status; const currentStatus = localStatus || item.status; const card = document.createElement('div'); card.className = 'item-card'; card.id = `card-${item.id}`; card.classList.add(`status-${currentStatus.toLowerCase()}`); card.innerHTML = `<div class="item-info"><h2>${item.nome}</h2><p>${item.categoria} (Par Mínimo: ${item.parMin} ${item.unidade})</p></div><div class="status-buttons" data-item-id="${item.id}"><button class="btn-ok ${currentStatus === 'OK' ? 'active' : ''}" data-status="OK">✓</button><button class="btn-pp ${currentStatus === 'PP' ? 'active' : ''}" data-status="PP">⚠</button><button class="btn-falta ${currentStatus === 'FALTA' ? 'active' : ''}" data-status="FALTA">❌</button></div>`; itemListEl.appendChild(card); }); itemListEl.addEventListener('click', handleStatusClick); }
function handleStatusClick(e) { const button = e.target.closest('button[data-status]'); if (!button) return; const { itemId, status: newStatus } = button.dataset; localChanges[itemId] = { status: newStatus }; saveLocalChanges(); updateCardUI(itemId, newStatus); updateSendButtonVisibility(); }
function updateCardUI(itemId, newStatus) { const card = document.getElementById(`card-${itemId}`); if (!card) return; const buttonContainer = card.querySelector('.status-buttons'); card.className = 'item-card'; card.classList.add(`status-${newStatus.toLowerCase()}`); buttonContainer.querySelectorAll('button').forEach(btn => { btn.classList.remove('active'); if (btn.dataset.status === newStatus) { btn.classList.add('active'); } }); }
function saveLocalChanges() { localStorage.setItem('rinEstoqueRascunho', JSON.stringify(localChanges)); }
function loadLocalChanges() { const saved = localStorage.getItem('rinEstoqueRascunho'); if (saved) { localChanges = JSON.parse(saved); } }
function clearLocalChanges() { localStorage.removeItem('rinEstoqueRascunho'); }
function updateSendButtonVisibility() { if (Object.keys(localChanges).length > 0) { sendBtnEl.classList.remove('hidden'); } else { sendBtnEl.classList.add('hidden'); } }
