const CAPABILITY_LABELS = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  text_to_video: '文生视频',
  text_to_audio: '文生语音',
};

const DEFAULT_COSTS = {
  text_to_image: 10,
  image_to_image: 12,
  text_to_video: 30,
  text_to_audio: 8,
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

const state = {
  user: null,
  costs: [],
  models: [],
  modelsByCapability: {},
  ui: {
    authOpen: false,
  },
};

const els = {
  authPanel: document.getElementById('authPanel'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  workspace: document.getElementById('workspace'),
  globalMsg: document.getElementById('globalMsg'),
  sessionHint: document.getElementById('sessionHint'),
  authActionBtn: document.getElementById('authActionBtn'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  tabs: [...document.querySelectorAll('.tab')],
  welcomeText: document.getElementById('welcomeText'),
  pointsText: document.getElementById('pointsText'),
  generateForm: document.getElementById('generateForm'),
  capabilitySelect: document.getElementById('capabilitySelect'),
  modelSelect: document.getElementById('modelSelect'),
  modelHint: document.getElementById('modelHint'),
  refreshModelsBtn: document.getElementById('refreshModelsBtn'),
  promptInput: document.getElementById('promptInput'),
  promptCounter: document.getElementById('promptCounter'),
  selectedModelBadge: document.getElementById('selectedModelBadge'),
  activeCapabilityText: document.getElementById('activeCapabilityText'),
  activeModelText: document.getElementById('activeModelText'),
  activeCostText: document.getElementById('activeCostText'),
  quickPromptList: document.getElementById('quickPromptList'),
  imageInputBox: document.getElementById('imageInputBox'),
  submitBtn: document.getElementById('submitBtn'),
  generateMsg: document.getElementById('generateMsg'),
  costList: document.getElementById('costList'),
  historyList: document.getElementById('historyList'),
  ledgerList: document.getElementById('ledgerList'),
};

function setGlobalMsg(msg) {
  els.globalMsg.textContent = msg || '';
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
  });

  let data;
  try {
    data = await response.json();
  } catch (_err) {
    throw new Error('服务返回格式异常');
  }

  if (response.ok === false || data.success === false) {
    throw new Error(data?.error?.message || 'Request failed');
  }

  return data.data;
}

function showTab(tab) {
  els.tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  els.loginForm.classList.toggle('active', tab === 'login');
  els.registerForm.classList.toggle('active', tab === 'register');
}

function openAuthPanel(tab = 'login', msg = '') {
  state.ui.authOpen = true;
  showTab(tab);
  if (msg) setGlobalMsg(msg);
  renderAuthState();
}

function closeAuthPanel() {
  state.ui.authOpen = false;
  renderAuthState();
}

function requireLogin(msg) {
  openAuthPanel('login', msg || '请先登录');
}

function getCostFor(capability) {
  const row = state.costs.find((x) => x.capability === capability);
  if (row) return row.cost_points;
  return DEFAULT_COSTS[capability] || 0;
}

function renderCosts() {
  els.costList.innerHTML = '';
  const rows = state.costs.length > 0
    ? state.costs
    : Object.keys(DEFAULT_COSTS).map((capability) => ({ capability, cost_points: DEFAULT_COSTS[capability] }));

  rows.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${CAPABILITY_LABELS[item.capability] || item.capability}: ${item.cost_points} 积分/次`;
    els.costList.appendChild(li);
  });
}

function renderAuthState() {
  els.workspace.classList.remove('hidden');
  els.authPanel.classList.toggle('hidden', state.ui.authOpen === false);

  if (state.user) {
    els.welcomeText.textContent = `欢迎你，${state.user.username}`;
    els.pointsText.textContent = `当前积分: ${state.user.points}`;
    els.sessionHint.textContent = `已登录：${state.user.username}（积分 ${state.user.points}）`;
    els.authActionBtn.textContent = '退出登录';
  } else {
    els.welcomeText.textContent = '游客模式';
    els.pointsText.textContent = '登录后可查看积分与历史记录';
    els.sessionHint.textContent = '未登录，提交任务时将提示登录。';
    els.authActionBtn.textContent = '登录 / 注册';
  }

  renderCosts();
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

function updatePromptCounter() {
  const len = (els.promptInput.value || '').trim().length;
  els.promptCounter.textContent = `${len} / 800`;
}

function renderQuickPrompts() {
  const capability = els.capabilitySelect.value;
  const list = QUICK_PROMPTS[capability] || [];

  els.quickPromptList.innerHTML = '';
  list.forEach((txt) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = txt;
    button.addEventListener('click', () => {
      els.promptInput.value = txt;
      updatePromptCounter();
      els.promptInput.focus();
    });
    els.quickPromptList.appendChild(button);
  });
}

function renderModelPanel() {
  const capability = els.capabilitySelect.value;
  const capabilityText = CAPABILITY_LABELS[capability] || capability;
  const selectedModel = getSelectedModelRow();
  const fallbackCost = getCostFor(capability);
  const cost = selectedModel && selectedModel.unit_cost_points > 0 ? selectedModel.unit_cost_points : fallbackCost;

  els.activeCapabilityText.textContent = `当前能力: ${capabilityText}`;

  if (selectedModel) {
    els.modelHint.textContent = `模型: ${selectedModel.model_name} | 提供方: ${selectedModel.provider}`;
    els.selectedModelBadge.textContent = `${selectedModel.provider} / ${selectedModel.model_code}`;
    els.activeModelText.textContent = `当前模型: ${selectedModel.model_name}`;
  } else {
    els.modelHint.textContent = state.user ? '当前能力暂无可选模型，提交时将使用后端默认模型。' : '登录后可选择更多模型，当前使用默认模型。';
    els.selectedModelBadge.textContent = '默认模型';
    els.activeModelText.textContent = '当前模型: 默认模型';
  }

  els.activeCostText.textContent = `预计单次消耗: ${cost} 积分`;
}

function renderModelOptions(preferredModelCode) {
  const capability = els.capabilitySelect.value;
  const models = getModelsByCapability(capability);
  const existingValue = (preferredModelCode || els.modelSelect.value || '').trim();

  els.modelSelect.innerHTML = '';

  if (state.user === null) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '默认模型（登录后可切换）';
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
    option.textContent = `${row.model_name} (${row.provider})${row.is_default ? ' [默认]' : ''}`;
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

async function refreshMe() {
  try {
    const data = await api('/api/user/me');
    state.user = data.user;
    state.costs = data.costs || [];
    state.ui.authOpen = false;
    renderAuthState();
    await Promise.all([refreshHistory(), refreshLedger(), refreshModels()]);
    renderQuickPrompts();
    updatePromptCounter();
  } catch (_err) {
    state.user = null;
    state.costs = [];
    state.models = [];
    state.modelsByCapability = {};
    renderAuthState();
    await Promise.all([refreshHistory(), refreshLedger(), refreshModels()]);
    renderQuickPrompts();
    updatePromptCounter();
  }
}

async function refreshHistory() {
  if (state.user === null) {
    els.historyList.innerHTML = '<p class="hint">登录后查看你的生成历史。</p>';
    return;
  }

  const rows = await api('/api/generation/history?limit=20');
  els.historyList.innerHTML = '';

  if (rows.length === 0) {
    els.historyList.innerHTML = '<p class="hint">暂无记录</p>';
    return;
  }

  rows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const link = row.public_url
      ? `<a href="${encodeURI(row.public_url)}" target="_blank" rel="noreferrer">查看文件</a>`
      : '<span>无输出</span>';

    const media = row.public_url
      ? row.file_type === 'image'
        ? `<img src="${encodeURI(row.public_url)}" alt="output" style="max-width:100%;border-radius:8px;margin-top:6px;" />`
        : row.file_type === 'audio'
          ? `<audio controls src="${encodeURI(row.public_url)}" style="width:100%;margin-top:6px;"></audio>`
          : `<video controls src="${encodeURI(row.public_url)}" style="width:100%;margin-top:6px;max-height:220px;"></video>`
      : '';

    const modelPart = `${escapeHtml(row.model_name || row.model_code || '-')}`;
    div.innerHTML = `
      <p><strong>${CAPABILITY_LABELS[row.capability] || escapeHtml(row.capability)}</strong> | 模型: ${modelPart}</p>
      <p>状态: ${escapeHtml(row.status)} | 消耗: ${escapeHtml(row.cost_points)}</p>
      <p>${escapeHtml(row.prompt_text || '')}</p>
      <p>${formatTime(row.created_at)} | ${link}</p>
      ${media}
    `;

    els.historyList.appendChild(div);
  });
}

async function refreshLedger() {
  if (state.user === null) {
    els.ledgerList.innerHTML = '<p class="hint">登录后查看积分流水。</p>';
    return;
  }

  const rows = await api('/api/user/points-ledger?limit=20');
  els.ledgerList.innerHTML = '';

  if (rows.length === 0) {
    els.ledgerList.innerHTML = '<p class="hint">暂无流水</p>';
    return;
  }

  rows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <p><strong>${escapeHtml(row.reason)}</strong> | 变动: ${row.change_amount > 0 ? '+' : ''}${escapeHtml(row.change_amount)}</p>
      <p>余额: ${escapeHtml(row.balance_after)}</p>
      <p>${formatTime(row.created_at)}</p>
    `;
    els.ledgerList.appendChild(div);
  });
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
  state.ui.authOpen = false;
  renderAuthState();
  await Promise.all([refreshHistory(), refreshLedger(), refreshModels()]);
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

  const fd = new FormData(els.loginForm);

  try {
    await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: fd.get('account'),
        password: fd.get('password'),
      }),
    });

    els.loginForm.reset();
    await refreshMe();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setGlobalMsg('');

  const fd = new FormData(els.registerForm);

  try {
    await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: fd.get('username'),
        email: fd.get('email'),
        password: fd.get('password'),
      }),
    });

    els.registerForm.reset();
    await refreshMe();
  } catch (err) {
    setGlobalMsg(err.message);
  }
});

els.capabilitySelect.addEventListener('change', () => {
  const showImageInput = els.capabilitySelect.value === 'image_to_image';
  els.imageInputBox.classList.toggle('hidden', showImageInput === false);
  renderModelOptions();
  renderQuickPrompts();
  updatePromptCounter();
});

els.modelSelect.addEventListener('change', () => {
  renderModelPanel();
});

els.refreshModelsBtn.addEventListener('click', async () => {
  if (state.user === null) {
    requireLogin('登录后可刷新模型列表');
    return;
  }

  const previousModelCode = els.modelSelect.value;
  setGenerateMsg('模型列表刷新中...');
  const ok = await refreshModels(previousModelCode);
  if (ok) {
    setGenerateMsg('模型列表已刷新。');
  }
});

els.promptInput.addEventListener('input', () => {
  updatePromptCounter();
});

els.generateForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (state.user === null) {
    setGenerateMsg('请先登录后提交任务。');
    requireLogin('请先登录后提交任务。');
    return;
  }

  setGenerateMsg('任务提交中...');
  setGlobalMsg('');

  els.submitBtn.disabled = true;

  const fd = new FormData(els.generateForm);
  const capability = String(fd.get('capability') || '').trim();
  const prompt = String(fd.get('prompt') || '').trim();
  const modelCodeRaw = String(fd.get('modelCode') || '').trim();
  const payload = { capability, prompt };

  if (modelCodeRaw) payload.modelCode = modelCodeRaw;

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
    setGenerateMsg(`生成完成，已使用模型: ${modelName}`);

    await refreshMe();
    els.generateForm.reset();
    els.imageInputBox.classList.add('hidden');
    renderModelOptions(payload.modelCode);
    renderQuickPrompts();
    updatePromptCounter();
  } catch (err) {
    setGenerateMsg(err.message);
  } finally {
    els.submitBtn.disabled = false;
  }
});

showTab('login');
renderQuickPrompts();
renderModelOptions();
updatePromptCounter();
renderAuthState();
refreshMe();
