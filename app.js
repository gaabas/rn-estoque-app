// =================================================================
// !!! CONFIGURAÇÃO OBRIGATÓRIA !!!
// =================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxSNocS9te3T03z7H1MgySs1FGL-PqGMbitd_-27sYGXrBkcRUNW15vZ7V_PdPFANZ7/exec";
const API_KEY = "aSdAPIeh3461!laksokekekeodod";
// =================================================================

let allItems = [];
let localChanges = {};

const itemListEl = document.getElementById('item-list');
const sendBtnEl = document.getElementById('send-batch-btn');
const userSelectorEl = document.getElementById('user');

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    loadLocalChanges();
    fetchData();
    sendBtnEl.addEventListener('click', sendBatch);
}

async function fetchData() {
    itemListEl.innerHTML = '<p class="loading-message">Carregando itens...</p>';
    try {
        const [itemsRes, pendenciasRes] = await Promise.all([
            fetch(`${API_URL}?apiKey=${API_KEY}&path=itens`),
            fetch(`${API_URL}?apiKey=${API_KEY}&path=pendencias`)
        ]);

        if (!itemsRes.ok) throw new Error(`Falha ao buscar itens: ${itemsRes.statusText}`);
        if (!pendenciasRes.ok) throw new Error(`Falha ao buscar pendências: ${pendenciasRes.statusText}`);
        
        const items = await itemsRes.json();
        const pendencias = await pendenciasRes.json();

        allItems = items.map(item => {
            const pendencia = pendencias.find(p => p.itemId === item.id);
            return {
                ...item,
                status: pendencia ? pendencia.status : 'OK',
                nota: pendencia ? pendencia.nota : ''
            };
        });
        
        renderItems();
        updateSendButtonVisibility();

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        itemListEl.innerHTML = `<p class="loading-message" style="color:red;">Erro ao carregar: ${error.message}. Verifique a conexão e a configuração da API no console (F12).</p>`;
    }
}

function renderItems() {
    itemListEl.innerHTML = '';
    allItems.forEach(item => {
        const localStatus = localChanges[item.id]?.status;
        const currentStatus = localStatus || item.status;
        
        const card = document.createElement('div');
        card.className = 'item-card';
        card.id = `card-${item.id}`;
        card.classList.add(`status-${currentStatus.toLowerCase()}`);
        
        card.innerHTML = `
            <div class="item-info">
                <h2>${item.nome}</h2>
                <p>${item.categoria} (Par Mínimo: ${item.parMin} ${item.unidade})</p>
            </div>
            <div class="status-buttons" data-item-id="${item.id}">
                <button class="btn-ok ${currentStatus === 'OK' ? 'active' : ''}" data-status="OK">✓</button>
                <button class="btn-pp ${currentStatus === 'PP' ? 'active' : ''}" data-status="PP">⚠</button>
                <button class="btn-falta ${currentStatus === 'FALTA' ? 'active' : ''}" data-status="FALTA">❌</button>
            </div>
        `;
        itemListEl.appendChild(card);
    });
    itemListEl.addEventListener('click', handleStatusClick);
}

function handleStatusClick(e) {
    const button = e.target.closest('button[data-status]');
    if (!button) return;

    const { itemId, status: newStatus } = button.dataset;
    
    localChanges[itemId] = { status: newStatus };
    saveLocalChanges();
    
    updateCardUI(itemId, newStatus);
    updateSendButtonVisibility();
}

function updateCardUI(itemId, newStatus) {
    const card = document.getElementById(`card-${itemId}`);
    if (!card) return;
    const buttonContainer = card.querySelector('.status-buttons');
    
    card.className = 'item-card';
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    buttonContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === newStatus) {
            btn.classList.add('active');
        }
    });
}

async function sendBatch() {
    if (Object.keys(localChanges).length === 0) return;

    sendBtnEl.textContent = '...';
    sendBtnEl.disabled = true;

    const entries = Object.keys(localChanges).map(itemId => ({
        itemId: itemId,
        status: localChanges[itemId].status
    }));

    const payload = {
        user: userSelectorEl.value,
        area: "PRODUCAO",
        entries: entries,
        batchId: crypto.randomUUID(),
        sentAt: new Date().toISOString()
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Erro desconhecido no servidor" }));
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        const result = await response.json();
        console.log('Resposta do servidor:', result);
        
        alert('Alterações enviadas com sucesso!');
        localChanges = {};
        clearLocalChanges();
        updateSendButtonVisibility();
        await fetchData();

    } catch (error) {
        console.error("Erro ao enviar lote:", error);
        alert(`Falha ao enviar: ${error.message}. Suas alterações continuam salvas. Tente novamente.`);
    } finally {
        sendBtnEl.innerHTML = '<span>&#10148;</span>';
        sendBtnEl.disabled = false;
    }
}

function saveLocalChanges() {
    localStorage.setItem('rinEstoqueRascunho', JSON.stringify(localChanges));
}

function loadLocalChanges() {
    const saved = localStorage.getItem('rinEstoqueRascunho');
    if (saved) {
        localChanges = JSON.parse(saved);
    }
}

function clearLocalChanges() {
    localStorage.removeItem('rinEstoqueRascunho');
}

function updateSendButtonVisibility() {
    if (Object.keys(localChanges).length > 0) {
        sendBtnEl.classList.remove('hidden');
    } else {
        sendBtnEl.classList.add('hidden');
    }
}




