/**
 * Catálogo de Áudios dos Cultos — Verbo Resende
 * API: Google Apps Script Web App
 */
const APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbye7jKb6wMGN1g66CeCmMNfd7yaOtvdqpuMYhy1TQBxQ7-0LpUtCUC03ZWUHTej36RP/exec";

let catalogTracks = [];
let currentFilteredTracks = [];
let activeTrackId = null;

// Elementos da Interface
const tracksContainer = document.getElementById("tracks-container");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");
const resultsMeta = document.getElementById("results-meta");

// Player Inferior
const stickyPlayer = document.getElementById("sticky-player");
const playerAvatar = document.getElementById("player-avatar");
const playerTitle = document.getElementById("player-title");
const playerMeta = document.getElementById("player-meta");
const playerDirectLink = document.getElementById("player-direct-link");
const closePlayerBtn = document.getElementById("close-player");
const playerAudioContainer = document.getElementById("player-audio-container");
const mainAudio = document.getElementById("main-audio");
const playerFrameContainer = document.getElementById("player-frame-container");
const toggleDriveFrameBtn = document.getElementById("toggle-drive-frame-btn");

/**
 * Extrai o ID do Google Drive de uma string ou URL
 */
function extractDriveId(val) {
  if (!val) return "";
  if (/^[a-zA-Z0-9_-]{25,}$/.test(val)) return val;
  const match = val.match(/id=([a-zA-Z0-9_-]+)/) || val.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : val;
}

/**
 * Retorna o link de imagem do CDN oficial do Google (evita erro 403 Forbidden)
 */
function getImageUrl(track) {
  const rawId = track.imagem_id || track.imagemId || track.imagemUrl;
  const id = extractDriveId(rawId);
  return id ? `https://lh3.googleusercontent.com/d/${id}` : "";
}

/**
 * Retorna a URL do player oficial embutido do Google Drive (/preview)
 */
function getAudioPreviewUrl(track) {
  const rawId = track.audio_id || track.áudio_id || track.audioId || track.audioUrl;
  const id = extractDriveId(rawId);
  return id ? `https://drive.google.com/file/d/${id}/preview` : "";
}

/**
 * Retorna a URL direta no Google Drive (/view)
 */
function getAudioDirectUrl(track) {
  const rawId = track.audio_id || track.áudio_id || track.audioId || track.audioUrl;
  const id = extractDriveId(rawId);
  return id ? `https://drive.google.com/file/d/${id}/view` : "#";
}

/**
 * Carrega a lista de cultos da API do Apps Script
 */
async function fetchTracks() {
  showLoading();

  try {
    const response = await fetch(APPS_SCRIPT_API_URL, { method: "GET" });
    if (!response.ok) throw new Error(`Erro na API (${response.status})`);

    const data = await response.json();
    catalogTracks = Array.isArray(data) ? data : [];
    currentFilteredTracks = [...catalogTracks];
    renderTracks(currentFilteredTracks);
    showContent();
  } catch (error) {
    console.error("Erro ao carregar catálogo:", error);
    showError("Não foi possível carregar as gravações no momento. Tente novamente.");
  }
}

/**
 * Renderiza os cards das ministrações
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
    const audioId = extractDriveId(track.audio_id || track.áudio_id || track.audioUrl);
    const card = document.createElement("article");
    card.className = `track-card ${activeTrackId === audioId ? "is-active" : ""}`;
    card.id = `card-${audioId}`;

    const imgUrl = getImageUrl(track);
    const avatarHtml = imgUrl
      ? `<img src="${imgUrl}" alt="Foto de ${escapeHtml(track.ministro || 'Ministro')}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'track-avatar-placeholder\\'>VDV</div>';" />`
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

    card.addEventListener("click", () => {
      // Se clicar no card que já está tocando no player nativo, alterna play/pause
      if (activeTrackId === audioId && mainAudio && mainAudio.src && playerAudioContainer.style.display !== "none") {
        if (mainAudio.paused) {
          mainAudio.play().catch(() => {});
        } else {
          mainAudio.pause();
        }
        return;
      }
      playTrack(track);
    });

    tracksContainer.appendChild(card);
  });
}

/**
 * Dispara a reprodução no player nativo com início imediato
 */
function playTrack(track) {
  const audioId = extractDriveId(track.audio_id || track.áudio_id || track.audioUrl);
  activeTrackId = audioId;
  
  document.querySelectorAll(".track-card").forEach(c => c.classList.remove("is-active"));
  const activeCard = document.getElementById(`card-${audioId}`);
  if (activeCard) activeCard.classList.add("is-active");

  playerTitle.textContent = track.titulo || "Gravação do Culto";
  playerMeta.textContent = [track.ministro, track.data].filter(Boolean).join(" • ");
  
  const imgUrl = getImageUrl(track);
  if (imgUrl) {
    playerAvatar.src = imgUrl;
    playerAvatar.style.display = "block";
  } else {
    playerAvatar.style.display = "none";
  }

  // Link direto para abrir no Google Drive
  playerDirectLink.href = getAudioDirectUrl(track);

  // Integração com a barra de mídia e tela de bloqueio do celular
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.titulo || "Gravação do Culto",
        artist: track.ministro || "Igreja Verbo da Vida Resende",
        album: "Áudios dos Cultos",
        artwork: imgUrl ? [{ src: imgUrl, sizes: "512x512", type: "image/jpeg" }] : []
      });
    } catch (e) {
      console.warn("MediaSession não pôde ser configurado:", e);
    }
  }

  // Reseta visualização para o player de áudio nativo (toca no 1º clique)
  playerFrameContainer.style.display = "none";
  playerFrameContainer.innerHTML = "";
  playerAudioContainer.style.display = "block";
  toggleDriveFrameBtn.textContent = "Usar player do Google Drive";

  // URL de streaming direto do arquivo MP3 no Google Drive
  const directAudioUrl = `https://drive.google.com/uc?export=download&id=${audioId}`;

  mainAudio.src = directAudioUrl;
  mainAudio.load();

  // O clique do usuário no card é uma ação direta de interação, permitindo play() imediato
  const playPromise = mainAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      console.warn("Autoplay imediato bloqueado ou aguardando buffer:", error);
    });
  }

  stickyPlayer.style.display = "block";
}

/**
 * Alterna para o iframe embutido do Google Drive
 */
function switchToDriveIframe() {
  if (!activeTrackId) return;
  const previewUrl = `https://drive.google.com/file/d/${activeTrackId}/preview`;
  playerFrameContainer.innerHTML = `
    <iframe src="${previewUrl}" class="drive-audio-frame" allow="autoplay" title="Player de Áudio Oficial do Google Drive"></iframe>
  `;
  playerAudioContainer.style.display = "none";
  playerFrameContainer.style.display = "block";
  toggleDriveFrameBtn.textContent = "Voltar ao player nativo";
  
  if (mainAudio) {
    mainAudio.pause();
  }
}

/**
 * Fallback automático: se o link direto apresentar erro, ativa o player do Drive
 */
mainAudio.addEventListener("error", () => {
  if (mainAudio.src && activeTrackId) {
    console.warn("Falha no link direto de áudio. Alternando para o player do Google Drive...");
    switchToDriveIframe();
  }
});

/**
 * Botão para alternar manualmente entre Player Direto e Player do Drive
 */
toggleDriveFrameBtn.addEventListener("click", () => {
  if (playerFrameContainer.style.display === "none") {
    switchToDriveIframe();
  } else {
    playerFrameContainer.style.display = "none";
    playerFrameContainer.innerHTML = "";
    playerAudioContainer.style.display = "block";
    toggleDriveFrameBtn.textContent = "Usar player do Google Drive";
    if (mainAudio && mainAudio.src) {
      mainAudio.play().catch(() => {});
    }
  }
});

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

searchInput.addEventListener("input", handleSearch);
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  handleSearch();
  searchInput.focus();
});
retryBtn.addEventListener("click", fetchTracks);

closePlayerBtn.addEventListener("click", () => {
  if (mainAudio) {
    mainAudio.pause();
    mainAudio.removeAttribute("src");
    mainAudio.load();
  }
  playerFrameContainer.innerHTML = "";
  stickyPlayer.style.display = "none";
  activeTrackId = null;
  document.querySelectorAll(".track-card").forEach(c => c.classList.remove("is-active"));
});

document.addEventListener("DOMContentLoaded", fetchTracks);
