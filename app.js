// =================================================================
// Cole aqui a URL e a Chave de API do seu Google Apps Script
// =================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxYSEo8uNFG_G8gG7Ah1wIvLK-azjrwKvsUM9aZ7Ubn4KRUZiQf1y72Hwm3sMZ_CdBO/exec";
const API_KEY = "achavedeapidosistemaeh3461";
// =================================================================

// Variáveis de estado do aplicativo
let allItems = [];
let localChanges = {}; // Rascunho das alterações

// Elementos da UI
const itemListEl = document.getElementById('item-list');
const sendBtnEl = document.getElementById('send-batch-btn');
const userSelectorEl = document.getElementById('user');

// Ponto de entrada do aplicativo
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

        if (!itemsRes.ok || !pendenciasRes.ok) {
           throw new Error(`Falha na API: ${itemsRes.statusText} / ${pendenciasRes.statusText}`);
        }

        const items = await itemsRes.json();
        const pendencias = await pendenciasRes.json();

        // Mescla as informações de pendência nos itens
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
        itemListEl.innerHTML = `<p class="loading-message" style="color:red;">Erro ao carregar. Verifique a conexão e a configuração da API.</p>`;
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
    // Adiciona o listener de eventos à lista inteira (event delegation)
    itemListEl.addEventListener('click', handleStatusClick);
}

function handleStatusClick(e) {
    // Verifica se o clique foi em um botão de status
    const button = e.target.closest('button[data-status]');
    if (!button) return;

    const { itemId, status: newStatus } = button.dataset;

    // Atualiza o rascunho de alterações locais
    localChanges[itemId] = { status: newStatus };
    saveLocalChanges();
    
    // Atualiza a UI imediatamente para dar feedback ao usuário
    updateCardUI(itemId, newStatus);
    updateSendButtonVisibility();
}

function updateCardUI(itemId, newStatus) {
    const card = document.getElementById(`card-${itemId}`);
    const buttonContainer = card.querySelector('.status-buttons');
    
    // Atualiza a borda do card
    card.className = 'item-card'; // Reseta as classes de status
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    // Atualiza o botão ativo
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
            mode: 'no-cors', // Necessário para o Apps Script Web App simples
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(payload)
        });
        
        // Com 'no-cors', não podemos ler a resposta, então assumimos sucesso se não houver erro de rede.
        alert('Alterações enviadas com sucesso!');
        localChanges = {};
        clearLocalChanges();
        updateSendButtonVisibility();
        await fetchData(); // Recarrega os dados para confirmar

    } catch (error) {
        console.error("Erro ao enviar lote:", error);
        alert('Falha ao enviar. Suas alterações continuam salvas. Tente novamente.');
    } finally {
        sendBtnEl.innerHTML = '<span>&#10148;</span>';
        sendBtnEl.disabled = false;
    }
}

// Funções de persistência local
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