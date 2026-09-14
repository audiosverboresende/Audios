/**
 * Configuração da API do Google Apps Script
 * IMPORTANTE: Substitua a constante abaixo pela URL gerada na publicação do seu Web App no Apps Script (terminada em /exec)
 */
const APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbye7jKb6wMGN1g66CeCmMNfd7yaOtvdqpuMYhy1TQBxQ7-0LpUtCUC03ZWUHTej36RP/exec";

// Estado global da aplicação
let catalogTracks = [];
let currentFilteredTracks = [];
let activeTrackId = null;

// Elementos do DOM
const tracksContainer = document.getElementById("tracks-container");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");
const resultsMeta = document.getElementById("results-meta");

// Elementos do Player Sticky
const stickyPlayer = document.getElementById("sticky-player");
const playerAvatar = document.getElementById("player-avatar");
const playerTitle = document.getElementById("player-title");
const playerMeta = document.getElementById("player-meta");
const mainAudioElement = document.getElementById("main-audio-element");
const playerDirectLink = document.getElementById("player-direct-link");
const closePlayerBtn = document.getElementById("close-player");

/**
 * Converte um ID do Google Drive na URL direta de streaming ou imagem
 */
function buildDriveUrl(fileId, type = "audio") {
  if (!fileId) return "";
  const param = type === "imagem" ? "view" : "open";
  return `https://docs.google.com/uc?export=${param}&id=${encodeURIComponent(fileId)}`;
}

/**
 * Carrega a lista de gravações publicadas da API
 */
async function fetchTracks() {
  showLoading();

  // Modo de demonstração caso a URL ainda não tenha sido configurada
  if (!APPS_SCRIPT_API_URL || APPS_SCRIPT_API_URL.includes("COLE_AQUI")) {
    console.warn("URL do Apps Script não configurada. Carregando dados de exemplo para demonstração local.");
    setTimeout(() => {
      catalogTracks = getSampleData();
      currentFilteredTracks = [...catalogTracks];
      renderTracks(currentFilteredTracks);
      showContent();
    }, 600);
    return;
  }

  try {
    const response = await fetch(APPS_SCRIPT_API_URL, {
      method: "GET",
      mode: "cors"
    });

    if (!response.ok) {
      throw new Error(`Erro na comunicação com a planilha (${response.status})`);
    }

    const data = await response.json();
    catalogTracks = Array.isArray(data) ? data : [];
    currentFilteredTracks = [...catalogTracks];
    renderTracks(currentFilteredTracks);
    showContent();
  } catch (error) {
    console.error("Falha ao buscar gravações:", error);
    showError(error.message || "Não foi possível carregar as gravações no momento.");
  }
}

/**
 * Renderiza os cards de áudio na tela
 */
function renderTracks(tracks) {
  tracksContainer.innerHTML = "";

  if (tracks.length === 0) {
    tracksContainer.innerHTML = `
      <div class="state-card" style="grid-column: 1 / -1;">
        <p>Nenhuma gravação encontrada com os termos buscados.</p>
      </div>
    `;
    resultsMeta.textContent = "0 gravações encontradas";
    return;
  }

  resultsMeta.textContent = `${tracks.length} ${tracks.length === 1 ? "gravação disponível" : "gravações disponíveis"}`;

  tracks.forEach((track) => {
    const card = document.createElement("article");
    card.className = `track-card ${activeTrackId === track.audio_id ? "is-active" : ""}`;
    card.id = `card-${track.audio_id}`;

    // Foto do ministro ou placeholder
    const avatarHtml = track.imagemUrl
      ? `<img src="${track.imagemUrl}" alt="Foto de ${escapeHtml(track.ministro || 'Ministro')}" loading="lazy" />`
      : `<div class="track-avatar-placeholder">VDV</div>`;

    card.innerHTML = `
      <div class="track-avatar-wrap">
        ${avatarHtml}
      </div>
      <div class="track-details">
        <div class="track-title-row">
          <h2 class="track-title" title="${escapeHtml(track.titulo)}">${escapeHtml(track.titulo)}</h2>
        </div>
        ${track.ministro ? `<div class="track-minister">Ministração: ${escapeHtml(track.ministro)}</div>` : ""}
        ${track.descricao ? `<p class="track-description">${escapeHtml(track.descricao)}</p>` : ""}
        <div class="track-date-tag">${escapeHtml(track.data || "")}</div>
      </div>
      <button class="play-action-btn" aria-label="Tocar ${escapeHtml(track.titulo)}">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    `;

    // Evento de clique para tocar o áudio
    card.addEventListener("click", () => {
      playTrack(track);
    });

    tracksContainer.appendChild(card);
  });
}

/**
 * Inicia a reprodução de uma gravação no player persistente
 */
function playTrack(track) {
  activeTrackId = track.audio_id;
  
  // Atualiza classes ativas
  document.querySelectorAll(".track-card").forEach(c => c.classList.remove("is-active"));
  const activeCard = document.getElementById(`card-${track.audio_id}`);
  if (activeCard) activeCard.classList.add("is-active");

  // Configura dados do player inferior
  playerTitle.textContent = track.titulo;
  playerMeta.textContent = [track.ministro, track.data].filter(Boolean).join(" • ");
  
  if (track.imagemUrl) {
    playerAvatar.src = track.imagemUrl;
    playerAvatar.style.display = "block";
  } else {
    playerAvatar.style.display = "none";
  }

  // Link de fallback para visualização no Google Drive
  const fallbackUrl = `https://drive.google.com/file/d/${track.audio_id}/view`;
  playerDirectLink.href = fallbackUrl;

  // Carrega áudio
  mainAudioElement.src = track.audioUrl || buildDriveUrl(track.audio_id, "audio");
  stickyPlayer.style.display = "block";
  
  mainAudioElement.play().catch(err => {
    console.warn("Reprodução automática bloqueada pelo navegador ou erro de streaming:", err);
  });
}

/**
 * Filtragem em tempo real
 */
function handleSearch() {
  const query = searchInput.value.trim().toLowerCase();
  clearSearchBtn.style.display = query ? "block" : "none";

  if (!query) {
    currentFilteredTracks = [...catalogTracks];
  } else {
    currentFilteredTracks = catalogTracks.filter(item => {
      const title = (item.titulo || "").toLowerCase();
      const minister = (item.ministro || "").toLowerCase();
      const date = (item.data || "").toLowerCase();
      const desc = (item.descricao || "").toLowerCase();
      return title.includes(query) || minister.includes(query) || date.includes(query) || desc.includes(query);
    });
  }

  renderTracks(currentFilteredTracks);
}

// Auxiliares de Exibição
function showLoading() {
  loadingState.style.display = "block";
  errorState.style.display = "none";
  tracksContainer.style.display = "none";
}

function showContent() {
  loadingState.style.display = "none";
  errorState.style.display = "none";
  tracksContainer.style.display = "flex";
}

function showError(msg) {
  loadingState.style.display = "none";
  errorMessage.textContent = msg;
  errorState.style.display = "block";
  tracksContainer.style.display = "none";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Dados de exemplo caso a API não esteja preenchida
function getSampleData() {
  return [
    {
      ordem: "1",
      titulo: "Culto de Celebração de Domingo",
      data: "13/09/2026",
      ministro: "Pr. Wellington Ricelli",
      descricao: "Mensagem sobre a fidelidade e provisão divina em tempos de desafio.",
      audio_id: "sample_audio_1",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      imagemUrl: ""
    },
    {
      ordem: "2",
      titulo: "Culto de Oração e Intercessão",
      data: "08/09/2026",
      ministro: "Pr. Wellington Ricelli",
      descricao: "Tempo de oração pela cidade, família e ministérios locais.",
      audio_id: "sample_audio_2",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      imagemUrl: ""
    }
  ];
}

// Event Listeners
searchInput.addEventListener("input", handleSearch);
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  handleSearch();
  searchInput.focus();
});
retryBtn.addEventListener("click", fetchTracks);
closePlayerBtn.addEventListener("click", () => {
  mainAudioElement.pause();
  stickyPlayer.style.display = "none";
});

// Inicialização
document.addEventListener("DOMContentLoaded", fetchTracks);
