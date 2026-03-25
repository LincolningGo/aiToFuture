const state = {
  user: null,
  costs: [],
};

const els = {
  authPanel: document.getElementById('authPanel'),
  workspace: document.getElementById('workspace'),
  globalMsg: document.getElementById('globalMsg'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  tabs: [...document.querySelectorAll('.tab')],
  welcomeText: document.getElementById('welcomeText'),
  pointsText: document.getElementById('pointsText'),
  logoutBtn: document.getElementById('logoutBtn'),
  generateForm: document.getElementById('generateForm'),
  capabilitySelect: document.getElementById('capabilitySelect'),
  imageInputBox: document.getElementById('imageInputBox'),
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || 'Request failed');
  }
  return data.data;
}

function renderCosts() {
  els.costList.innerHTML = '';
  const labels = {
    text_to_image: '文生图',
    image_to_image: '图生图',
    text_to_video: '文生视频',
    text_to_audio: '文生语音',
  };

  state.costs.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${labels[item.capability] || item.capability}: ${item.cost_points} 积分/次`;
    els.costList.appendChild(li);
  });
}

function renderAuthState() {
  if (state.user) {
    els.authPanel.classList.add('hidden');
    els.workspace.classList.remove('hidden');
    els.welcomeText.textContent = `欢迎你，${state.user.username}`;
    els.pointsText.textContent = `当前积分: ${state.user.points}`;
    renderCosts();
  } else {
    els.workspace.classList.add('hidden');
    els.authPanel.classList.remove('hidden');
  }
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function refreshMe() {
  try {
    const data = await api('/api/user/me');
    state.user = data.user;
    state.costs = data.costs || [];
    renderAuthState();
    await Promise.all([refreshHistory(), refreshLedger()]);
  } catch (_err) {
    state.user = null;
    state.costs = [];
    renderAuthState();
  }
}

async function refreshHistory() {
  if (!state.user) return;
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
      ? `<a href="${row.public_url}" target="_blank" rel="noreferrer">查看文件</a>`
      : '<span>无输出</span>';

    const media = row.public_url
      ? row.file_type === 'image'
        ? `<img src="${row.public_url}" alt="output" style="max-width:100%;border-radius:8px;margin-top:6px;" />`
        : row.file_type === 'audio'
          ? `<audio controls src="${row.public_url}" style="width:100%;margin-top:6px;"></audio>`
          : `<video controls src="${row.public_url}" style="width:100%;margin-top:6px;max-height:220px;"></video>`
      : '';

    div.innerHTML = `
      <p><strong>${row.capability}</strong> | 状态: ${row.status} | 消耗: ${row.cost_points}</p>
      <p>${row.prompt_text || ''}</p>
      <p>${formatTime(row.created_at)} | ${link}</p>
      ${media}
    `;

    els.historyList.appendChild(div);
  });
}

async function refreshLedger() {
  if (!state.user) return;
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
      <p><strong>${row.reason}</strong> | 变动: ${row.change_amount > 0 ? '+' : ''}${row.change_amount}</p>
      <p>余额: ${row.balance_after}</p>
      <p>${formatTime(row.created_at)}</p>
    `;
    els.ledgerList.appendChild(div);
  });
}

function showTab(tab) {
  els.tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  els.loginForm.classList.toggle('active', tab === 'login');
  els.registerForm.classList.toggle('active', tab === 'register');
}

els.tabs.forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
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

els.logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    state.user = null;
    renderAuthState();
  }
});

els.capabilitySelect.addEventListener('change', () => {
  const show = els.capabilitySelect.value === 'image_to_image';
  els.imageInputBox.classList.toggle('hidden', !show);
});

els.generateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setGenerateMsg('任务提交中...');
  setGlobalMsg('');

  const fd = new FormData(els.generateForm);
  const capability = fd.get('capability');
  const prompt = fd.get('prompt');

  try {
    if (capability === 'image_to_image') {
      const file = fd.get('inputImage');
      if (!file || !(file instanceof File) || file.size === 0) {
        throw new Error('图生图请上传输入图片');
      }

      const uploadFd = new FormData();
      uploadFd.append('capability', capability);
      uploadFd.append('prompt', prompt);
      uploadFd.append('inputImage', file);

      await api('/api/generation/submit-with-file', {
        method: 'POST',
        body: uploadFd,
      });
    } else {
      await api('/api/generation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability, prompt }),
      });
    }

    setGenerateMsg('生成完成，结果已入库并落本地文件。');
    await refreshMe();
    els.generateForm.reset();
    els.imageInputBox.classList.add('hidden');
  } catch (err) {
    setGenerateMsg(err.message);
  }
});

refreshMe();
