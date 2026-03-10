// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW fetch fail', err));
}

// Data Store
let favorites = JSON.parse(localStorage.getItem('busFavorites')) || {}; // { "bstopid": { name: "서면역", arsno: "05230", lines: "111, 31" } }
function saveFavorites() {
  localStorage.setItem('busFavorites', JSON.stringify(favorites));
  renderFavoritesList();
}

// Elements
const tabs = document.querySelectorAll('.tab-content');
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const favoritesList = document.getElementById('favoritesList');
const arrivalModal = document.getElementById('arrivalModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const arrivalList = document.getElementById('arrivalList');
const modalStopName = document.getElementById('modalStopName');
const modalStopFilters = document.getElementById('modalStopFilters');

let refreshInterval = null;
let currentViewingStop = null;

// Tab Switching
navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    tabs.forEach(t => t.classList.add('hidden'));

    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');

    if (btn.dataset.tab === 'home') {
      renderFavoritesList();
    }
  });
});

// Search functionality (Settings Tab)
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const res = await fetch(`/api/stops?name=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.status === 'success' && data.data && data.data.length > 0) {
      renderStops(data.data);
    } else {
      searchResults.innerHTML = '<div class="empty-state">결과가 없습니다.</div>';
    }
  } catch (err) {
    searchResults.innerHTML = '<div class="empty-state">오류가 발생했습니다.</div>';
  }
}

function renderStops(stops) {
  searchResults.innerHTML = '';
  stops.forEach(stop => {
    const id = stop.bstopid;
    const isSaved = favorites[id] !== undefined;
    const filterText = isSaved ? favorites[id].lines : '';

    const el = document.createElement('div');
    el.className = 'stop-card settings-card slide-up';
    el.innerHTML = `
      <div class="stop-head">
        <div>
          <h3>${stop.bstopnm}</h3>
          <span class="stop-id">${stop.arsno || id}</span>
        </div>
        <button class="toggle-btn ${isSaved ? 'remove' : 'add'}" data-id="${id}">
          ${isSaved ? '삭제' : '추가'}
        </button>
      </div>
      <div class="filter-input-area ${isSaved ? '' : 'hidden'}" id="filter-area-${id}">
        <label>보고 싶은 버스 번호 (쉼표로 구분)</label>
        <input type="text" class="line-filter-input" data-id="${id}" value="${filterText}" placeholder="예: 31, 111, 1004" autocomplete="off">
        <p class="help-text">비워두면 모든 버스가 표시됩니다.</p>
      </div>
    `;

    // Event Listeners for Adding/Removing
    const btn = el.querySelector('.toggle-btn');
    const filterArea = el.querySelector('.filter-input-area');
    const filterInput = el.querySelector('.line-filter-input');

    btn.addEventListener('click', () => {
      if (favorites[id]) {
        delete favorites[id];
        btn.textContent = '추가';
        btn.className = 'toggle-btn add';
        filterArea.classList.add('hidden');
      } else {
        favorites[id] = { name: stop.bstopnm, arsno: stop.arsno || id, lines: filterInput.value.trim() };
        btn.textContent = '삭제';
        btn.className = 'toggle-btn remove';
        filterArea.classList.remove('hidden');
      }
      saveFavorites();
    });

    filterInput.addEventListener('input', (e) => {
      if (favorites[id]) {
        favorites[id].lines = e.target.value.trim();
        saveFavorites();
      }
    });

    searchResults.appendChild(el);
  });
}

// Home Tab Rendering
function renderFavoritesList() {
  const ids = Object.keys(favorites);
  if (ids.length === 0) {
    favoritesList.innerHTML = '<div class="empty-state"><p>등록된 맞춤 정류장이 없습니다.</p><p>설정 탭에서 🔍 검색하여 추가해보세요!</p></div>';
    return;
  }

  favoritesList.innerHTML = '';
  ids.forEach(id => {
    const data = favorites[id];
    const el = document.createElement('div');
    el.className = 'stop-card home-card slide-up';
    el.innerHTML = `
      <div class="card-icon">🚏</div>
      <div class="card-content">
        <h3>${data.name}</h3>
        <p class="filter-badge">${data.lines ? `${data.lines}번만 보기` : '모든 버스 보기'}</p>
      </div>
      <div class="card-arrow">›</div>
    `;
    el.addEventListener('click', () => openArrivalModal(id, data.name, data.lines));
    favoritesList.appendChild(el);
  });
}

// Modal and API Loading
function openArrivalModal(bstopid, bstopnm, filterLines) {
  currentViewingStop = { id: bstopid, filterStr: filterLines };
  modalStopName.textContent = bstopnm;
  modalStopFilters.textContent = filterLines ? `필터: [${filterLines}] 버스` : '필터: 모든 버스';

  arrivalList.innerHTML = '<div class="loading-spinner"></div>';
  arrivalModal.classList.remove('hidden');

  fetchArrivals();
  refreshInterval = setInterval(fetchArrivals, 30000); // 30s auto refresh
}

closeModalBtn.addEventListener('click', () => {
  arrivalModal.classList.add('hidden');
  clearInterval(refreshInterval);
  currentViewingStop = null;
});

async function fetchArrivals() {
  if (!currentViewingStop) return;
  const { id, filterStr } = currentViewingStop;

  // Parse user requested lines into an array
  const wantedLines = filterStr
    ? filterStr.split(',').map(s => s.trim().replace(/[^a-zA-Z0-9가-힣]/g, '')).filter(Boolean)
    : [];

  try {
    const res = await fetch(`/api/arrivals?bstopid=${id}`);
    const data = await res.json();

    if (data.status === 'success') {
      let items = data.data || [];

      // Filter logic
      if (wantedLines.length > 0) {
        items = items.filter(arr => {
          const arrLine = (arr.lineno || '').replace(/[^a-zA-Z0-9가-힣]/g, '');
          return wantedLines.some(wl => arrLine.includes(wl) || wl.includes(arrLine));
        });
      }

      if (items.length > 0) {
        renderArrivals(items);
      } else {
        arrivalList.innerHTML = '<div class="empty-state">해당 버스의 도착 정보가 없습니다.</div>';
      }
    } else {
      throw new Error("API failed");
    }
  } catch (err) {
    arrivalList.innerHTML = '<div class="empty-state error-msg">데이터를 가져오지 못했습니다.</div>';
  }
}

function renderArrivals(arrivals) {
  arrivalList.innerHTML = '';
  arrivals.forEach((arr, i) => {
    const el = document.createElement('div');
    el.className = 'arrival-card slide-up';
    el.style.animationDelay = `${i * 0.05}s`;

    // Sort logic to put min1 and station1 into a clean UI
    const min1 = parseInt(arr.min1);
    const stationText = arr.station1 ? `${arr.station1} 정거장 전` : '';

    let timeHtml = '';
    if (arr.min1) {
      if (min1 <= 3) timeHtml = `<span class="time soon">${arr.min1}분 전</span>`;
      else timeHtml = `<span class="time">${arr.min1}분 전</span>`;
    } else {
      timeHtml = `<span class="time ext">정보 없음</span>`;
    }

    el.innerHTML = `
      <div class="bus-number">${arr.lineno}</div>
      <div class="bus-details">
        <div class="primary-arrival">${timeHtml}</div>
        <div class="secondary-arrival"><span class="station">${stationText}</span></div>
      </div>
    `;
    arrivalList.appendChild(el);
  });
}

// Initial render
renderFavoritesList();
