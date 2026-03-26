const CAPABILITY_LABELS = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  text_to_video: '文生视频',
  text_to_audio: '文生语音',
  lyrics_generation: '歌词生成',
  music_generation: '音乐生成',
};

const DEFAULT_COSTS = {
  text_to_image: 10,
  image_to_image: 12,
  text_to_video: 30,
  text_to_audio: 8,
  lyrics_generation: 6,
  music_generation: 20,
};

const QUICK_PROMPTS = {
  text_to_image: [
    '赛博城市夜景，电影级灯光，35mm，超细节',
    '国风水墨山海，薄雾与飞鸟，留白构图',
    '产品海报，极简背景，柔和工作室布光',
  ],
  image_to_image: ['保留主体轮廓，转为吉卜力动画风格', '将白天场景改为黄昏逆光，增加电影感', '材质升级为金属与玻璃质感，提升反射细节'],
  text_to_video: ['镜头从远景推进到人物特写，24fps，电影质感', '无人机俯拍海岸线，日出时刻，稳定运镜', '未来工厂内景，机械臂协作，轻微镜头摇移'],
  text_to_audio: ['温暖女声中文旁白，语速中等，播客风格', '年轻男声，情绪饱满，适合短视频口播', '品牌宣传配音，稳重专业，清晰吐字'],
};

const PROMPT_MAX_LENGTHS = {
  text_to_image: 1500,
  image_to_image: 1500,
  text_to_video: 1500,
  text_to_audio: 1500,
  lyrics_generation: 2000,
  music_generation: 2000,
};

const state = {
  user: null,
  costs: [],
  models: [],
  modelsByCapability: {},
  history: {
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
    hasRunningJobs: false,
  },
  ledger: {
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  },
  adminUsers: {
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
    query: '',
    role: '',
    status: '',
    summary: {
      total: 0,
      activeTotal: 0,
      disabledTotal: 0,
      superAdminTotal: 0,
    },
    items: [],
  },
  ui: {
    authOpen: false,
    jobPollTimer: null,
    jobPollBusy: false,
    view: 'console',
    pointsModalOpen: false,
    pointsTargetUser: null,
  },
};

const els = {
  authPanel: document.getElementById('authPanel'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  workspace: document.getElementById('workspace'),
  globalMsg: document.getElementById('globalMsg'),
  authMsg: document.getElementById('authMsg'),
  sessionHint: document.getElementById('sessionHint'),
  authActionBtn: document.getElementById('authActionBtn'),
  workspaceNav: document.getElementById('workspaceNav'),
  consoleNavBtn: document.getElementById('consoleNavBtn'),
  adminNavBtn: document.getElementById('adminNavBtn'),
  consoleView: document.getElementById('consoleView'),
  adminView: document.getElementById('adminView'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  registerSubmitBtn: document.getElementById('registerSubmitBtn'),
  tabs: [...document.querySelectorAll('.tab')],
  welcomeText: document.getElementById('welcomeText'),
  pointsText: document.getElementById('pointsText'),
  generateForm: document.getElementById('generateForm'),
  capabilitySelect: document.getElementById('capabilitySelect'),
  modelSelect: document.getElementById('modelSelect'),
  refreshModelsBtn: document.getElementById('refreshModelsBtn'),
  promptInput: document.getElementById('promptInput'),
  promptCounter: document.getElementById('promptCounter'),
  imageInputBox: document.getElementById('imageInputBox'),
  musicInputBox: document.getElementById('musicInputBox'),
  lyricsInput: document.getElementById('lyricsInput'),
  instrumentalCheckbox: document.getElementById('instrumentalCheckbox'),
  submitBtn: document.getElementById('submitBtn'),
  generateMsg: document.getElementById('generateMsg'),
  costList: document.getElementById('costList'),
  historyList: document.getElementById('historyList'),
  historySummary: document.getElementById('historySummary'),
  historyPrevBtn: document.getElementById('historyPrevBtn'),
  historyNextBtn: document.getElementById('historyNextBtn'),
  historyPageInfo: document.getElementById('historyPageInfo'),
  ledgerSummary: document.getElementById('ledgerSummary'),
  ledgerPrevBtn: document.getElementById('ledgerPrevBtn'),
  ledgerNextBtn: document.getElementById('ledgerNextBtn'),
  ledgerPageInfo: document.getElementById('ledgerPageInfo'),
  ledgerList: document.getElementById('ledgerList'),
  adminSummary: document.getElementById('adminSummary'),
  adminStatTotal: document.getElementById('adminStatTotal'),
  adminStatActive: document.getElementById('adminStatActive'),
  adminStatDisabled: document.getElementById('adminStatDisabled'),
  adminStatSuper: document.getElementById('adminStatSuper'),
  adminSearchInput: document.getElementById('adminSearchInput'),
  adminRoleFilter: document.getElementById('adminRoleFilter'),
  adminStatusFilter: document.getElementById('adminStatusFilter'),
  adminSearchBtn: document.getElementById('adminSearchBtn'),
  adminRefreshBtn: document.getElementById('adminRefreshBtn'),
  adminUsersList: document.getElementById('adminUsersList'),
  adminUsersHint: document.getElementById('adminUsersHint'),
  adminUsersPrevBtn: document.getElementById('adminUsersPrevBtn'),
  adminUsersNextBtn: document.getElementById('adminUsersNextBtn'),
  adminUsersPageInfo: document.getElementById('adminUsersPageInfo'),
  previewModal: document.getElementById('previewModal'),
  previewBackdrop: document.getElementById('previewBackdrop'),
  previewCloseBtn: document.getElementById('previewCloseBtn'),
  previewTitle: document.getElementById('previewTitle'),
  previewBody: document.getElementById('previewBody'),
  pointsModal: document.getElementById('pointsModal'),
  pointsBackdrop: document.getElementById('pointsBackdrop'),
  pointsCloseBtn: document.getElementById('pointsCloseBtn'),
  pointsModalTitle: document.getElementById('pointsModalTitle'),
  pointsTargetText: document.getElementById('pointsTargetText'),
  pointsForm: document.getElementById('pointsForm'),
  pointsActionSelect: document.getElementById('pointsActionSelect'),
  pointsAmountInput: document.getElementById('pointsAmountInput'),
  pointsReasonInput: document.getElementById('pointsReasonInput'),
  pointsFormMsg: document.getElementById('pointsFormMsg'),
  pointsSubmitBtn: document.getElementById('pointsSubmitBtn'),
};

function setGlobalMsg(msg) {
  els.globalMsg.textContent = msg || '';
}

function setAuthMsg(msg, type = 'error') {
  if (!els.authMsg) return;
  const normalized = String(msg || '').trim();
  els.authMsg.textContent = normalized;
  els.authMsg.classList.toggle('hidden', normalized.length === 0);
  els.authMsg.dataset.type = normalized.length === 0 ? '' : type;
}

function setGenerateMsg(msg) {
  els.generateMsg.textContent = msg || '';
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function validateRegisterFormInput({ username, email, password }) {
  const normalizedUsername = String(username || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!/^[a-zA-Z0-9_]{3,32}$/.test(normalizedUsername)) {
    return '用户名需为 3-32 位，仅支持字母、数字、下划线';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return '请输入正确的邮箱地址';
  }
  if (normalizedPassword.length < 8) {
    return '密码至少需要 8 位';
  }
  return null;
}

function isSuperAdmin() {
  return state.user?.role === 'super_admin';
}

function setPointsFormMsg(msg, type = 'error') {
  const normalized = String(msg || '').trim();
  els.pointsFormMsg.textContent = normalized;
  els.pointsFormMsg.classList.toggle('hidden', normalized.length === 0);
  els.pointsFormMsg.dataset.type = normalized.length === 0 ? '' : type;
}

function getSafeMediaUrl(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('/generated/')) return '';
  return encodeURI(raw)
    .replace(/"/g, '%22')
    .replace(/'/g, '%27')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  let requestPath = path;

  if (method === 'GET' || method === 'HEAD') {
    const separator = requestPath.includes('?') ? '&' : '?';
    requestPath = `${requestPath}${separator}_ts=${Date.now()}`;
  }

  const response = await fetch(requestPath, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });

  const raw = await response.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (_err) {
    const status = response.status || 0;
    throw new Error('服务暂时不可用(HTTP ' + status + ')，请稍后重试');
  }

  if (response.ok === false || data.success === false) {
    throw new Error(data?.error?.message || ('Request failed (HTTP ' + response.status + ')'));
  }

  return data.data;
}

const JOB_POLL_INTERVAL_MS = 3000;

function stopJobPolling() {
  if (state.ui.jobPollTimer) {
    clearInterval(state.ui.jobPollTimer);
    state.ui.jobPollTimer = null;
  }
}

async function pollJobUpdatesOnce() {
  if (state.ui.jobPollBusy || state.user === null) return;
  state.ui.jobPollBusy = true;
  try {
    await refreshUserSnapshot();
    await Promise.all([refreshHistory({ silent: true }), refreshLedger()]);
  } catch (_err) {
    // ignore polling errors and retry next tick
  } finally {
    state.ui.jobPollBusy = false;
  }
}

function ensureJobPolling(enabled, immediate = false) {
  if (!enabled || state.user === null) {
    stopJobPolling();
    return;
  }

  if (immediate) {
    void pollJobUpdatesOnce();
  }

  if (state.ui.jobPollTimer) return;

  state.ui.jobPollTimer = setInterval(() => {
    void pollJobUpdatesOnce();
  }, JOB_POLL_INTERVAL_MS);
}

function showTab(tab) {
  els.tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  els.loginForm.classList.toggle('active', tab === 'login');
  els.registerForm.classList.toggle('active', tab === 'register');
  setAuthMsg('');
}

function openAuthPanel(tab = 'login', msg = '') {
  state.ui.authOpen = true;
  showTab(tab);
  setAuthMsg(msg || '');
  if (msg) setGlobalMsg(msg);
  renderAuthState();
}

function closeAuthPanel() {
  state.ui.authOpen = false;
  stopJobPolling();
  setAuthMsg('');
  renderAuthState();
}

function requireLogin(msg) {
  openAuthPanel('login', msg || '请先登录');
}

function setButtonLoading(button, loadingText, isLoading) {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent || '';
  }
  button.disabled = Boolean(isLoading);
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function getCostFor(capability) {
  const row = state.costs.find((x) => x.capability === capability);
  if (row) return row.cost_points;
  return DEFAULT_COSTS[capability] || 0;
}

function renderViewState() {
  const canAdmin = isSuperAdmin();
  if (!canAdmin) {
    state.ui.view = 'console';
  }

  els.workspaceNav.classList.toggle('hidden', !canAdmin);
  els.consoleNavBtn.classList.toggle('active', state.ui.view === 'console');
  els.adminNavBtn.classList.toggle('active', state.ui.view === 'admin');
  els.consoleView.classList.toggle('hidden', state.ui.view !== 'console');
  els.adminView.classList.toggle('hidden', state.ui.view !== 'admin' || !canAdmin);
}

function renderAuthState() {
  els.workspace.classList.remove('hidden');
  els.authPanel.classList.toggle('hidden', state.ui.authOpen === false);

  if (state.user) {
    els.welcomeText.textContent = `欢迎你，${state.user.username}`;
    els.pointsText.textContent = '';
    els.sessionHint.textContent = `已登录：${state.user.username}（积分 ${state.user.points}）`;
    els.authActionBtn.textContent = '退出登录';
  } else {
    els.welcomeText.textContent = 'ATF';
    els.pointsText.textContent = '';
    els.sessionHint.textContent = '';
    els.authActionBtn.textContent = '账户';
  }

  renderViewState();
}

function renderHistoryPagination() {
  const { page, totalPages, total } = state.history;
  els.historyPageInfo.textContent = `第 ${page} / ${totalPages} 页`;
  els.historyPrevBtn.disabled = page <= 1 || state.user === null;
  els.historyNextBtn.disabled = page >= totalPages || state.user === null || total === 0;
}

function renderLedgerPagination() {
  const { page, totalPages, total } = state.ledger;
  els.ledgerPageInfo.textContent = `第 ${page} / ${totalPages} 页`;
  els.ledgerPrevBtn.disabled = page <= 1 || state.user === null;
  els.ledgerNextBtn.disabled = page >= totalPages || state.user === null || total === 0;
}

function renderAdminPagination() {
  const { page, totalPages, total } = state.adminUsers;
  els.adminUsersPageInfo.textContent = `第 ${page} / ${totalPages} 页`;
  els.adminUsersPrevBtn.disabled = page <= 1 || !isSuperAdmin();
  els.adminUsersNextBtn.disabled = page >= totalPages || !isSuperAdmin() || total === 0;
}

function openPointsModal(user, action = 'grant') {
  state.ui.pointsModalOpen = true;
  state.ui.pointsTargetUser = user || null;
  els.pointsActionSelect.value = action;
  els.pointsAmountInput.value = '';
  els.pointsReasonInput.value = '';
  els.pointsModalTitle.textContent = action === 'deduct' ? '扣减积分' : '发放积分';
  els.pointsTargetText.textContent = user
    ? `用户 #${user.id} · ${user.username} · 当前积分 ${user.points}`
    : '';
  setPointsFormMsg('');
  els.pointsModal.classList.remove('hidden');
}

function closePointsModal() {
  state.ui.pointsModalOpen = false;
  state.ui.pointsTargetUser = null;
  setPointsFormMsg('');
  els.pointsModal.classList.add('hidden');
}

function openPreview(row) {
  const title = `${CAPABILITY_LABELS[row.capability] || row.capability} · ${row.model_name || row.model_code || '-'}`;
  els.previewTitle.textContent = title;
  const mediaUrl = getSafeMediaUrl(row.public_url);

  if (row.file_type === 'image' && mediaUrl) {
    els.previewBody.innerHTML = `<img src="${mediaUrl}" alt="preview" />`;
  } else if (row.file_type === 'video' && mediaUrl) {
    els.previewBody.innerHTML = `<video controls autoplay src="${mediaUrl}"></video>`;
  } else if (row.file_type === 'audio' && mediaUrl) {
    els.previewBody.innerHTML = `<audio controls autoplay src="${mediaUrl}"></audio>`;
  } else if (row.file_type === 'text') {
    const previewText = row.output_preview_text || '文本结果';
    els.previewBody.innerHTML = `<pre>${escapeHtml(previewText)}</pre>`;
  } else {
    els.previewBody.innerHTML = '<p class="hint">暂无可预览内容</p>';
  }

  els.previewModal.classList.remove('hidden');
}

function closePreview() {
  els.previewModal.classList.add('hidden');
  els.previewBody.innerHTML = '';
}

function getMediaActionOverlay(row) {
  const status = String(row.status || '').toLowerCase();
  if (!row.public_url || status !== 'completed' || row.file_type === 'text') return '';
  const mediaUrl = getSafeMediaUrl(row.public_url);
  if (!mediaUrl) return '';

  return `
    <div class="media-actions">
      <button type="button" class="media-action-btn preview-btn" aria-label="预览" title="预览">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/>
        </svg>
      </button>
      <a class="media-action-btn" href="${mediaUrl}" download target="_blank" rel="noreferrer" aria-label="下载" title="下载">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11A2.5 2.5 0 0 0 20 18.5v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>
  `;
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildModelMap() {
  state.modelsByCapability = state.models.reduce((acc, row) => {
    if (!acc[row.capability]) acc[row.capability] = [];
    acc[row.capability].push(row);
    return acc;
  }, {});
}

function getModelsByCapability(capability) {
  return state.modelsByCapability[capability] || [];
}

function getSelectedModelRow() {
  const capability = els.capabilitySelect.value;
  const modelCode = (els.modelSelect.value || '').trim();
  return getModelsByCapability(capability).find((row) => row.model_code === modelCode) || null;
}

function getPromptMaxLength(capability = els.capabilitySelect.value) {
  return PROMPT_MAX_LENGTHS[capability] || 1500;
}

function updatePromptCounter() {
  const len = (els.promptInput.value || '').trim().length;
  els.promptCounter.textContent = `${len} / ${getPromptMaxLength()}`;
}

function updateCapabilityInputs() {
  const capability = els.capabilitySelect.value;
  const showImageInput = capability === 'image_to_image';
  const showMusicInput = capability === 'music_generation';
  els.imageInputBox.classList.toggle('hidden', showImageInput === false);
  els.musicInputBox.classList.toggle('hidden', showMusicInput === false);
  els.promptInput.maxLength = getPromptMaxLength(capability);
}

function renderModelPanel() {
  // no-op: current configuration panel removed
}

function renderModelOptions(preferredModelCode) {
  const capability = els.capabilitySelect.value;
  const models = getModelsByCapability(capability);
  const existingValue = (preferredModelCode || els.modelSelect.value || '').trim();

  els.modelSelect.innerHTML = '';

  if (state.user === null) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '默认模型';
    els.modelSelect.appendChild(option);
    els.modelSelect.disabled = true;
    renderModelPanel();
    return;
  }

  if (models.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '暂无可选模型（将使用默认）';
    els.modelSelect.appendChild(option);
    els.modelSelect.disabled = true;
    renderModelPanel();
    return;
  }

  models.forEach((row) => {
    const option = document.createElement('option');
    option.value = row.model_code;
    const fallbackCost = getCostFor(capability);
    const cost = row.unit_cost_points > 0 ? row.unit_cost_points : fallbackCost;
    option.textContent = `${row.model_name} · ${cost}积分${row.is_default ? ' [默认]' : ''}`;
    els.modelSelect.appendChild(option);
  });

  const defaultRow = models.find((x) => Number(x.is_default) === 1) || models[0];
  const target = models.some((x) => x.model_code === existingValue) ? existingValue : defaultRow.model_code;

  els.modelSelect.value = target;
  els.modelSelect.disabled = false;
  renderModelPanel();
}

async function refreshModels(preferredModelCode) {
  if (state.user === null) {
    state.models = [];
    buildModelMap();
    renderModelOptions(preferredModelCode);
    return false;
  }

  try {
    const rows = await api('/api/models/active');
    state.models = Array.isArray(rows) ? rows : [];
    buildModelMap();
    renderModelOptions(preferredModelCode);
    return true;
  } catch (err) {
    state.models = [];
    buildModelMap();
    renderModelOptions();
    setGenerateMsg(`模型列表加载失败: ${err.message}`);
    return false;
  }
}

async function refreshUserSnapshot() {
  const data = await api('/api/user/me');
  state.user = data.user;
  state.costs = data.costs || [];
  renderAuthState();
  return data;
}

async function refreshMe(options = {}) {
  const authJustSet = Boolean(options.authJustSet);
  const fallbackUser = options.fallbackUser || null;
  try {
    if (authJustSet && fallbackUser) {
      state.user = fallbackUser;
      renderAuthState();
    }

    let snapshotLoaded = false;
    let lastErr = null;
    const attempts = authJustSet ? 3 : 1;

    for (let i = 0; i < attempts; i += 1) {
      try {
        await refreshUserSnapshot();
        snapshotLoaded = true;
        break;
      } catch (err) {
        lastErr = err;
        if (!authJustSet || i === attempts - 1) {
          throw err;
        }
        await sleep(250 * (i + 1));
      }
    }

    if (!snapshotLoaded && lastErr) throw lastErr;

    state.ui.authOpen = false;
    renderAuthState();
    state.history.page = 1;
    state.ledger.page = 1;
    const tasks = [refreshHistory({ page: 1 }), refreshLedger({ page: 1 }), refreshModels()];
    if (isSuperAdmin()) {
      tasks.push(refreshAdminUsers({ page: 1 }));
    }
    await Promise.all(tasks);
    updatePromptCounter();
    setAuthMsg('');
  } catch (_err) {
    stopJobPolling();
    state.user = null;
    state.costs = [];
    state.models = [];
    state.modelsByCapability = {};
    state.adminUsers = {
      ...state.adminUsers,
      page: 1,
      total: 0,
      totalPages: 1,
      items: [],
      summary: { total: 0, activeTotal: 0, disabledTotal: 0, superAdminTotal: 0 },
    };
    state.ui.view = 'console';
    state.history = { ...state.history, page: 1, total: 0, totalPages: 1, hasRunningJobs: false };
    state.ledger = { ...state.ledger, page: 1, total: 0, totalPages: 1 };
    renderAuthState();
    await Promise.all([refreshHistory({ page: 1 }), refreshLedger({ page: 1 }), refreshModels()]);
    updatePromptCounter();
  }
}

function renderAdminUsers(rows) {
  els.adminUsersList.innerHTML = '';

  if (!isSuperAdmin()) {
    els.adminUsersList.innerHTML = '<p class="hint">仅超级管理员可访问</p>';
    return;
  }

  if (!rows.length) {
    els.adminUsersList.innerHTML = '<p class="hint">暂无匹配用户</p>';
    return;
  }

  rows.forEach((user) => {
    const item = document.createElement('div');
    const roleLabel = user.role === 'super_admin' ? '超级管理员' : '普通用户';
    const statusLabel = user.is_active ? '启用' : '禁用';
    item.className = 'admin-user-row';
    item.innerHTML = `
      <div class="admin-user-main">
        <div class="admin-user-head">
          <div>
            <strong>${escapeHtml(user.username)}</strong>
            <span class="admin-user-id">#${escapeHtml(user.id)}</span>
          </div>
          <div class="admin-user-tags">
            <span class="status-badge ${user.is_active ? 'completed' : 'failed'}">${statusLabel}</span>
            <span class="status-badge">${roleLabel}</span>
          </div>
        </div>
        <p class="admin-user-email">${escapeHtml(user.email)}</p>
        <div class="admin-user-meta">
          <span>积分：<strong>${escapeHtml(user.points)}</strong></span>
          <span>注册：${formatTime(user.created_at)}</span>
          <span>更新：${formatTime(user.updated_at)}</span>
        </div>
      </div>
      <div class="admin-user-actions">
        <button type="button" class="ghost compact admin-points-grant">发积分</button>
        <button type="button" class="ghost compact admin-points-deduct">扣积分</button>
        <button type="button" class="ghost compact admin-status-toggle">${user.is_active ? '禁用' : '启用'}</button>
      </div>
    `;

    item.querySelector('.admin-points-grant')?.addEventListener('click', () => openPointsModal(user, 'grant'));
    item.querySelector('.admin-points-deduct')?.addEventListener('click', () => openPointsModal(user, 'deduct'));
    item.querySelector('.admin-status-toggle')?.addEventListener('click', async () => {
      const actionLabel = user.is_active ? '禁用' : '启用';
      const confirmed = window.confirm(`确认${actionLabel}用户 ${user.username} 吗？`);
      if (!confirmed) return;

      try {
        await api(`/api/admin/users/${user.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !user.is_active }),
        });
        setGlobalMsg(`已${actionLabel}用户 ${user.username}`);
        await refreshAdminUsers();
      } catch (err) {
        setGlobalMsg(err.message);
      }
    });

    els.adminUsersList.appendChild(item);
  });
}

function syncAdminFiltersToInputs() {
  els.adminSearchInput.value = state.adminUsers.query;
  els.adminRoleFilter.value = state.adminUsers.role;
  els.adminStatusFilter.value = state.adminUsers.status;
}

async function refreshAdminUsers(options = {}) {
  if (!isSuperAdmin()) {
    state.adminUsers = {
      ...state.adminUsers,
      page: 1,
      total: 0,
      totalPages: 1,
      items: [],
      summary: { total: 0, activeTotal: 0, disabledTotal: 0, superAdminTotal: 0 },
    };
    els.adminSummary.textContent = '';
    renderAdminUsers([]);
    renderAdminPagination();
    return;
  }

  if (typeof options.query === 'string') state.adminUsers.query = options.query.trim();
  if (typeof options.role === 'string') state.adminUsers.role = options.role.trim();
  if (typeof options.status === 'string') state.adminUsers.status = options.status.trim();
  if (options.page) state.adminUsers.page = Math.max(Number(options.page) || 1, 1);

  syncAdminFiltersToInputs();

  const queryParams = new URLSearchParams({
    page: String(state.adminUsers.page),
    limit: String(state.adminUsers.limit),
  });
  if (state.adminUsers.query) queryParams.set('query', state.adminUsers.query);
  if (state.adminUsers.role) queryParams.set('role', state.adminUsers.role);
  if (state.adminUsers.status) queryParams.set('status', state.adminUsers.status);

  const data = await api(`/api/admin/users?${queryParams.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};

  state.adminUsers.page = Math.max(Number(pagination.page) || state.adminUsers.page, 1);
  state.adminUsers.limit = Math.max(Number(pagination.limit) || state.adminUsers.limit, 1);
  state.adminUsers.total = Math.max(Number(pagination.total) || rows.length, 0);
  state.adminUsers.totalPages = Math.max(Number(pagination.totalPages) || 1, 1);
  state.adminUsers.items = rows;
  state.adminUsers.summary = {
    total: Number(summary.total || 0),
    activeTotal: Number(summary.activeTotal || 0),
    disabledTotal: Number(summary.disabledTotal || 0),
    superAdminTotal: Number(summary.superAdminTotal || 0),
  };

  els.adminStatTotal.textContent = state.adminUsers.summary.total;
  els.adminStatActive.textContent = state.adminUsers.summary.activeTotal;
  els.adminStatDisabled.textContent = state.adminUsers.summary.disabledTotal;
  els.adminStatSuper.textContent = state.adminUsers.summary.superAdminTotal;
  els.adminSummary.textContent = state.adminUsers.total > 0
    ? `共 ${state.adminUsers.total} 个匹配用户，当前每页 ${state.adminUsers.limit} 条。`
    : '暂无匹配用户。';
  els.adminUsersHint.textContent = state.adminUsers.total > 0
    ? '支持搜索用户ID、用户名、邮箱；积分与状态操作实时生效。'
    : '可调整筛选条件后重新查询。';

  renderAdminUsers(rows);
  renderAdminPagination();
}

function renderJobPreview(row) {
  const status = String(row.status || '').toLowerCase();

  if (status === 'queued' || status === 'processing') {
    const progress = status === 'queued' ? 30 : 68;
    const label = status === 'queued' ? '排队中' : '处理中';
    return `
      <div class="job-preview progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        <div class="hint compact">${label}</div>
      </div>
    `;
  }

  if (!row.public_url) {
    return '<div class="job-preview empty">暂无输出</div>';
  }

  if (row.file_type === 'text') {
    const previewText = row.output_preview_text || '文本结果';
    return `<div class="job-preview text-preview"><pre>${escapeHtml(previewText)}</pre></div>`;
  }

  if (row.file_type === 'image') {
    const mediaUrl = getSafeMediaUrl(row.public_url);
    if (!mediaUrl) return '<div class="job-preview empty">暂无输出</div>';
    return `<div class="job-preview"><img src="${mediaUrl}" alt="output" />${getMediaActionOverlay(row)}</div>`;
  }

  if (row.file_type === 'audio') {
    const mediaUrl = getSafeMediaUrl(row.public_url);
    if (!mediaUrl) return '<div class="job-preview empty">暂无输出</div>';
    return `<div class="job-preview"><audio controls src="${mediaUrl}"></audio></div>`;
  }

  const mediaUrl = getSafeMediaUrl(row.public_url);
  if (!mediaUrl) return '<div class="job-preview empty">暂无输出</div>';
  return `<div class="job-preview"><video controls src="${mediaUrl}"></video>${getMediaActionOverlay(row)}</div>`;
}

function renderHistoryRows(rows) {
  els.historyList.innerHTML = '';

  if (rows.length === 0) {
    els.historyList.innerHTML = '<p class="hint">暂无记录</p>';
    return;
  }

  rows.forEach((row) => {
    const div = document.createElement('div');
    const status = String(row.status || '').toLowerCase();
    const errorText = row.error_message ? `<p class="job-error">错误：${escapeHtml(row.error_message)}</p>` : '';

    div.className = 'history-item job';
    div.innerHTML = `
      <div class="job-main">
        <div class="job-topline">
          <strong>${CAPABILITY_LABELS[row.capability] || escapeHtml(row.capability)}</strong>
          <span class="status-badge ${status}">${escapeHtml(row.status)}</span>
        </div>
        <p class="job-meta">模型：${escapeHtml(row.model_name || row.model_code || '-')} ｜ 消耗：${escapeHtml(row.cost_points)}</p>
        <p class="job-prompt">${escapeHtml(row.prompt_text || '')}</p>
        <p class="job-meta">${formatTime(row.created_at)}</p>
        ${errorText}
      </div>
      ${renderJobPreview(row)}
    `;

    const previewBtn = div.querySelector('.preview-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => openPreview(row));
    }

    els.historyList.appendChild(div);
  });
}

async function refreshHistory(options = {}) {
  const targetPage = Math.max(Number(options.page || state.history.page || 1), 1);

  if (state.user === null) {
    stopJobPolling();
    state.history = { ...state.history, page: 1, total: 0, totalPages: 1, hasRunningJobs: false };
    els.historySummary.textContent = '';
    els.historyList.innerHTML = '<p class="hint">请登录</p>';
    renderHistoryPagination();
    return;
  }

  const data = await api(`/api/generation/history?limit=${state.history.limit}&page=${targetPage}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const pagination = data?.pagination || {};

  state.history.page = Math.max(Number(pagination.page) || targetPage, 1);
  state.history.limit = Math.max(Number(pagination.limit) || state.history.limit, 1);
  state.history.total = Math.max(Number(pagination.total) || rows.length, 0);
  state.history.totalPages = Math.max(Number(pagination.totalPages) || 1, 1);
  state.history.hasRunningJobs = Boolean(data?.hasRunningJobs);

  els.historySummary.textContent = state.history.total > 0
    ? `共 ${state.history.total} 条记录，当前每页 ${state.history.limit} 条。`
    : '暂无生成记录。';

  renderHistoryRows(rows);
  renderHistoryPagination();
  ensureJobPolling(state.history.hasRunningJobs, Boolean(options.immediatePoll));
}

async function refreshLedger(options = {}) {
  const targetPage = Math.max(Number(options.page || state.ledger.page || 1), 1);

  if (state.user === null) {
    state.ledger = { ...state.ledger, page: 1, total: 0, totalPages: 1 };
    els.ledgerSummary.textContent = '';
    els.ledgerList.innerHTML = '<p class="hint">请登录</p>';
    renderLedgerPagination();
    return;
  }

  const data = await api(`/api/user/points-ledger?limit=${state.ledger.limit}&page=${targetPage}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const pagination = data?.pagination || {};

  state.ledger.page = Math.max(Number(pagination.page) || targetPage, 1);
  state.ledger.limit = Math.max(Number(pagination.limit) || state.ledger.limit, 1);
  state.ledger.total = Math.max(Number(pagination.total) || rows.length, 0);
  state.ledger.totalPages = Math.max(Number(pagination.totalPages) || 1, 1);

  els.ledgerSummary.textContent = state.ledger.total > 0
    ? `共 ${state.ledger.total} 条记录`
    : '暂无记录';
  els.ledgerList.innerHTML = '';

  if (rows.length === 0) {
    els.ledgerList.innerHTML = '<p class="hint">暂无流水</p>';
    renderLedgerPagination();
    return;
  }

  rows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'history-item ledger-item';
    div.innerHTML = `
      <p><strong>${escapeHtml(row.reason)}</strong> | 变动: ${row.change_amount > 0 ? '+' : ''}${escapeHtml(row.change_amount)}</p>
      <p>余额: ${escapeHtml(row.balance_after)}</p>
      <p>${formatTime(row.created_at)}</p>
    `;
    els.ledgerList.appendChild(div);
  });

  renderLedgerPagination();
}

async function handleLogout() {
  if (state.user) {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (_err) {
      // ignore network errors and still clear local state
    }
  }

  state.user = null;
  state.costs = [];
  state.models = [];
  state.modelsByCapability = {};
  state.adminUsers = {
    ...state.adminUsers,
    page: 1,
    total: 0,
    totalPages: 1,
    query: '',
    role: '',
    status: '',
    items: [],
    summary: { total: 0, activeTotal: 0, disabledTotal: 0, superAdminTotal: 0 },
  };
  state.ui.authOpen = false;
  state.ui.view = 'console';
  state.history = { ...state.history, page: 1, total: 0, totalPages: 1, hasRunningJobs: false };
  state.ledger = { ...state.ledger, page: 1, total: 0, totalPages: 1 };
  renderAuthState();
  await Promise.all([refreshHistory({ page: 1 }), refreshLedger({ page: 1 }), refreshModels(), refreshAdminUsers({ page: 1 })]);
  setGlobalMsg('已退出登录');
}

els.tabs.forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

els.authActionBtn.addEventListener('click', async () => {
  if (state.user) {
    await handleLogout();
  } else {
    openAuthPanel('login');
  }
});

els.consoleNavBtn.addEventListener('click', () => {
  state.ui.view = 'console';
  renderViewState();
});

els.adminNavBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  state.ui.view = 'admin';
  renderViewState();
  try {
    await refreshAdminUsers();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.closeAuthBtn.addEventListener('click', () => {
  closeAuthPanel();
  setGlobalMsg('');
});

els.authPanel.addEventListener('click', (event) => {
  if (event.target === els.authPanel) {
    closeAuthPanel();
    setGlobalMsg('');
  }
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setGlobalMsg('');
  setAuthMsg('');

  const fd = new FormData(els.loginForm);

  try {
    setButtonLoading(els.loginSubmitBtn, '登录中...', true);
    const authData = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: fd.get('account'),
        password: fd.get('password'),
      }),
    });

    els.loginForm.reset();
    await refreshMe({ authJustSet: true, fallbackUser: authData?.user || null });
    setGlobalMsg('登录成功');
  } catch (err) {
    setAuthMsg(err.message);
    setGlobalMsg(err.message);
  } finally {
    setButtonLoading(els.loginSubmitBtn, '登录中...', false);
  }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setGlobalMsg('');
  setAuthMsg('');

  const fd = new FormData(els.registerForm);
  const username = String(fd.get('username') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const validationError = validateRegisterFormInput({ username, email, password });
  if (validationError) {
    setAuthMsg(validationError);
    setGlobalMsg(validationError);
    return;
  }

  try {
    setButtonLoading(els.registerSubmitBtn, '注册中...', true);
    const authData = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    els.registerForm.reset();
    await refreshMe({ authJustSet: true, fallbackUser: authData?.user || null });
    setGlobalMsg('注册成功，已自动登录');
  } catch (err) {
    setAuthMsg(err.message);
    setGlobalMsg(err.message);
  } finally {
    setButtonLoading(els.registerSubmitBtn, '注册中...', false);
  }
});

els.capabilitySelect.addEventListener('change', () => {
  updateCapabilityInputs();
  renderModelOptions();
  updatePromptCounter();
});

els.modelSelect.addEventListener('change', () => {
  renderModelPanel();
});

els.refreshModelsBtn.addEventListener('click', async () => {
  if (state.user === null) {
    requireLogin('请先登录');
    return;
  }

  const previousModelCode = els.modelSelect.value;
  setGenerateMsg('模型列表刷新中...');
  const ok = await refreshModels(previousModelCode);
  if (ok) {
    setGenerateMsg('模型列表已刷新。');
  }
});

els.historyPrevBtn.addEventListener('click', async () => {
  if (state.user === null || state.history.page <= 1) return;
  await refreshHistory({ page: state.history.page - 1 });
});

els.historyNextBtn.addEventListener('click', async () => {
  if (state.user === null || state.history.page >= state.history.totalPages) return;
  await refreshHistory({ page: state.history.page + 1 });
});

els.ledgerPrevBtn.addEventListener('click', async () => {
  if (state.user === null || state.ledger.page <= 1) return;
  await refreshLedger({ page: state.ledger.page - 1 });
});

els.ledgerNextBtn.addEventListener('click', async () => {
  if (state.user === null || state.ledger.page >= state.ledger.totalPages) return;
  await refreshLedger({ page: state.ledger.page + 1 });
});

els.adminRefreshBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminUsers({ page: 1 });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminSearchBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminUsers({
      page: 1,
      query: els.adminSearchInput.value,
      role: els.adminRoleFilter.value,
      status: els.adminStatusFilter.value,
    });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminSearchInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  els.adminSearchBtn.click();
});

els.adminRoleFilter.addEventListener('change', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminUsers({
      page: 1,
      query: els.adminSearchInput.value,
      role: els.adminRoleFilter.value,
      status: els.adminStatusFilter.value,
    });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminStatusFilter.addEventListener('change', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminUsers({
      page: 1,
      query: els.adminSearchInput.value,
      role: els.adminRoleFilter.value,
      status: els.adminStatusFilter.value,
    });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminUsersPrevBtn.addEventListener('click', async () => {
  if (!isSuperAdmin() || state.adminUsers.page <= 1) return;
  try {
    await refreshAdminUsers({ page: state.adminUsers.page - 1 });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminUsersNextBtn.addEventListener('click', async () => {
  if (!isSuperAdmin() || state.adminUsers.page >= state.adminUsers.totalPages) return;
  try {
    await refreshAdminUsers({ page: state.adminUsers.page + 1 });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.promptInput.addEventListener('input', () => {
  updatePromptCounter();
});

els.previewCloseBtn.addEventListener('click', closePreview);
els.previewBackdrop.addEventListener('click', closePreview);
els.pointsCloseBtn.addEventListener('click', closePointsModal);
els.pointsBackdrop.addEventListener('click', closePointsModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.previewModal.classList.contains('hidden') === false) {
    closePreview();
  }
  if (event.key === 'Escape' && els.pointsModal.classList.contains('hidden') === false) {
    closePointsModal();
  }
});

els.pointsActionSelect.addEventListener('change', () => {
  els.pointsModalTitle.textContent = els.pointsActionSelect.value === 'deduct' ? '扣减积分' : '发放积分';
});

els.pointsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const targetUser = state.ui.pointsTargetUser;
  if (!targetUser) {
    setPointsFormMsg('未找到目标用户');
    return;
  }

  const action = els.pointsActionSelect.value;
  const amount = Number.parseInt(els.pointsAmountInput.value, 10);
  const reason = String(els.pointsReasonInput.value || '').trim();

  if (!['grant', 'deduct'].includes(action)) {
    setPointsFormMsg('请选择正确的操作类型');
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    setPointsFormMsg('请输入大于 0 的积分数量');
    return;
  }
  if (reason.length < 2) {
    setPointsFormMsg('请填写至少 2 个字的原因说明');
    return;
  }

  try {
    setButtonLoading(els.pointsSubmitBtn, '提交中...', true);
    await api(`/api/admin/users/${targetUser.id}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amount, reason }),
    });
    closePointsModal();
    setGlobalMsg(`${action === 'deduct' ? '扣减' : '发放'}积分成功`);
    await refreshAdminUsers();
    if (targetUser.id === state.user?.id) {
      await refreshUserSnapshot();
    }
  } catch (err) {
    setPointsFormMsg(err.message);
  } finally {
    setButtonLoading(els.pointsSubmitBtn, '提交中...', false);
  }
});

els.generateForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (state.user === null) {
    setGenerateMsg('请先登录');
    requireLogin('请先登录');
    return;
  }

  setGenerateMsg('任务提交中...');
  setGlobalMsg('');

  els.submitBtn.disabled = true;

  const fd = new FormData(els.generateForm);
  const capability = String(fd.get('capability') || '').trim();
  const prompt = String(fd.get('prompt') || '').trim();
  const lyrics = String(fd.get('lyrics') || '').trim();
  const isInstrumental = fd.get('isInstrumental') === 'on';
  const modelCodeRaw = String(fd.get('modelCode') || '').trim();
  const payload = { capability, prompt };
  const promptMaxLength = getPromptMaxLength(capability);

  if (prompt.length > promptMaxLength) {
    setGenerateMsg(`Prompt 长度不能超过 ${promptMaxLength} 个字符`);
    els.submitBtn.disabled = false;
    return;
  }

  if (modelCodeRaw) payload.modelCode = modelCodeRaw;
  if (capability === 'music_generation') {
    if (lyrics) payload.lyrics = lyrics;
    if (isInstrumental) payload.isInstrumental = true;
  }

  try {
    let result;

    if (capability === 'image_to_image') {
      const file = fd.get('inputImage');
      if (!file || file instanceof File === false || file.size === 0) {
        throw new Error('图生图请上传输入图片');
      }

      const uploadFd = new FormData();
      uploadFd.append('capability', capability);
      uploadFd.append('prompt', prompt);
      if (payload.modelCode) uploadFd.append('modelCode', payload.modelCode);
      uploadFd.append('inputImage', file);

      result = await api('/api/generation/submit-with-file', {
        method: 'POST',
        body: uploadFd,
      });
    } else {
      result = await api('/api/generation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const modelName = result?.model?.name || result?.model?.code || payload.modelCode || '默认模型';
    if (result?.status === 'queued' || result?.status === 'processing') {
      setGenerateMsg('任务已提交。模型: ' + modelName);
      ensureJobPolling(true, true);
    } else {
      setGenerateMsg('生成完成，已使用模型: ' + modelName);
    }

    await refreshMe();
    els.generateForm.reset();
    updateCapabilityInputs();
    renderModelOptions(payload.modelCode);
    updatePromptCounter();
  } catch (err) {
    setGenerateMsg(err.message);
  } finally {
    els.submitBtn.disabled = false;
  }
});

showTab('login');
updateCapabilityInputs();
renderModelOptions();
updatePromptCounter();
renderAuthState();
refreshMe();
