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

const ADMIN_ACTION_LABELS = {
  grant_points: '发积分',
  deduct_points: '扣积分',
  enable_user: '启用用户',
  disable_user: '禁用用户',
  change_role: '修改角色',
  update_system_settings: '更新系统设置',
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

const protectedMediaCache = new Map();

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
  adminLogs: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    query: '',
    actionType: '',
    items: [],
  },
  adminApiUsage: {
    provider: '',
    keyMasked: '',
    source: '',
    syncedAt: '',
    overview: {
      modelCount: 0,
      intervalTotal: 0,
      intervalUsed: 0,
      weeklyTotal: 0,
      weeklyUsed: 0,
      exhaustedModels: 0,
      nearLimitModels: 0,
    },
    items: [],
  },
  systemSettings: {
    registerEnabled: true,
    registerBonusPoints: 100,
  },
  publicAuthSettings: {
    registerEnabled: true,
    registerBonusPoints: 100,
  },
  ui: {
    authOpen: false,
    jobPollTimer: null,
    jobPollBusy: false,
    view: 'console',
    adminSection: 'users',
    registerEnabledLoaded: false,
    pointsModalOpen: false,
    pointsTargetUser: null,
    roleModalOpen: false,
    roleTargetUser: null,
    adminDetailOpen: false,
    adminDetailUserId: null,
    adminDetailGenerations: [],
  },
};

const els = {
  authPanel: document.getElementById('authPanel'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  workspace: document.getElementById('workspace'),
  globalMsg: document.getElementById('globalMsg'),
  authMsg: document.getElementById('authMsg'),
  authSubtitle: document.getElementById('authSubtitle'),
  sessionHint: document.getElementById('sessionHint'),
  authActionBtn: document.getElementById('authActionBtn'),
  workspaceNav: document.getElementById('workspaceNav'),
  consoleNavBtn: document.getElementById('consoleNavBtn'),
  adminNavBtn: document.getElementById('adminNavBtn'),
  consoleView: document.getElementById('consoleView'),
  adminView: document.getElementById('adminView'),
  adminUsersTabBtn: document.getElementById('adminUsersTabBtn'),
  adminLogsTabBtn: document.getElementById('adminLogsTabBtn'),
  adminApiUsageTabBtn: document.getElementById('adminApiUsageTabBtn'),
  adminSettingsTabBtn: document.getElementById('adminSettingsTabBtn'),
  adminUsersSection: document.getElementById('adminUsersSection'),
  adminLogsSection: document.getElementById('adminLogsSection'),
  adminApiUsageSection: document.getElementById('adminApiUsageSection'),
  adminSettingsSection: document.getElementById('adminSettingsSection'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  registerSubmitBtn: document.getElementById('registerSubmitBtn'),
  registerTabBtn: document.getElementById('registerTabBtn'),
  registerFormNote: document.getElementById('registerFormNote'),
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
  adminLogSearchInput: document.getElementById('adminLogSearchInput'),
  adminLogActionFilter: document.getElementById('adminLogActionFilter'),
  adminLogSearchBtn: document.getElementById('adminLogSearchBtn'),
  adminLogsRefreshBtn: document.getElementById('adminLogsRefreshBtn'),
  adminLogsList: document.getElementById('adminLogsList'),
  adminLogsHint: document.getElementById('adminLogsHint'),
  adminLogsPrevBtn: document.getElementById('adminLogsPrevBtn'),
  adminLogsNextBtn: document.getElementById('adminLogsNextBtn'),
  adminLogsPageInfo: document.getElementById('adminLogsPageInfo'),
  adminApiUsageSummary: document.getElementById('adminApiUsageSummary'),
  adminApiUsageRefreshBtn: document.getElementById('adminApiUsageRefreshBtn'),
  adminApiProvider: document.getElementById('adminApiProvider'),
  adminApiKeyMasked: document.getElementById('adminApiKeyMasked'),
  adminApiModelCount: document.getElementById('adminApiModelCount'),
  adminApiNearLimit: document.getElementById('adminApiNearLimit'),
  adminApiIntervalProgress: document.getElementById('adminApiIntervalProgress'),
  adminApiIntervalText: document.getElementById('adminApiIntervalText'),
  adminApiWeeklyProgress: document.getElementById('adminApiWeeklyProgress'),
  adminApiWeeklyText: document.getElementById('adminApiWeeklyText'),
  adminApiUsageList: document.getElementById('adminApiUsageList'),
  adminSettingsRefreshBtn: document.getElementById('adminSettingsRefreshBtn'),
  adminSettingsForm: document.getElementById('adminSettingsForm'),
  registerEnabledInput: document.getElementById('registerEnabledInput'),
  registerBonusPointsInput: document.getElementById('registerBonusPointsInput'),
  adminSettingsHint: document.getElementById('adminSettingsHint'),
  adminSettingsMsg: document.getElementById('adminSettingsMsg'),
  adminSettingsSubmitBtn: document.getElementById('adminSettingsSubmitBtn'),
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
  adminDetailModal: document.getElementById('adminDetailModal'),
  adminDetailBackdrop: document.getElementById('adminDetailBackdrop'),
  adminDetailCloseBtn: document.getElementById('adminDetailCloseBtn'),
  adminDetailTitle: document.getElementById('adminDetailTitle'),
  adminDetailBody: document.getElementById('adminDetailBody'),
  roleModal: document.getElementById('roleModal'),
  roleBackdrop: document.getElementById('roleBackdrop'),
  roleCloseBtn: document.getElementById('roleCloseBtn'),
  roleModalTitle: document.getElementById('roleModalTitle'),
  roleTargetText: document.getElementById('roleTargetText'),
  roleForm: document.getElementById('roleForm'),
  roleSelect: document.getElementById('roleSelect'),
  roleReasonInput: document.getElementById('roleReasonInput'),
  roleFormMsg: document.getElementById('roleFormMsg'),
  roleSubmitBtn: document.getElementById('roleSubmitBtn'),
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

function setRoleFormMsg(msg, type = 'error') {
  const normalized = String(msg || '').trim();
  els.roleFormMsg.textContent = normalized;
  els.roleFormMsg.classList.toggle('hidden', normalized.length === 0);
  els.roleFormMsg.dataset.type = normalized.length === 0 ? '' : type;
}

function setAdminSettingsMsg(msg, type = 'error') {
  const normalized = String(msg || '').trim();
  els.adminSettingsMsg.textContent = normalized;
  els.adminSettingsMsg.classList.toggle('hidden', normalized.length === 0);
  els.adminSettingsMsg.dataset.type = normalized.length === 0 ? '' : type;
}

function getRoleLabel(role) {
  return role === 'super_admin' ? '超级管理员' : '普通用户';
}

function getAdminActionLabel(actionType) {
  return ADMIN_ACTION_LABELS[actionType] || actionType || '-';
}

function renderRegisterAvailability() {
  const { registerEnabled, registerBonusPoints } = state.publicAuthSettings;
  state.ui.registerEnabledLoaded = true;
  els.registerTabBtn.disabled = !registerEnabled;
  els.registerTabBtn.classList.toggle('hidden', !registerEnabled);
  els.registerForm.classList.toggle('hidden', !registerEnabled);
  els.registerSubmitBtn.disabled = !registerEnabled;
  els.authSubtitle.textContent = registerEnabled
    ? '登录后可查看记录、积分与生成结果'
    : '当前已关闭注册，仅支持已有账号登录';
  els.registerFormNote.textContent = registerEnabled
    ? `注册成功后将自动登录。当前注册赠送 ${registerBonusPoints} 积分。`
    : '当前已关闭注册。';

  if (!registerEnabled && els.registerForm.classList.contains('active')) {
    showTab('login');
  }
}

function renderAdminSettingsForm() {
  els.registerEnabledInput.checked = Boolean(state.systemSettings.registerEnabled);
  els.registerBonusPointsInput.value = String(state.systemSettings.registerBonusPoints ?? 0);
  els.adminSettingsHint.textContent = `当前状态：${state.systemSettings.registerEnabled ? '开放注册' : '关闭注册'} ｜ 注册赠送 ${state.systemSettings.registerBonusPoints} 积分`;
  setAdminSettingsMsg('');
}

function formatRatio(used, total) {
  const totalCount = Math.max(Number(total) || 0, 0);
  const remaining = Math.max(totalCount - (Number(used) || 0), 0);
  return `${remaining}/${totalCount}`;
}

function formatPercent(rate) {
  const value = Math.max(0, Math.min(Number(rate) || 0, 1));
  return `${Math.round(value * 100)}%`;
}

function formatRemainMs(ms) {
  const safe = Math.max(Number(ms) || 0, 0);
  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

function describeAdminAction(row) {
  if (!row) return '-';
  if (row.action_type === 'grant_points' || row.action_type === 'deduct_points') {
    const delta = Number(row.change_amount || 0);
    const deltaText = `${delta > 0 ? '+' : ''}${delta}`;
    return `${deltaText} 积分 ｜ ${row.before_value ?? '-'} → ${row.after_value ?? '-'}`;
  }
  if (row.action_type === 'enable_user' || row.action_type === 'disable_user') {
    return `${row.before_value === 1 ? '启用' : '禁用'} → ${row.after_value === 1 ? '启用' : '禁用'}`;
  }
  if (row.action_type === 'change_role') {
    return row.note || '角色已调整';
  }
  return row.note || '-';
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

async function getProtectedMediaObjectUrl(mediaUrl) {
  if (!mediaUrl) return '';
  if (protectedMediaCache.has(mediaUrl)) {
    return protectedMediaCache.get(mediaUrl);
  }

  const response = await fetch(mediaUrl, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`媒体加载失败(HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  protectedMediaCache.set(mediaUrl, objectUrl);
  return objectUrl;
}

async function hydrateProtectedPreview(container, row) {
  if (!container || !row) return;
  const mediaUrl = getSafeMediaUrl(row.public_url);
  if (!mediaUrl) {
    container.innerHTML = '<div class="hint compact">暂无预览</div>';
    return;
  }

  container.innerHTML = '<div class="hint compact">加载预览中...</div>';

  try {
    const objectUrl = await getProtectedMediaObjectUrl(mediaUrl);
    if (!container.isConnected) return;

    if (row.file_type === 'image') {
      container.innerHTML = `<img src="${objectUrl}" alt="result preview" />`;
      return;
    }
    if (row.file_type === 'video') {
      container.innerHTML = `<video controls preload="metadata" src="${objectUrl}"></video>`;
      return;
    }
    if (row.file_type === 'audio') {
      container.innerHTML = `<audio controls preload="metadata" src="${objectUrl}"></audio>`;
      return;
    }

    container.innerHTML = '<div class="hint compact">暂不支持该类型预览</div>';
  } catch (_err) {
    if (!container.isConnected) return;
    container.innerHTML = '<div class="hint compact">预览加载失败</div>';
  }
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
  if (tab === 'register' && state.publicAuthSettings.registerEnabled === false) {
    tab = 'login';
  }
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
    state.ui.adminSection = 'users';
  }

  els.workspaceNav.classList.toggle('hidden', !canAdmin);
  els.consoleNavBtn.classList.toggle('active', state.ui.view === 'console');
  els.adminNavBtn.classList.toggle('active', state.ui.view === 'admin');
  els.consoleView.classList.toggle('hidden', state.ui.view !== 'console');
  els.adminView.classList.toggle('hidden', state.ui.view !== 'admin' || !canAdmin);
  renderAdminSectionState();
}

function renderAdminSectionState() {
  const showUsers = isSuperAdmin() && state.ui.view === 'admin' && state.ui.adminSection === 'users';
  const showLogs = isSuperAdmin() && state.ui.view === 'admin' && state.ui.adminSection === 'logs';
  const showApiUsage = isSuperAdmin() && state.ui.view === 'admin' && state.ui.adminSection === 'api_usage';
  const showSettings = isSuperAdmin() && state.ui.view === 'admin' && state.ui.adminSection === 'settings';

  els.adminUsersTabBtn.classList.toggle('active', showUsers);
  els.adminLogsTabBtn.classList.toggle('active', showLogs);
  els.adminApiUsageTabBtn.classList.toggle('active', showApiUsage);
  els.adminSettingsTabBtn.classList.toggle('active', showSettings);
  els.adminUsersSection.classList.toggle('hidden', !showUsers);
  els.adminLogsSection.classList.toggle('hidden', !showLogs);
  els.adminApiUsageSection.classList.toggle('hidden', !showApiUsage);
  els.adminSettingsSection.classList.toggle('hidden', !showSettings);
  if (!isSuperAdmin() || state.ui.view !== 'admin') {
    els.adminSummary.textContent = '';
  } else if (showUsers) {
    els.adminSummary.textContent = state.adminUsers.total > 0
      ? `共 ${state.adminUsers.total} 个匹配用户，当前每页 ${state.adminUsers.limit} 条。`
      : '暂无匹配用户。';
  } else if (showLogs) {
    els.adminSummary.textContent = state.adminLogs.total > 0
      ? `共 ${state.adminLogs.total} 条日志，当前每页 ${state.adminLogs.limit} 条。`
      : '暂无匹配日志。';
  } else if (showApiUsage) {
    els.adminSummary.textContent = state.adminApiUsage.provider
      ? `Provider：${state.adminApiUsage.provider} ｜ 最近同步：${formatTime(state.adminApiUsage.syncedAt)}`
      : 'API Key 使用情况待加载。';
  } else if (showSettings) {
    els.adminSummary.textContent = `注册：${state.systemSettings.registerEnabled ? '开放' : '关闭'} ｜ 新用户积分：${state.systemSettings.registerBonusPoints}`;
  }
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

function renderAdminLogsPagination() {
  const { page, totalPages, total } = state.adminLogs;
  els.adminLogsPageInfo.textContent = `第 ${page} / ${totalPages} 页`;
  els.adminLogsPrevBtn.disabled = page <= 1 || !isSuperAdmin();
  els.adminLogsNextBtn.disabled = page >= totalPages || !isSuperAdmin() || total === 0;
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

function openRoleModal(user) {
  state.ui.roleModalOpen = true;
  state.ui.roleTargetUser = user || null;
  els.roleSelect.value = user?.role || 'user';
  els.roleReasonInput.value = '';
  els.roleModalTitle.textContent = '修改角色';
  els.roleTargetText.textContent = user
    ? `用户 #${user.id} · ${user.username} · 当前角色 ${getRoleLabel(user.role)}`
    : '';
  setRoleFormMsg('');
  els.roleModal.classList.remove('hidden');
}

function closeRoleModal() {
  state.ui.roleModalOpen = false;
  state.ui.roleTargetUser = null;
  els.roleReasonInput.value = '';
  setRoleFormMsg('');
  els.roleModal.classList.add('hidden');
}

function closeAdminDetailModal() {
  state.ui.adminDetailOpen = false;
  state.ui.adminDetailUserId = null;
  state.ui.adminDetailGenerations = [];
  els.adminDetailModal.classList.add('hidden');
}

function buildAdminPreviewPayload(job, output = null) {
  return {
    capability: job.capability,
    model_name: job.model_name,
    model_code: job.model_code,
    file_type: output?.file_type || 'text',
    public_url: output?.public_url || '',
    output_preview_text: output?.output_preview_text || '',
  };
}

function getJobStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'failed', 'processing', 'queued'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function renderAdminDetail(data) {
  const user = data?.user || null;
  const summary = data?.summary || {};
  const ledgerItems = Array.isArray(data?.recentLedger) ? data.recentLedger : [];
  const generationItems = Array.isArray(data?.recentGenerations) ? data.recentGenerations : [];
  state.ui.adminDetailGenerations = generationItems;

  if (!user) {
    els.adminDetailBody.innerHTML = '<p class="hint">未找到用户信息</p>';
    return;
  }

  els.adminDetailTitle.textContent = `用户详情 · ${user.username}`;

  const ledgerHtml = ledgerItems.length
    ? ledgerItems
        .map(
          (row) => `
            <div class="detail-list-item detail-ledger-item">
              <div class="detail-ledger-head">
                <strong>${escapeHtml(row.reason)}</strong>
                <span class="detail-ledger-delta ${row.change_amount >= 0 ? 'up' : 'down'}">${row.change_amount > 0 ? '+' : ''}${escapeHtml(row.change_amount)}</span>
              </div>
              <p>余额：${escapeHtml(row.balance_after)}</p>
              <p>${formatTime(row.created_at)}</p>
            </div>
          `,
        )
        .join('')
    : '<p class="hint compact">暂无积分流水</p>';

  const generationHtml = generationItems.length
    ? generationItems
        .map((row, index) => {
          const outputs = Array.isArray(row.outputs) ? row.outputs : [];
          const outputsHtml = outputs.length
            ? outputs
                .map((output, outputIndex) => {
                  const mediaUrl = getSafeMediaUrl(output.public_url);
                  const canPreview = Boolean(mediaUrl) || output.file_type === 'text';
                  const previewPayload = buildAdminPreviewPayload(row, output);
                  const inlinePreview =
                    output.file_type === 'text' && output.output_preview_text
                      ? `<div class="detail-output-preview text"><pre>${escapeHtml(output.output_preview_text)}</pre></div>`
                      : `<div class="detail-output-preview" data-job-index="${index}" data-output-index="${outputIndex}"><div class="hint compact">加载预览中...</div></div>`;
                  return `
                    <article class="admin-output-card">
                      <div class="admin-output-head">
                        <span class="status-badge">${escapeHtml(output.file_type || 'file')}</span>
                        <span class="hint compact">结果 ${outputIndex + 1}</span>
                      </div>
                      ${inlinePreview}
                      <div class="detail-action-row">
                        ${canPreview ? `<button type="button" class="ghost compact admin-detail-preview-btn" data-job-index="${index}" data-output-index="${outputIndex}">预览</button>` : ''}
                        ${mediaUrl ? `<a class="ghost compact detail-link-btn" href="${mediaUrl}" download target="_blank" rel="noreferrer">下载</a>` : ''}
                      </div>
                    </article>
                  `;
                })
                .join('')
            : `
              <div class="admin-output-empty">
                <div class="job-preview progress">
                  <div class="progress-bar"><div class="progress-fill" style="width:${row.status === 'processing' ? 68 : 30}%"></div></div>
                  <div class="hint compact">${row.status === 'processing' ? '处理中' : row.status === 'queued' ? '排队中' : row.status === 'failed' ? '生成失败' : '暂无输出'}</div>
                </div>
              </div>
            `;

          return `
            <article class="detail-list-item admin-job-card">
              <div class="admin-job-head">
                <div>
                  <strong>${escapeHtml(CAPABILITY_LABELS[row.capability] || row.capability)}</strong>
                  <p class="admin-job-model">${escapeHtml(row.model_name || row.model_code || '-')}</p>
                </div>
                <div class="admin-job-tags">
                  <span class="status-badge ${getJobStatusClass(row.status)}">${escapeHtml(row.status)}</span>
                  <span class="status-badge">消耗 ${escapeHtml(row.cost_points)}</span>
                </div>
              </div>
              <div class="admin-job-meta">
                <span>任务号：${escapeHtml(row.job_uuid)}</span>
                <span>时间：${formatTime(row.created_at)}</span>
                <span>结果数：${outputs.length}</span>
              </div>
              <p class="detail-prompt admin-job-prompt">${escapeHtml(row.prompt_text || '')}</p>
              ${row.error_message ? `<p class="job-error">错误：${escapeHtml(row.error_message)}</p>` : ''}
              <div class="admin-output-grid">${outputsHtml}</div>
            </article>
          `;
        })
        .join('')
    : '<p class="hint compact">暂无生成记录</p>';

  els.adminDetailBody.innerHTML = `
    <section class="admin-detail-top">
      <div class="stat-card">
        <span class="stat-label">用户ID</span>
        <strong>#${escapeHtml(user.id)}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">角色</span>
        <strong>${escapeHtml(getRoleLabel(user.role))}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">当前积分</span>
        <strong>${escapeHtml(user.points)}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">状态</span>
        <strong>${user.is_active ? '启用' : '禁用'}</strong>
      </div>
    </section>
    <section class="detail-card admin-detail-overview">
      <div class="section-head">
        <div>
          <h3>账户概览</h3>
        </div>
      </div>
      <div class="admin-detail-meta">
      <p>用户名：${escapeHtml(user.username)}</p>
      <p>邮箱：${escapeHtml(user.email)}</p>
      <p>注册时间：${formatTime(user.created_at)}</p>
      <p>更新时间：${formatTime(user.updated_at)}</p>
      <p>总生成次数：${escapeHtml(summary.generationTotal || 0)} · 积分流水：${escapeHtml(summary.ledgerTotal || 0)}</p>
      </div>
    </section>
    <div class="admin-detail-grid">
      <section class="detail-card">
        <div class="section-head">
          <div>
            <h3>最近积分流水</h3>
          </div>
        </div>
        <div class="detail-list">${ledgerHtml}</div>
      </section>
      <section class="detail-card">
        <div class="section-head">
          <div>
            <h3>最近生成记录</h3>
          </div>
        </div>
        <div class="detail-list">${generationHtml}</div>
      </section>
    </div>
  `;

  els.adminDetailBody.querySelectorAll('.admin-detail-preview-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const jobIndex = Number.parseInt(button.dataset.jobIndex, 10);
      const outputIndex = Number.parseInt(button.dataset.outputIndex, 10);
      const job = state.ui.adminDetailGenerations[jobIndex];
      const output = job?.outputs?.[outputIndex] || null;
      if (job) void openPreview(buildAdminPreviewPayload(job, output));
    });
  });

  els.adminDetailBody.querySelectorAll('.detail-output-preview[data-job-index]').forEach((container) => {
    const jobIndex = Number.parseInt(container.dataset.jobIndex, 10);
    const outputIndex = Number.parseInt(container.dataset.outputIndex, 10);
    const output = state.ui.adminDetailGenerations[jobIndex]?.outputs?.[outputIndex];
    if (output && output.file_type !== 'text') {
      void hydrateProtectedPreview(container, output);
    }
  });
}

async function openAdminDetailModal(userId) {
  state.ui.adminDetailOpen = true;
  state.ui.adminDetailUserId = userId;
  els.adminDetailBody.innerHTML = '<p class="hint">加载中...</p>';
  els.adminDetailModal.classList.remove('hidden');
  try {
    const data = await api(`/api/admin/users/${userId}`);
    renderAdminDetail(data);
  } catch (err) {
    els.adminDetailBody.innerHTML = `<p class="hint">${escapeHtml(err.message)}</p>`;
  }
}

async function openPreview(row) {
  const title = `${CAPABILITY_LABELS[row.capability] || row.capability} · ${row.model_name || row.model_code || '-'}`;
  els.previewTitle.textContent = title;
  const mediaUrl = getSafeMediaUrl(row.public_url);
  els.previewModal.classList.remove('hidden');
  els.previewBody.innerHTML = '<p class="hint">加载预览中...</p>';

  if (row.file_type === 'text') {
    const previewText = row.output_preview_text || '文本结果';
    els.previewBody.innerHTML = `<pre>${escapeHtml(previewText)}</pre>`;
    return;
  }

  if (!mediaUrl) {
    els.previewBody.innerHTML = '<p class="hint">暂无可预览内容</p>';
    return;
  }

  try {
    const objectUrl = await getProtectedMediaObjectUrl(mediaUrl);
    if (row.file_type === 'image') {
      els.previewBody.innerHTML = `<img src="${objectUrl}" alt="preview" />`;
    } else if (row.file_type === 'video') {
      els.previewBody.innerHTML = `<video controls autoplay src="${objectUrl}"></video>`;
    } else if (row.file_type === 'audio') {
      els.previewBody.innerHTML = `<audio controls autoplay src="${objectUrl}"></audio>`;
    } else {
      els.previewBody.innerHTML = '<p class="hint">暂无可预览内容</p>';
    }
  } catch (_err) {
    els.previewBody.innerHTML = '<p class="hint">预览加载失败，请稍后重试</p>';
  }
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

async function refreshRegisterConfig() {
  try {
    const data = await api('/api/auth/register-config');
    state.publicAuthSettings = {
      registerEnabled: Boolean(data?.registerEnabled),
      registerBonusPoints: Math.max(Number(data?.registerBonusPoints) || 0, 0),
    };
  } catch (_err) {
    state.publicAuthSettings = {
      registerEnabled: true,
      registerBonusPoints: 100,
    };
  }

  renderRegisterAvailability();
}

async function refreshAdminSystemSettings() {
  if (!isSuperAdmin()) {
    state.systemSettings = {
      registerEnabled: state.publicAuthSettings.registerEnabled,
      registerBonusPoints: state.publicAuthSettings.registerBonusPoints,
    };
    renderAdminSettingsForm();
    renderAdminSectionState();
    return;
  }

  const data = await api('/api/admin/system-settings');
  state.systemSettings = {
    registerEnabled: Boolean(data?.registerEnabled),
    registerBonusPoints: Math.max(Number(data?.registerBonusPoints) || 0, 0),
  };
  renderAdminSettingsForm();
  renderAdminSectionState();
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
    const tasks = [refreshHistory({ page: 1 }), refreshLedger({ page: 1 }), refreshModels(), refreshRegisterConfig()];
    if (isSuperAdmin()) {
      tasks.push(refreshAdminUsers({ page: 1 }));
      tasks.push(refreshAdminSystemSettings());
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
    closeAdminDetailModal();
    closePointsModal();
    closeRoleModal();
    await refreshRegisterConfig();
    state.adminUsers = {
      ...state.adminUsers,
      page: 1,
      total: 0,
      totalPages: 1,
      items: [],
      summary: { total: 0, activeTotal: 0, disabledTotal: 0, superAdminTotal: 0 },
    };
    state.adminLogs = {
      ...state.adminLogs,
      page: 1,
      total: 0,
      totalPages: 1,
      query: '',
      actionType: '',
      items: [],
    };
    state.adminApiUsage = {
      ...state.adminApiUsage,
      provider: '',
      keyMasked: '',
      source: '',
      syncedAt: '',
      items: [],
      overview: {
        modelCount: 0,
        intervalTotal: 0,
        intervalUsed: 0,
        weeklyTotal: 0,
        weeklyUsed: 0,
        exhaustedModels: 0,
        nearLimitModels: 0,
      },
    };
    state.systemSettings = {
      registerEnabled: state.publicAuthSettings.registerEnabled,
      registerBonusPoints: state.publicAuthSettings.registerBonusPoints,
    };
    state.ui.view = 'console';
    state.ui.adminSection = 'users';
    state.history = { ...state.history, page: 1, total: 0, totalPages: 1, hasRunningJobs: false };
    state.ledger = { ...state.ledger, page: 1, total: 0, totalPages: 1 };
    renderAuthState();
    renderAdminSettingsForm();
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
    const roleLabel = getRoleLabel(user.role);
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
        <button type="button" class="ghost compact admin-view-user">查看</button>
        <button type="button" class="ghost compact admin-role-change">改角色</button>
        <button type="button" class="ghost compact admin-points-grant">发积分</button>
        <button type="button" class="ghost compact admin-points-deduct">扣积分</button>
        <button type="button" class="ghost compact admin-status-toggle">${user.is_active ? '禁用' : '启用'}</button>
      </div>
    `;

    item.querySelector('.admin-view-user')?.addEventListener('click', () => {
      void openAdminDetailModal(user.id);
    });
    item.querySelector('.admin-role-change')?.addEventListener('click', () => openRoleModal(user));
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
        if (state.ui.adminDetailOpen && state.ui.adminDetailUserId === user.id) {
          await openAdminDetailModal(user.id);
        }
        if (state.ui.adminSection === 'logs') {
          await refreshAdminLogs();
        }
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

function renderAdminLogs(rows) {
  els.adminLogsList.innerHTML = '';

  if (!isSuperAdmin()) {
    els.adminLogsList.innerHTML = '<p class="hint">仅超级管理员可访问</p>';
    return;
  }

  if (!rows.length) {
    els.adminLogsList.innerHTML = '<p class="hint">暂无匹配日志</p>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'admin-log-row';
    item.innerHTML = `
      <div class="admin-log-topline">
        <div class="admin-log-title-group">
          <strong>${escapeHtml(getAdminActionLabel(row.action_type))}</strong>
          <span class="admin-user-id">#${escapeHtml(row.id)}</span>
        </div>
        <span class="status-badge">${escapeHtml(getAdminActionLabel(row.action_type))}</span>
      </div>
      <p class="admin-log-meta">操作人：${escapeHtml(row.admin_user?.username || '-')}（#${escapeHtml(row.admin_user?.id || '-')}）</p>
      <p class="admin-log-meta">目标用户：${escapeHtml(row.target_user?.username || '-')}（#${escapeHtml(row.target_user?.id || '-')}）</p>
      <p class="admin-log-meta">${escapeHtml(describeAdminAction(row))}</p>
      ${row.note && row.action_type !== 'change_role' ? `<p class="admin-log-meta">说明：${escapeHtml(row.note)}</p>` : ''}
      <p class="admin-log-meta">${formatTime(row.created_at)}</p>
    `;
    els.adminLogsList.appendChild(item);
  });
}

function syncAdminLogFiltersToInputs() {
  els.adminLogSearchInput.value = state.adminLogs.query;
  els.adminLogActionFilter.value = state.adminLogs.actionType;
}

function renderAdminApiUsage(items) {
  els.adminApiUsageList.innerHTML = '';

  if (!isSuperAdmin()) {
    els.adminApiUsageList.innerHTML = '<p class="hint">仅超级管理员可访问</p>';
    return;
  }

  if (!items.length) {
    els.adminApiUsageList.innerHTML = '<p class="hint">暂无 API 使用数据</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'admin-api-card';
    const intervalRate = Math.max(0, Math.min(Number(item.current_interval_usage_rate) || 0, 1));
    const weeklyRate = Math.max(0, Math.min(Number(item.current_weekly_usage_rate) || 0, 1));
    card.innerHTML = `
      <div class="admin-api-card-head">
        <div>
          <strong>${escapeHtml(item.model_name)}</strong>
          <p class="admin-api-card-meta">当前周期截止：${formatTime(item.end_time)} ｜ 剩余 ${escapeHtml(formatRemainMs(item.remains_time))}</p>
        </div>
      </div>
      <div class="admin-api-meter-grid">
        <div class="usage-meter">
          <div class="admin-api-meter-label">
            <span>当前周期</span>
            <strong>${escapeHtml(formatRatio(item.current_interval_usage_count, item.current_interval_total_count))}</strong>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${intervalRate * 100}%"></div></div>
        </div>
        <div class="usage-meter">
          <div class="admin-api-meter-label">
            <span>本周额度</span>
            <strong>${escapeHtml(formatRatio(item.current_weekly_usage_count, item.current_weekly_total_count))}</strong>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${weeklyRate * 100}%"></div></div>
        </div>
      </div>
      <div class="admin-api-card-foot">
        <span>本周截止：${formatTime(item.weekly_end_time)}</span>
        <span>周剩余 ${escapeHtml(formatRemainMs(item.weekly_remains_time))}</span>
      </div>
    `;
    els.adminApiUsageList.appendChild(card);
  });
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
    els.adminStatTotal.textContent = '0';
    els.adminStatActive.textContent = '0';
    els.adminStatDisabled.textContent = '0';
    els.adminStatSuper.textContent = '0';
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
  els.adminUsersHint.textContent = state.adminUsers.total > 0
    ? '支持搜索用户ID、用户名、邮箱；积分与状态操作实时生效。'
    : '可调整筛选条件后重新查询。';

  renderAdminUsers(rows);
  renderAdminPagination();
  renderAdminSectionState();
}

async function refreshAdminLogs(options = {}) {
  if (!isSuperAdmin()) {
    state.adminLogs = {
      ...state.adminLogs,
      page: 1,
      total: 0,
      totalPages: 1,
      items: [],
    };
    els.adminLogsHint.textContent = '';
    renderAdminLogs([]);
    renderAdminLogsPagination();
    return;
  }

  if (typeof options.query === 'string') state.adminLogs.query = options.query.trim();
  if (typeof options.actionType === 'string') state.adminLogs.actionType = options.actionType.trim();
  if (options.page) state.adminLogs.page = Math.max(Number(options.page) || 1, 1);

  syncAdminLogFiltersToInputs();

  const queryParams = new URLSearchParams({
    page: String(state.adminLogs.page),
    limit: String(state.adminLogs.limit),
  });
  if (state.adminLogs.query) queryParams.set('query', state.adminLogs.query);
  if (state.adminLogs.actionType) queryParams.set('actionType', state.adminLogs.actionType);

  const data = await api(`/api/admin/action-logs?${queryParams.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const pagination = data?.pagination || {};

  state.adminLogs.page = Math.max(Number(pagination.page) || state.adminLogs.page, 1);
  state.adminLogs.limit = Math.max(Number(pagination.limit) || state.adminLogs.limit, 1);
  state.adminLogs.total = Math.max(Number(pagination.total) || rows.length, 0);
  state.adminLogs.totalPages = Math.max(Number(pagination.totalPages) || 1, 1);
  state.adminLogs.items = rows;

  els.adminLogsHint.textContent = state.adminLogs.total > 0
    ? '可按操作类型、日志ID、操作人、目标用户或说明检索。'
    : '可调整筛选条件后重新查询。';

  renderAdminLogs(rows);
  renderAdminLogsPagination();
  renderAdminSectionState();
}

async function refreshAdminApiUsage() {
  if (!isSuperAdmin()) {
    state.adminApiUsage = {
      ...state.adminApiUsage,
      provider: '',
      keyMasked: '',
      source: '',
      syncedAt: '',
      items: [],
      overview: {
        modelCount: 0,
        intervalTotal: 0,
        intervalUsed: 0,
        weeklyTotal: 0,
        weeklyUsed: 0,
        exhaustedModels: 0,
        nearLimitModels: 0,
      },
    };
    els.adminApiUsageSummary.textContent = '';
    renderAdminApiUsage([]);
    renderAdminSectionState();
    return;
  }

  const data = await api('/api/admin/api-key-usage');
  const items = Array.isArray(data?.items) ? data.items : [];
  const overview = data?.overview || {};
  state.adminApiUsage = {
    provider: String(data?.provider || 'minimax'),
    keyMasked: String(data?.keyMasked || ''),
    source: String(data?.source || ''),
    syncedAt: data?.syncedAt || new Date().toISOString(),
    overview: {
      modelCount: Number(overview.modelCount || items.length || 0),
      intervalTotal: Number(overview.intervalTotal || 0),
      intervalUsed: Number(overview.intervalUsed || 0),
      weeklyTotal: Number(overview.weeklyTotal || 0),
      weeklyUsed: Number(overview.weeklyUsed || 0),
      exhaustedModels: Number(overview.exhaustedModels || 0),
      nearLimitModels: Number(overview.nearLimitModels || 0),
    },
    items,
  };

  const intervalRate = state.adminApiUsage.overview.intervalTotal > 0
    ? state.adminApiUsage.overview.intervalUsed / state.adminApiUsage.overview.intervalTotal
    : 0;
  const weeklyRate = state.adminApiUsage.overview.weeklyTotal > 0
    ? state.adminApiUsage.overview.weeklyUsed / state.adminApiUsage.overview.weeklyTotal
    : 0;

  els.adminApiProvider.textContent = state.adminApiUsage.provider;
  els.adminApiKeyMasked.textContent = state.adminApiUsage.keyMasked || '-';
  els.adminApiModelCount.textContent = state.adminApiUsage.overview.modelCount;
  els.adminApiNearLimit.textContent = `${state.adminApiUsage.overview.nearLimitModels}`;
  els.adminApiIntervalProgress.style.width = `${Math.max(0, Math.min(intervalRate, 1)) * 100}%`;
  els.adminApiIntervalText.textContent = formatRatio(
    state.adminApiUsage.overview.intervalUsed,
    state.adminApiUsage.overview.intervalTotal,
  );
  els.adminApiWeeklyProgress.style.width = `${Math.max(0, Math.min(weeklyRate, 1)) * 100}%`;
  els.adminApiWeeklyText.textContent = formatRatio(
    state.adminApiUsage.overview.weeklyUsed,
    state.adminApiUsage.overview.weeklyTotal,
  );
  els.adminApiUsageSummary.textContent = `最近同步：${formatTime(state.adminApiUsage.syncedAt)} ｜ 共 ${state.adminApiUsage.items.length} 个模型配额。`;

  renderAdminApiUsage(items);
  renderAdminSectionState();
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
  closeAdminDetailModal();
  closePointsModal();
  closeRoleModal();
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
  state.adminLogs = {
    ...state.adminLogs,
    page: 1,
    total: 0,
    totalPages: 1,
    query: '',
    actionType: '',
    items: [],
  };
  state.adminApiUsage = {
    ...state.adminApiUsage,
    provider: '',
    keyMasked: '',
    source: '',
    syncedAt: '',
    items: [],
    overview: {
      modelCount: 0,
      intervalTotal: 0,
      intervalUsed: 0,
      weeklyTotal: 0,
      weeklyUsed: 0,
      exhaustedModels: 0,
      nearLimitModels: 0,
    },
  };
  await refreshRegisterConfig();
  state.systemSettings = {
    registerEnabled: state.publicAuthSettings.registerEnabled,
    registerBonusPoints: state.publicAuthSettings.registerBonusPoints,
  };
  state.ui.authOpen = false;
  state.ui.view = 'console';
  state.ui.adminSection = 'users';
  state.history = { ...state.history, page: 1, total: 0, totalPages: 1, hasRunningJobs: false };
  state.ledger = { ...state.ledger, page: 1, total: 0, totalPages: 1 };
  renderAuthState();
  renderAdminSettingsForm();
  await Promise.all([
    refreshHistory({ page: 1 }),
    refreshLedger({ page: 1 }),
    refreshModels(),
    refreshAdminUsers({ page: 1 }),
    refreshAdminLogs({ page: 1 }),
  ]);
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
    if (state.ui.adminSection === 'logs') {
      await refreshAdminLogs();
    } else if (state.ui.adminSection === 'api_usage') {
      await refreshAdminApiUsage();
    } else if (state.ui.adminSection === 'settings') {
      await refreshAdminSystemSettings();
    } else {
      await refreshAdminUsers();
    }
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminUsersTabBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  state.ui.adminSection = 'users';
  renderViewState();
  try {
    await refreshAdminUsers();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminLogsTabBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  state.ui.adminSection = 'logs';
  renderViewState();
  try {
    await refreshAdminLogs();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminApiUsageTabBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  state.ui.adminSection = 'api_usage';
  renderViewState();
  try {
    await refreshAdminApiUsage();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminSettingsTabBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  state.ui.adminSection = 'settings';
  renderViewState();
  try {
    await refreshAdminSystemSettings();
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

  if (state.publicAuthSettings.registerEnabled === false) {
    const message = '当前已关闭注册';
    showTab('login');
    setAuthMsg(message);
    setGlobalMsg(message);
    return;
  }

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

els.adminLogsRefreshBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminLogs({ page: 1 });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminApiUsageRefreshBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminApiUsage();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminSettingsRefreshBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminSystemSettings();
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

els.adminLogSearchBtn.addEventListener('click', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminLogs({
      page: 1,
      query: els.adminLogSearchInput.value,
      actionType: els.adminLogActionFilter.value,
    });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminLogSearchInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  els.adminLogSearchBtn.click();
});

els.adminLogActionFilter.addEventListener('change', async () => {
  if (!isSuperAdmin()) return;
  try {
    await refreshAdminLogs({
      page: 1,
      query: els.adminLogSearchInput.value,
      actionType: els.adminLogActionFilter.value,
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

els.adminLogsPrevBtn.addEventListener('click', async () => {
  if (!isSuperAdmin() || state.adminLogs.page <= 1) return;
  try {
    await refreshAdminLogs({ page: state.adminLogs.page - 1 });
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.adminLogsNextBtn.addEventListener('click', async () => {
  if (!isSuperAdmin() || state.adminLogs.page >= state.adminLogs.totalPages) return;
  try {
    await refreshAdminLogs({ page: state.adminLogs.page + 1 });
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
els.adminDetailCloseBtn.addEventListener('click', closeAdminDetailModal);
els.adminDetailBackdrop.addEventListener('click', closeAdminDetailModal);
els.roleCloseBtn.addEventListener('click', closeRoleModal);
els.roleBackdrop.addEventListener('click', closeRoleModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.previewModal.classList.contains('hidden') === false) {
    closePreview();
  }
  if (event.key === 'Escape' && els.pointsModal.classList.contains('hidden') === false) {
    closePointsModal();
  }
  if (event.key === 'Escape' && els.roleModal.classList.contains('hidden') === false) {
    closeRoleModal();
  }
  if (event.key === 'Escape' && els.adminDetailModal.classList.contains('hidden') === false) {
    closeAdminDetailModal();
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
    if (state.ui.adminDetailOpen && state.ui.adminDetailUserId === targetUser.id) {
      await openAdminDetailModal(targetUser.id);
    }
    if (state.ui.adminSection === 'logs') {
      await refreshAdminLogs();
    }
    if (targetUser.id === state.user?.id) {
      await refreshUserSnapshot();
    }
  } catch (err) {
    setPointsFormMsg(err.message);
  } finally {
    setButtonLoading(els.pointsSubmitBtn, '提交中...', false);
  }
});

els.roleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const targetUser = state.ui.roleTargetUser;
  if (!targetUser) {
    setRoleFormMsg('未找到目标用户');
    return;
  }

  const role = els.roleSelect.value;
  const reason = String(els.roleReasonInput.value || '').trim();
  if (!['user', 'super_admin'].includes(role)) {
    setRoleFormMsg('请选择正确的角色');
    return;
  }
  if (reason.length > 255) {
    setRoleFormMsg('原因说明不能超过 255 个字符');
    return;
  }

  try {
    setButtonLoading(els.roleSubmitBtn, '提交中...', true);
    const result = await api(`/api/admin/users/${targetUser.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, reason }),
    });
    closeRoleModal();
    setGlobalMsg(result?.changed ? `已更新 ${targetUser.username} 的角色` : '角色未发生变化');
    await refreshAdminUsers();
    if (state.ui.adminDetailOpen && state.ui.adminDetailUserId === targetUser.id) {
      await openAdminDetailModal(targetUser.id);
    }
    if (state.ui.adminSection === 'logs') {
      await refreshAdminLogs();
    }
    if (targetUser.id === state.user?.id) {
      await refreshUserSnapshot();
    }
  } catch (err) {
    setRoleFormMsg(err.message);
  } finally {
    setButtonLoading(els.roleSubmitBtn, '提交中...', false);
  }
});

els.adminSettingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isSuperAdmin()) {
    setAdminSettingsMsg('仅超级管理员可修改');
    return;
  }

  const registerEnabled = els.registerEnabledInput.checked;
  const registerBonusPoints = Number.parseInt(els.registerBonusPointsInput.value, 10);
  if (!Number.isInteger(registerBonusPoints) || registerBonusPoints < 0) {
    setAdminSettingsMsg('注册赠送积分必须是大于等于 0 的整数');
    return;
  }

  try {
    setButtonLoading(els.adminSettingsSubmitBtn, '保存中...', true);
    setAdminSettingsMsg('');
    const result = await api('/api/admin/system-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerEnabled, registerBonusPoints }),
    });
    state.systemSettings = {
      registerEnabled: Boolean(result?.registerEnabled),
      registerBonusPoints: Math.max(Number(result?.registerBonusPoints) || 0, 0),
    };
    await refreshRegisterConfig();
    renderAdminSettingsForm();
    renderAdminSectionState();
    setAdminSettingsMsg(result?.changed ? '系统设置已更新' : '配置未发生变化', 'success');
    if (state.ui.adminSection === 'logs') {
      await refreshAdminLogs();
    }
  } catch (err) {
    setAdminSettingsMsg(err.message);
  } finally {
    setButtonLoading(els.adminSettingsSubmitBtn, '保存中...', false);
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
renderRegisterAvailability();
renderAdminSettingsForm();
renderAuthState();
refreshRegisterConfig();
refreshMe();
