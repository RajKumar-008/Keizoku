/**
 * KEIZOKU - CONSISTENCY AND PERSISTENCE
 * Client-Side Controller & State Engine
 */

const App = (() => {
  // Application State (preserved shape)
  const state = {
    token: localStorage.getItem('keizoku_token') || localStorage.getItem('dayforge_token') || '',
    user: null,
    currentDate: null, // YYYY-MM-DD string
    todayDate: null,
    todayChecklist: null,
    activeCategoryFilter: 'ALL',
    habits: [],
    goals: [],
    streak: null,
    achievements: [],
    history: [],
    calendarMonth: new Date().getMonth() + 1,
    calendarYear: new Date().getFullYear(),
    charts: {
      trend: null,
      category: null
    }
  };

  // UI-only ephemeral state
  const ui = {
    activeSection: 'dashboard',
    todayGroupByCategory: false,
    badgeFilter: 'ALL',
    historyStatusFilter: 'ALL',
    historyVisibleLimit: 20,
    pendingConfirm: null,
    lastFocusedEl: null,
    chartJsPromise: null,
    lastReportSummary: null,
    readNoticeKeys: new Set(),
    notices: [],
    themeMode: localStorage.getItem('keizoku_theme_mode') || localStorage.getItem('keizoku_theme') || localStorage.getItem('dayforge_theme') || 'light'
  };

  const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:10000' : '';

  // Cached Date/Time Formatters
  const FMT_SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const FMT_READABLE_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const FMT_MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const FMT_WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const FMT_TIME = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });

  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    today: "Today's Checklist",
    habits: 'My Habits',
    goals: 'Goals',
    calendar: 'Calendar',
    history: 'History',
    streaks: 'Streaks & Badges',
    reports: 'Reports',
    notifications: 'Notifications',
    settings: 'Settings',
    profile: 'Profile'
  };

  const CATEGORY_META = {
    HEALTH: { label: 'Health', tagClass: 'tag--health', cssVar: '--cat-health' },
    LEARNING: { label: 'Learning', tagClass: 'tag--learning', cssVar: '--cat-learning' },
    CAREER: { label: 'Career', tagClass: 'tag--career', cssVar: '--cat-career' },
    MINDFULNESS: { label: 'Mindfulness', tagClass: 'tag--mindfulness', cssVar: '--cat-mind' },
    GENERAL: { label: 'General', tagClass: 'tag--general', cssVar: '--cat-general' }
  };

  const DAY_SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const MILESTONE_TARGETS = [7, 14, 28, 60, 100];

  const SVG_ICONS = {
    leaf: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>',
    check: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 14.5-4-4 1.41-1.41L11 13.67l5.59-5.59L18 9.5z"/></svg>',
    target: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2zm0 4a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4V6zm0 4a2 2 0 1 0 2 2 2 2 0 0 0-2-2z"/></svg>',
    chart: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
    bell: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    history: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/></svg>',
    kebab: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    checkMark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  // =========================================================================
  // API CLIENT
  // =========================================================================
  async function api(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';

      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        if (res.status === 401) {
          state.token = '';
          state.user = null;
          localStorage.removeItem('keizoku_token');
          localStorage.removeItem('dayforge_token');
          openAuthSurface(true);
          const errorMsg = (data && data.message) ? data.message : 'Please sign in to continue.';
          throw new Error(errorMsg);
        }
        if (res.status === 403) {
          const isDateSecurity = data && data.message && (data.message.includes('protection') || data.message.includes('Date') || data.message.includes('archived'));
          if (!isDateSecurity) {
            state.token = '';
            state.user = null;
            localStorage.removeItem('keizoku_token');
            localStorage.removeItem('dayforge_token');
            openAuthSurface(true);
            const errorMsg = (data && data.message) ? data.message : 'Session invalid. Please sign in.';
            throw new Error(errorMsg);
          }
        }
        const errorMsg = data && data.message ? data.message : `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${url}]:`, err);
      const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/me');
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        showToast('Cannot connect to KEIZOKU server. Please check that the backend is running.', 'error');
      } else if (!isAuthEndpoint && !options.silentToast) {
        showToast(err.message, 'error');
      }
      throw err;
    }
  }

  // =========================================================================
  // TOASTS
  // =========================================================================
  function showToast(message, type = 'success', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    while (container.children.length >= 3) {
      container.removeChild(container.firstElementChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast-forge ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const defaultTitle = type === 'error' ? 'Attention' : (type === 'warning' ? 'Notice' : 'Updated');
    const iconSvg = type === 'error'
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
      : type === 'warning'
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
        : SVG_ICONS.checkMark;

    toast.innerHTML = `
      <span class="toast-icon-circle">${iconSvg}</span>
      <span class="toast-body">
        <span class="toast-title">${escapeHtml(title || defaultTitle)}</span>
        <span class="toast-msg">${escapeHtml(message)}</span>
      </span>
      <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
    `;

    const dismiss = () => {
      toast.remove();
    };
    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.isConnected) dismiss();
    }, 4000);
  }

  // =========================================================================
  // EMPTY STATE & UI HELPERS
  // =========================================================================
  function renderEmptyState({ icon = SVG_ICONS.leaf, title, description, primaryBtn = '', secondaryBtn = '' }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <h3 class="empty-state-title">${escapeHtml(title)}</h3>
        <p class="empty-state-desc">${escapeHtml(description)}</p>
        ${(primaryBtn || secondaryBtn) ? `<div class="empty-state-actions">${primaryBtn}${secondaryBtn}</div>` : ''}
      </div>
    `;
  }

  function getCategoryTagHtml(category) {
    const meta = CATEGORY_META[category] || CATEGORY_META.GENERAL;
    return `<span class="tag ${meta.tagClass}">${escapeHtml(meta.label)}</span>`;
  }

  function parseYmd(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateReadable(dateStr) {
    const d = parseYmd(dateStr);
    return d ? FMT_READABLE_DATE.format(d) : (dateStr || '');
  }

  function formatShortDate(dateStr) {
    const d = parseYmd(dateStr);
    return d ? FMT_SHORT_DATE.format(d) : (dateStr || '');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? '' : FMT_TIME.format(d);
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('is-hidden'));
    document.querySelectorAll('[aria-haspopup="menu"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }

  // =========================================================================
  // DRAWER, NAVIGATION & MODALS
  // =========================================================================
  function setDrawerOpen(open) {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebarScrim');
    const toggleBtn = document.getElementById('btnMobileMenuToggle');
    if (sidebar) sidebar.classList.toggle('open', open);
    if (scrim) {
      scrim.classList.toggle('active', open);
      scrim.setAttribute('aria-hidden', String(!open));
    }
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
  }

  function navigateTo(sectionId) {
    ui.activeSection = sectionId;
    closeAllMenus();

    document.querySelectorAll('.section-view').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => {
      const isMatch = link.getAttribute('data-section') === sectionId;
      link.classList.toggle('active', isMatch);
      if (isMatch) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const moreSections = ['habits', 'goals', 'history', 'reports', 'notifications', 'settings', 'profile'];
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const sec = btn.getAttribute('data-section');
      const isMore = btn.id === 'btnMobileMore' && moreSections.includes(sectionId);
      const isMatch = sec === sectionId || isMore;
      btn.classList.toggle('active', isMatch);
      if (isMatch) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    document.querySelectorAll('.more-sheet-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-more-section') === sectionId);
    });

    const targetView = document.getElementById(`view-${sectionId}`);
    if (targetView) targetView.classList.add('active');

    const titleEl = document.getElementById('topbarPageTitle');
    if (titleEl) titleEl.textContent = SECTION_TITLES[sectionId] || 'KEIZOKU';

    setDrawerOpen(false);
    hideModal('mobileMoreSheet');

    const mainEl = document.getElementById('main');
    if (mainEl) mainEl.scrollTop = 0;

    if (sectionId === 'calendar') renderCalendar();
    if (sectionId === 'reports') renderReports();
    if (sectionId === 'history') loadHistory();
    if (sectionId === 'streaks') loadStreaks();
    if (sectionId === 'habits') loadHabits();
    if (sectionId === 'goals') loadGoals();
    if (sectionId === 'notifications') loadNotifications();
    if (sectionId === 'settings') updateTimezoneHint();
    if (sectionId === 'profile') updateProfileStats();
  }

  function getFocusableElements(root) {
    return Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);
  }

  function openAuthSurface(isMandatoryFirstRun) {
    const authModal = document.getElementById('modalAuth');
    if (!authModal) return;
    if (isMandatoryFirstRun) {
      document.body.classList.add('unauthenticated');
      authModal.classList.add('auth-fullscreen');
    } else {
      document.body.classList.remove('unauthenticated');
      authModal.classList.remove('auth-fullscreen');
    }
    clearAuthErrors();
    showModal('modalAuth');
  }

  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (!modal.classList.contains('active')) {
      ui.lastFocusedEl = document.activeElement;
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (modalId === 'modalAddHabit') {
      const rows = document.querySelectorAll('.habit-activity-row');
      if (rows.length === 0) resetHabitRows();
      const startInp = document.getElementById('habitStartDateInput');
      if (startInp && !startInp.value && state.todayDate) startInp.value = state.todayDate;
    }

    if (modalId === 'modalAddGoal') {
      const startInp = document.getElementById('goalStartDateInput');
      if (startInp && !startInp.value && state.todayDate) startInp.value = state.todayDate;
    }

    if (modalId === 'modalAuth' && state.token) {
      document.body.classList.remove('unauthenticated');
      modal.classList.remove('auth-fullscreen');
    }

    setTimeout(() => {
      const focusables = getFocusableElements(modal);
      if (focusables.length > 0) {
        const preferred = modal.querySelector('input:not([type="hidden"]):not(.sr-only), textarea, select') || focusables[0];
        preferred.focus();
      }
    }, 30);
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains('active')) return;

    if (modalId === 'modalAuth' && modal.classList.contains('auth-fullscreen') && !state.token) {
      return;
    }

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');

    if (modalId === 'modalConfirmDelete') {
      ui.pendingConfirm = null;
      const typedWrap = document.getElementById('confirmDeleteTypedWrap');
      const typedInput = document.getElementById('confirmDeleteTypedInput');
      const submitBtn = document.getElementById('btnSubmitConfirmDelete');
      if (typedWrap) typedWrap.classList.add('is-hidden');
      if (typedInput) typedInput.value = '';
      if (submitBtn) submitBtn.disabled = false;
    }

    const stillOpen = document.querySelectorAll('.modal-overlay.active').length > 0;
    if (!stillOpen) {
      document.body.classList.remove('modal-open');
    }

    if (ui.lastFocusedEl && typeof ui.lastFocusedEl.focus === 'function') {
      ui.lastFocusedEl.focus();
      ui.lastFocusedEl = null;
    }
  }

  function openConfirmDialog({ title, message, confirmLabel = 'Yes, Remove', requireDeleteWord = false, onConfirm }) {
    const titleEl = document.getElementById('confirmDeleteModalTitle');
    const msgEl = document.getElementById('confirmDeleteMessage');
    const submitBtn = document.getElementById('btnSubmitConfirmDelete');
    const typedWrap = document.getElementById('confirmDeleteTypedWrap');
    const typedInput = document.getElementById('confirmDeleteTypedInput');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (submitBtn) {
      submitBtn.textContent = confirmLabel;
      submitBtn.disabled = Boolean(requireDeleteWord);
    }

    if (typedWrap && typedInput) {
      typedWrap.classList.toggle('is-hidden', !requireDeleteWord);
      typedInput.value = '';
    }

    ui.pendingConfirm = { onConfirm, requireDeleteWord };
    showModal('modalConfirmDelete');
  }

  // =========================================================================
  // AUTHENTICATION & USER PROFILE
  // =========================================================================
  async function syncClientTimezone() {
    if (!state.token || !state.user) return;
    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      if (state.user.timezone !== clientTz) {
        const res = await api('/api/user/settings', {
          method: 'PUT',
          body: JSON.stringify({ timezone: clientTz })
        });
        if (res && res.timezone) {
          state.user.timezone = res.timezone;
        }
      }
    } catch (e) {
      console.warn('Failed to sync client timezone:', e);
    }
  }

  async function initAuth() {
    if (!state.token) {
      openAuthSurface(true);
      return;
    }

    try {
      const user = await api('/api/auth/me');
      state.user = user;
      document.body.classList.remove('unauthenticated');
      const authModal = document.getElementById('modalAuth');
      if (authModal) authModal.classList.remove('auth-fullscreen');
      await syncClientTimezone();
      updateUserUI();
    } catch (e) {
      console.warn('Session expired or user not found:', e);
      state.token = '';
      state.user = null;
      localStorage.removeItem('keizoku_token');
      localStorage.removeItem('dayforge_token');
      openAuthSurface(true);
    }
  }

  function updateUserUI() {
    if (!state.user) return;
    const name = state.user.fullName || state.user.username;
    const firstName = name.split(' ')[0];
    const initial = name.charAt(0).toUpperCase();

    ['avatarInitial', 'profileAvatarLarge', 'topbarAvatarInitial'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = initial;
    });

    const userNameLabel = document.getElementById('userNameLabel');
    if (userNameLabel) userNameLabel.textContent = name;

    const greetingEl = document.getElementById('dashboardGreeting');
    if (greetingEl) greetingEl.textContent = `Welcome back, ${firstName}.`;

    const profileFullNameLabel = document.getElementById('profileFullNameLabel');
    if (profileFullNameLabel) profileFullNameLabel.textContent = name;

    const profileEmailLabel = document.getElementById('profileEmailLabel');
    if (profileEmailLabel) profileEmailLabel.textContent = state.user.email || 'user@keizoku.local';

    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const tz = state.user.timezone || detectedTz;
    const profileTimezoneLabel = document.getElementById('profileTimezoneLabel');
    if (profileTimezoneLabel) profileTimezoneLabel.textContent = tz;

    const settingTimezoneSelect = document.getElementById('settingTimezoneSelect');
    if (settingTimezoneSelect && state.user.timezone) {
      const hasOpt = Array.from(settingTimezoneSelect.options).some(o => o.value === state.user.timezone);
      if (!hasOpt) {
        const newOpt = document.createElement('option');
        newOpt.value = state.user.timezone;
        newOpt.textContent = `${state.user.timezone} (Detected)`;
        settingTimezoneSelect.appendChild(newOpt);
      }
      settingTimezoneSelect.value = state.user.timezone;
      updateTimezoneHint();
    }
  }

  function updateProfileStats() {
    const hEl = document.getElementById('profileStatHabits');
    if (hEl) hEl.textContent = state.habits.filter(h => h.active).length;

    const sEl = document.getElementById('profileStatStreak');
    if (sEl) sEl.textContent = state.streak ? state.streak.currentStreak : 0;

    const pEl = document.getElementById('profileStatPerfectDays');
    if (pEl) pEl.textContent = state.streak ? state.streak.totalSuccessfulDays : 0;
  }

  function clearAuthErrors() {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
      banner.textContent = '';
      banner.classList.add('is-hidden');
    }
    ['loginUsername', 'loginPassword', 'regFullName', 'regUsername', 'regEmail', 'regPassword'].forEach(id => {
      const inp = document.getElementById(id);
      const err = document.getElementById(`${id}Error`);
      if (inp) inp.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    });
  }

  function setFieldError(inputId, message) {
    const inp = document.getElementById(inputId);
    const err = document.getElementById(`${inputId}Error`);
    if (inp) inp.setAttribute('aria-invalid', 'true');
    if (err) err.textContent = message;
  }

  function showAuthErrorBanner(message) {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
      banner.textContent = message;
      banner.classList.remove('is-hidden');
    }
  }

  // =========================================================================
  // TODAY'S CHECKLIST & DASHBOARD
  // =========================================================================
  async function loadTodayChecklist() {
    if (!state.token) return;
    try {
      const data = await api('/api/checklist/today');
      state.todayChecklist = data;
      state.currentDate = data.date;
      state.todayDate = data.date;

      const shortDate = formatShortDate(data.date);
      const readableDate = formatDateReadable(data.date);

      const topbarDateText = document.getElementById('topbarDateText');
      if (topbarDateText) {
        topbarDateText.textContent = shortDate;
        topbarDateText.title = readableDate;
      }

      const dashDateSub = document.getElementById('dashboardDateSub');
      if (dashDateSub) dashDateSub.textContent = `${readableDate} · Steady daily practice`;

      const todayChecklistDateLabel = document.getElementById('todayChecklistDateLabel');
      if (todayChecklistDateLabel) {
        todayChecklistDateLabel.textContent = readableDate;
        todayChecklistDateLabel.title = data.date;
      }

      renderTodayChecklist(data);
      renderDashboardPreview(data);

      await Promise.allSettled([
        loadStreaks(),
        loadGoals(),
        loadHabits(),
        refreshNotificationBadge(),
        refreshMiniHeatmap()
      ]);
    } catch (err) {
      console.error('Failed to load today checklist:', err);
    }
  }

  function recomputeChecklistMetrics(data) {
    const items = data.items || [];
    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    data.totalTasks = total;
    data.completedTasks = completed;
    data.completionPercentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    data.isSuccessful = total > 0 && completed === total;
  }

  function updateCategoryFilterChips(allItems) {
    const counts = { ALL: allItems.length, HEALTH: 0, LEARNING: 0, CAREER: 0, MINDFULNESS: 0, GENERAL: 0 };
    allItems.forEach(it => {
      const cat = it.category || 'GENERAL';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    document.querySelectorAll('[data-filter-cat]').forEach(btn => {
      const cat = btn.getAttribute('data-filter-cat');
      const count = counts[cat] || 0;
      const countEl = btn.querySelector(`[data-cat-count="${cat}"]`);
      if (countEl) countEl.textContent = count;

      const shouldHide = cat !== 'ALL' && count === 0 && state.activeCategoryFilter !== cat;
      btn.classList.toggle('is-hidden', shouldHide);
      btn.setAttribute('aria-pressed', String(state.activeCategoryFilter === cat));
    });
  }

  function renderChecklistRowHtml(item, index, listLength) {
    const isCompleted = Boolean(item.completed);
    const metaText = item.completedAt ? `<span>Completed ${formatTime(item.completedAt)}</span>` : '';
    const disableUp = index === 0 ? 'disabled' : '';
    const disableDown = index === listLength - 1 ? 'disabled' : '';

    return `
      <div class="checklist-item ${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
        <div class="item-left">
          <label class="task-checkbox-label">
            <input
              type="checkbox"
              class="task-checkbox-input"
              ${isCompleted ? 'checked' : ''}
              aria-label="Mark ${escapeAttr(item.title)} as ${isCompleted ? 'incomplete' : 'completed'}"
              onchange="App.toggleItemStatus(${item.id})"
            >
            <span class="task-checkbox-box" aria-hidden="true">${isCompleted ? SVG_ICONS.checkMark : ''}</span>
          </label>
          <div class="item-details">
            <span class="item-title">${escapeHtml(item.title)}</span>
            <div class="item-meta">
              ${getCategoryTagHtml(item.category || 'GENERAL')}
              ${metaText}
            </div>
          </div>
        </div>

        <div class="dropdown-wrap">
          <button
            type="button"
            class="btn-item-action js-kebab-trigger"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="Actions for ${escapeAttr(item.title)}"
          >${SVG_ICONS.kebab}</button>
          <div class="dropdown-menu is-hidden" role="menu">
            <button type="button" class="dropdown-item" role="menuitem" aria-label="Move ${escapeAttr(item.title)} up" onclick="App.reorderItem(${item.id}, -1)" ${disableUp}>↑ Move up</button>
            <button type="button" class="dropdown-item" role="menuitem" aria-label="Move ${escapeAttr(item.title)} down" onclick="App.reorderItem(${item.id}, 1)" ${disableDown}>↓ Move down</button>
            <div class="dropdown-divider" role="separator"></div>
            <button type="button" class="dropdown-item" role="menuitem" onclick="App.openEditItemModal(${item.id}, '${escapeAttr(item.title)}', '${item.category || 'GENERAL'}')">Edit</button>
            <button type="button" class="dropdown-item dropdown-item--danger" role="menuitem" onclick="App.openDeleteConfirmModal(${item.id}, '${escapeAttr(item.title)}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTodayChecklist(data) {
    const container = document.getElementById('todayFullChecklistContainer');
    if (!container) return;

    const percent = Math.round(data.completionPercentage || 0);
    const percentLabel = document.getElementById('todayCompletionPercentLabel');
    if (percentLabel) percentLabel.textContent = `${percent}%`;

    const barFill = document.getElementById('todayProgressBarFill');
    if (barFill) {
      barFill.style.width = `${percent}%`;
      barFill.classList.toggle('complete', percent === 100);
    }

    const totalEl = document.getElementById('todayTotalTasksCount');
    if (totalEl) totalEl.textContent = data.totalTasks || 0;

    const doneEl = document.getElementById('todayCompletedTasksCount');
    if (doneEl) doneEl.textContent = data.completedTasks || 0;

    const remEl = document.getElementById('todayRemainingTasksCount');
    if (remEl) remEl.textContent = Math.max(0, (data.totalTasks || 0) - (data.completedTasks || 0));

    const completeAllBtn = document.getElementById('btnCompleteAllToday');
    if (completeAllBtn) {
      const hasIncomplete = (data.items || []).some(i => !i.completed);
      completeAllBtn.disabled = !hasIncomplete;
    }

    const allItems = data.items || [];
    updateCategoryFilterChips(allItems);

    let items = allItems.slice();
    if (state.activeCategoryFilter !== 'ALL') {
      items = items.filter(it => it.category === state.activeCategoryFilter);
    }

    // Sort incomplete first, then completed
    items.sort((a, b) => Number(a.completed) - Number(b.completed));

    if (items.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: SVG_ICONS.check,
        title: state.activeCategoryFilter === 'ALL' ? 'No checklist activities for today' : 'No tasks in this category',
        description: state.activeCategoryFilter === 'ALL'
          ? 'Create a recurring habit or add a one-off task to build today’s schedule.'
          : 'Try switching category filters or add a new task in this category.',
        primaryBtn: '<button type="button" class="btn-forge btn-forge-primary btn-forge-sm" onclick="App.navigateTo(\'habits\')">Create a habit</button>',
        secondaryBtn: '<button type="button" class="btn-forge btn-forge-outline btn-forge-sm" onclick="App.showModal(\'modalSingleAdd\')">Add a task</button>'
      });
      return;
    }

    if (ui.todayGroupByCategory && state.activeCategoryFilter === 'ALL') {
      const grouped = {};
      items.forEach(item => {
        const cat = item.category || 'GENERAL';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      container.innerHTML = Object.keys(grouped).map(cat => {
        const meta = CATEGORY_META[cat] || CATEGORY_META.GENERAL;
        const groupItems = grouped[cat];
        const rows = groupItems.map((it, idx) => renderChecklistRowHtml(it, idx, groupItems.length)).join('');
        return `
          <div class="checklist-group-header">
            <span>${escapeHtml(meta.label)}</span>
            <span class="tabular-num">${groupItems.filter(x => x.completed).length} / ${groupItems.length}</span>
          </div>
          ${rows}
        `;
      }).join('');
      return;
    }

    container.innerHTML = items.map((item, index) => renderChecklistRowHtml(item, index, items.length)).join('');
  }

  function renderDashboardPreview(data) {
    const score = Math.round(data.completionPercentage || 0);
    const total = data.totalTasks || 0;
    const completed = data.completedTasks || 0;

    const scoreEl = document.getElementById('dashTodayScore');
    if (scoreEl) scoreEl.textContent = `${score}%`;

    const ctxEl = document.getElementById('dashTodayContext');
    if (ctxEl) {
      ctxEl.textContent = total === 0
        ? 'No tasks scheduled yet'
        : `${completed} of ${total} completed`;
    }

    const heroScoreEl = document.getElementById('dashHeroScore');
    if (heroScoreEl) heroScoreEl.textContent = `${score}%`;

    const ringCircle = document.getElementById('dashProgressRingCircle');
    if (ringCircle) {
      const circumference = 2 * Math.PI * 50;
      const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
      ringCircle.style.strokeDashoffset = offset.toFixed(2);
    }

    const badgeEl = document.getElementById('dashCompletedCountBadge');
    if (badgeEl) badgeEl.textContent = `${completed} / ${total} Done`;

    const container = document.getElementById('dashTodayItemList');
    if (!container) return;

    const items = (data.items || []).slice().sort((a, b) => Number(a.completed) - Number(b.completed));
    if (items.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: SVG_ICONS.leaf,
        title: 'Your focus list is clear',
        description: 'Use quick add above or create recurring habits to start tracking today.'
      });
      return;
    }

    container.innerHTML = items.slice(0, 5).map(item => `
      <div class="checklist-item checklist-item--compact ${item.completed ? 'completed' : ''}" data-dash-item-id="${item.id}">
        <div class="item-left">
          <label class="task-checkbox-label">
            <input
              type="checkbox"
              class="task-checkbox-input"
              ${item.completed ? 'checked' : ''}
              aria-label="Mark ${escapeAttr(item.title)} as ${item.completed ? 'incomplete' : 'completed'}"
              onchange="App.toggleItemStatus(${item.id})"
            >
            <span class="task-checkbox-box" aria-hidden="true">${item.completed ? SVG_ICONS.checkMark : ''}</span>
          </label>
          <div class="item-details">
            <span class="item-title">${escapeHtml(item.title)}</span>
            <div class="item-meta">
              ${getCategoryTagHtml(item.category || 'GENERAL')}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function filterTodayCategory(cat) {
    state.activeCategoryFilter = cat;
    if (state.todayChecklist) {
      renderTodayChecklist(state.todayChecklist);
    }
  }

  async function toggleItemStatus(itemId) {
    const checklist = state.todayChecklist;
    if (!checklist || !checklist.items) return;

    const target = checklist.items.find(it => it.id === itemId);
    if (!target) return;

    const prevCompleted = target.completed;
    const prevCompletedAt = target.completedAt;
    const prevPercent = Math.round(checklist.completionPercentage || 0);

    // Optimistic update
    target.completed = !prevCompleted;
    target.completedAt = target.completed ? new Date().toISOString() : null;
    recomputeChecklistMetrics(checklist);
    renderTodayChecklist(checklist);
    renderDashboardPreview(checklist);

    const newPercent = Math.round(checklist.completionPercentage || 0);
    if (target.completed && newPercent === 100 && prevPercent < 100) {
      const barFill = document.getElementById('todayProgressBarFill');
      if (barFill) {
        barFill.classList.add('completion-pulse');
        setTimeout(() => barFill.classList.remove('completion-pulse'), 650);
      }
      showToast('Every scheduled task for today is complete!', 'success', '100% Complete');
    }

    try {
      const updated = await api(`/api/checklist/item/${itemId}/toggle`, { method: 'PATCH' });
      target.completed = updated.completed;
      target.completedAt = updated.completedAt;
      recomputeChecklistMetrics(checklist);
      renderTodayChecklist(checklist);
      renderDashboardPreview(checklist);
      loadStreaks();
      loadGoals();
      refreshNotificationBadge();
    } catch (err) {
      // Revert optimistic change
      target.completed = prevCompleted;
      target.completedAt = prevCompletedAt;
      recomputeChecklistMetrics(checklist);
      renderTodayChecklist(checklist);
      renderDashboardPreview(checklist);
    }
  }

  async function completeAllToday() {
    if (!state.todayChecklist || !state.todayChecklist.items) return;
    const pending = state.todayChecklist.items.filter(it => !it.completed);
    if (pending.length === 0) return;

    const btn = document.getElementById('btnCompleteAllToday');
    if (btn) btn.disabled = true;

    try {
      for (const item of pending) {
        await api(`/api/checklist/item/${item.id}/toggle`, { method: 'PATCH' });
      }
      showToast('All remaining tasks completed!', 'success', '100% Complete');
      await loadTodayChecklist();
    } catch (err) {
      await loadTodayChecklist();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function submitBatchAdd(activitiesText, defaultCat) {
    if (!activitiesText || !activitiesText.trim()) {
      showToast('Please enter at least one activity', 'warning');
      return;
    }

    try {
      const beforeCount = state.todayChecklist ? state.todayChecklist.items.length : 0;
      const res = await api('/api/checklist/batch', {
        method: 'POST',
        body: JSON.stringify({
          activities: activitiesText,
          defaultCategory: defaultCat || 'GENERAL',
          date: state.currentDate
        })
      });

      const addedCount = Math.max(0, (res.items ? res.items.length : 0) - beforeCount);
      showToast(`Added ${addedCount} ${addedCount === 1 ? 'activity' : 'activities'} to checklist`);
      hideModal('modalBatchAdd');
      const batchTxt = document.getElementById('batchInputTextarea');
      if (batchTxt) batchTxt.value = '';
      const dashInput = document.getElementById('dashQuickBatchInput');
      if (dashInput) dashInput.value = '';
      await loadTodayChecklist();
    } catch (err) {}
  }

  async function submitSingleAdd(title, category) {
    if (!title || !title.trim()) {
      showToast('Task name cannot be empty', 'warning');
      return;
    }

    try {
      await api('/api/checklist/item', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category: category || 'GENERAL',
          date: state.currentDate
        })
      });
      showToast(`Added "${title.trim()}" to checklist`);
      hideModal('modalSingleAdd');
      const inp = document.getElementById('singleItemTitle');
      if (inp) inp.value = '';
      await loadTodayChecklist();
    } catch (err) {}
  }

  async function reorderItem(itemId, direction) {
    closeAllMenus();
    try {
      await api(`/api/checklist/item/${itemId}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ direction })
      });
      await loadTodayChecklist();
    } catch (err) {}
  }

  function openEditItemModal(id, title, category) {
    closeAllMenus();
    document.getElementById('editItemId').value = id;
    document.getElementById('editItemTitle').value = title;
    document.getElementById('editItemCategory').value = category || 'GENERAL';
    showModal('modalEditItem');
  }

  async function submitEditItem() {
    const id = document.getElementById('editItemId').value;
    const title = document.getElementById('editItemTitle').value;
    const category = document.getElementById('editItemCategory').value;

    if (!title || !title.trim()) {
      showToast('Task name is required', 'warning');
      return;
    }

    try {
      await api(`/api/checklist/item/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: title.trim(), category })
      });
      showToast('Task updated');
      hideModal('modalEditItem');
      await loadTodayChecklist();
    } catch (err) {}
  }

  function openDeleteConfirmModal(id, title) {
    closeAllMenus();
    document.getElementById('deleteTargetItemId').value = id;
    openConfirmDialog({
      title: 'Remove Task',
      message: `Remove "${title}" from today's checklist?`,
      confirmLabel: 'Remove Task',
      onConfirm: async () => {
        await api(`/api/checklist/item/${id}`, { method: 'DELETE' });
        showToast('Task removed from checklist');
        hideModal('modalConfirmDelete');
        await loadTodayChecklist();
      }
    });
  }

  async function submitConfirmDelete() {
    if (!ui.pendingConfirm || typeof ui.pendingConfirm.onConfirm !== 'function') return;
    if (ui.pendingConfirm.requireDeleteWord) {
      const typed = document.getElementById('confirmDeleteTypedInput');
      if (!typed || typed.value.trim() !== 'DELETE') return;
    }
    try {
      await ui.pendingConfirm.onConfirm();
    } catch (err) {}
  }

  // =========================================================================
  // HABITS MANAGEMENT
  // =========================================================================
  async function loadHabits() {
    if (!state.token) return;
    try {
      const habits = await api('/api/habits');
      state.habits = habits;
      renderHabitsList(habits);
      const hCount = document.getElementById('dashTotalHabitsCount');
      if (hCount) hCount.textContent = habits.filter(h => h.active).length;
      updateProfileStats();
    } catch (err) {
      console.error('Failed to load habits:', err);
    }
  }

  function isDayScheduledForHabit(habit, dayNum1To7) {
    if (!habit) return false;
    if (habit.frequencyType === 'DAILY') return true;
    if (habit.frequencyType === 'WEEKDAYS') return dayNum1To7 >= 1 && dayNum1To7 <= 5;
    if (habit.frequencyType === 'CUSTOM_DAYS' && habit.customDays) {
      return habit.customDays.split(',').map(s => Number(s.trim())).includes(dayNum1To7);
    }
    return false;
  }

  function renderHabitsList(habits) {
    const container = document.getElementById('habitsListContainer');
    if (!container) return;

    if (habits.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: SVG_ICONS.leaf,
        title: 'No recurring habits yet',
        description: 'Define daily, weekday, or custom schedules to automatically populate your daily checklist.',
        primaryBtn: '<button type="button" class="btn-forge btn-forge-primary btn-forge-sm" onclick="App.showModal(\'modalAddHabit\')">+ Create Habit</button>'
      });
      return;
    }

    container.innerHTML = habits.map(h => {
      let freqLabel = 'Daily';
      if (h.frequencyType === 'WEEKDAYS') freqLabel = 'Weekdays';
      if (h.frequencyType === 'CUSTOM_DAYS') freqLabel = 'Custom days';

      const dayPillsHtml = DAY_SHORT_LABELS.map((lbl, idx) => {
        const scheduled = isDayScheduledForHabit(h, idx + 1);
        return `<span class="habit-day-pill ${scheduled ? 'is-scheduled' : ''}">${lbl}</span>`;
      }).join('');

      const dotsHtml = DAY_SHORT_LABELS.map((_, idx) => {
        const scheduled = h.active && isDayScheduledForHabit(h, idx + 1);
        return `<span class="habit-7day-dot ${scheduled ? 'is-on' : ''}"></span>`;
      }).join('');

      return `
        <article class="habit-card">
          <div class="habit-card-top">
            <div class="habit-title-row">
              <span class="status-dot ${h.active ? 'status-dot--active' : 'status-dot--paused'}" title="${h.active ? 'Active' : 'Paused'}"></span>
              <h3 class="habit-card-title">${escapeHtml(h.title)}</h3>
            </div>

            <div class="dropdown-wrap">
              <button type="button" class="btn-item-action js-kebab-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${escapeAttr(h.title)}">
                ${SVG_ICONS.kebab}
              </button>
              <div class="dropdown-menu is-hidden" role="menu">
                <button type="button" class="dropdown-item dropdown-item--danger" role="menuitem" onclick="App.deleteHabit(${h.id}, '${escapeAttr(h.title)}')">Delete habit</button>
              </div>
            </div>
          </div>

          <div class="habit-tags-row">
            ${getCategoryTagHtml(h.category || 'GENERAL')}
            <span class="habit-freq-chip">${freqLabel}</span>
          </div>

          <div class="habit-day-pills" aria-label="Scheduled days of week">
            ${dayPillsHtml}
          </div>

          <div class="habit-card-meta">
            <span>${formatShortDate(h.startDate)}${h.endDate ? ` – ${formatShortDate(h.endDate)}` : ' · Ongoing'}</span>
            <span class="habit-7day-dots" title="Weekly schedule rhythm">${dotsHtml}</span>
          </div>

          <div class="habit-card-footer">
            <span class="status-badge ${h.active ? 'status-badge--success' : 'status-badge--muted'}">${h.active ? 'Active' : 'Paused'}</span>
            <button type="button" class="btn-forge btn-forge-secondary btn-forge-sm" onclick="App.toggleHabitActive(${h.id})">
              ${h.active ? 'Pause' : 'Activate'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function addHabitRow(title = '', category = 'CAREER') {
    const container = document.getElementById('habitRowsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'habit-activity-row';
    row.innerHTML = `
      <span class="habit-drag-handle" aria-hidden="true">⋮⋮</span>
      <input type="text" class="form-control-nature habit-row-title" placeholder="e.g. Reading, Run, Coding..." value="${escapeAttr(title)}" aria-label="Habit activity title">
      <select class="form-control-nature habit-row-category" aria-label="Habit category">
        <option value="CAREER" ${category === 'CAREER' ? 'selected' : ''}>Career</option>
        <option value="LEARNING" ${category === 'LEARNING' ? 'selected' : ''}>Learning</option>
        <option value="HEALTH" ${category === 'HEALTH' ? 'selected' : ''}>Health</option>
        <option value="MINDFULNESS" ${category === 'MINDFULNESS' ? 'selected' : ''}>Mindfulness</option>
        <option value="GENERAL" ${category === 'GENERAL' ? 'selected' : ''}>General</option>
      </select>
      <button type="button" class="btn-item-action delete habit-row-remove" aria-label="Remove activity row" title="Remove">&times;</button>
    `;
    const removeBtn = row.querySelector('.habit-row-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        row.remove();
        updateHabitRowsState();
      });
    }
    const titleInp = row.querySelector('.habit-row-title');
    if (titleInp) titleInp.addEventListener('input', updateHabitRowsState);
    container.appendChild(row);
    updateHabitRowsState();
    if (titleInp) titleInp.focus();
  }

  function updateHabitRowsState() {
    const rows = document.querySelectorAll('.habit-activity-row');
    const btnSubmit = document.getElementById('btnSubmitAddHabit');
    rows.forEach(r => {
      const removeBtn = r.querySelector('.habit-row-remove');
      if (removeBtn) {
        removeBtn.disabled = rows.length <= 1;
      }
    });

    if (btnSubmit) {
      let count = 0;
      rows.forEach(r => {
        const inp = r.querySelector('.habit-row-title');
        if (inp && inp.value.trim().length > 0) count++;
      });
      btnSubmit.textContent = count > 1 ? `Save ${count} Habit Schedules` : 'Save Habit Schedule';
    }
  }

  function resetHabitRows() {
    const container = document.getElementById('habitRowsContainer');
    if (!container) return;
    container.innerHTML = '';
    addHabitRow('', 'CAREER');
  }

  function setHabitFrequencyUI(freq) {
    const select = document.getElementById('habitFrequencySelect');
    if (select) select.value = freq;

    document.querySelectorAll('[data-freq-opt]').forEach(btn => {
      const match = btn.getAttribute('data-freq-opt') === freq;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-pressed', String(match));
    });

    const customGroup = document.getElementById('habitCustomDaysGroup');
    if (customGroup) {
      customGroup.classList.toggle('is-hidden', freq !== 'CUSTOM_DAYS');
    }
  }

  async function submitAddHabit() {
    const rows = document.querySelectorAll('.habit-activity-row');
    const frequencyType = document.getElementById('habitFrequencySelect').value;
    const startDate = document.getElementById('habitStartDateInput').value;
    const endDate = document.getElementById('habitEndDateInput').value;

    const habitItems = [];
    rows.forEach(r => {
      const titleInp = r.querySelector('.habit-row-title');
      const catSelect = r.querySelector('.habit-row-category');
      const title = titleInp ? titleInp.value.trim() : '';
      const category = catSelect ? catSelect.value : 'CAREER';
      if (title.length > 0) {
        habitItems.push({
          title,
          category,
          frequencyType,
          startDate: startDate || state.todayDate,
          endDate: endDate || null,
          active: true
        });
      }
    });

    if (habitItems.length === 0) {
      showToast('Please enter at least one habit activity', 'warning');
      return;
    }

    if (frequencyType === 'CUSTOM_DAYS') {
      const checkedDays = Array.from(document.querySelectorAll('input[name="customDay"]:checked')).map(cb => cb.value);
      if (checkedDays.length === 0) {
        showToast('Please select at least one day for custom schedule', 'warning');
        return;
      }
      const customDays = checkedDays.join(',');
      habitItems.forEach(h => { h.customDays = customDays; });
    }

    try {
      await api('/api/habits/batch', {
        method: 'POST',
        body: JSON.stringify(habitItems)
      });

      showToast(habitItems.length === 1
        ? `Habit "${habitItems[0].title}" created`
        : `Created ${habitItems.length} recurring habits`);

      hideModal('modalAddHabit');
      resetHabitRows();
      await loadHabits();
      await loadTodayChecklist();
    } catch (err) {}
  }

  async function toggleHabitActive(id) {
    try {
      const h = await api(`/api/habits/${id}/toggle`, { method: 'PATCH' });
      showToast(`Habit "${h.title}" is now ${h.active ? 'active' : 'paused'}`);
      await loadHabits();
      await loadTodayChecklist();
    } catch (err) {}
  }

  function deleteHabit(id, title) {
    closeAllMenus();
    openConfirmDialog({
      title: 'Delete Habit',
      message: `Delete habit "${title}"? Past completed checklist records will remain intact.`,
      confirmLabel: 'Delete Habit',
      onConfirm: async () => {
        await api(`/api/habits/${id}`, { method: 'DELETE' });
        showToast('Habit deleted');
        hideModal('modalConfirmDelete');
        await loadHabits();
      }
    });
  }

  // =========================================================================
  // GOALS SYSTEM
  // =========================================================================
  async function loadGoals() {
    if (!state.token) return;
    try {
      const goals = await api('/api/goals');
      state.goals = goals;
      renderGoals(goals);

      const activeGoalsCount = goals.filter(g => g.status !== 'ACHIEVED' && (g.completionPercentage || 0) < 100).length;
      const completedGoalsCount = goals.filter(g => g.status === 'ACHIEVED' || (g.completionPercentage || 0) >= 100).length;

      const countEl = document.getElementById('dashActiveGoalsCount');
      if (countEl) countEl.textContent = activeGoalsCount;

      const sumActive = document.getElementById('goalsSummaryActive');
      if (sumActive) sumActive.textContent = activeGoalsCount;

      const sumCompleted = document.getElementById('goalsSummaryCompleted');
      if (sumCompleted) sumCompleted.textContent = completedGoalsCount;

      const sumBest = document.getElementById('goalsSummaryBestStreak');
      if (sumBest) sumBest.textContent = `${state.streak ? state.streak.longestStreak : 0} days`;
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  }

  function renderGoals(goals) {
    const dashContainer = document.getElementById('dashGoalsList');
    if (dashContainer) {
      if (goals.length === 0) {
        dashContainer.innerHTML = renderEmptyState({
          icon: SVG_ICONS.target,
          title: 'No active goals',
          description: 'Commit to a 7, 14, 28, or 30-day milestone.',
          primaryBtn: '<button type="button" class="btn-forge btn-forge-primary btn-forge-sm" onclick="App.showModal(\'modalAddGoal\')">+ New Goal</button>'
        });
      } else {
        dashContainer.innerHTML = goals.slice(0, 3).map(g => {
          const pct = Math.min(100, Math.round(g.completionPercentage || 0));
          return `
            <div class="goal-dash-card">
              <div class="goal-dash-top">
                <span>${escapeHtml(g.title)}</span>
                <span class="goal-dash-pct tabular-num">${pct}%</span>
              </div>
              <div class="progress-bar-nature progress-bar-nature--sm">
                <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" data-pct="${pct}"></div>
              </div>
              <div class="goal-dash-meta tabular-num">
                <span>Day ${g.currentProgressDays} of ${g.targetDays}</span>
                <span>${g.remainingDays} days left</span>
              </div>
            </div>
          `;
        }).join('');
        dashContainer.querySelectorAll('[data-pct]').forEach(el => {
          el.style.width = `${el.getAttribute('data-pct')}%`;
        });
      }
    }

    const gridContainer = document.getElementById('goalsGridContainer');
    if (gridContainer) {
      if (goals.length === 0) {
        gridContainer.innerHTML = renderEmptyState({
          icon: SVG_ICONS.target,
          title: 'No discipline goals active',
          description: 'Set a 7-day, 14-day, 28-day, or custom consistency target.',
          primaryBtn: '<button type="button" class="btn-forge btn-forge-primary btn-forge-sm" onclick="App.showModal(\'modalAddGoal\')">+ Create Goal</button>'
        });
        return;
      }

      gridContainer.innerHTML = goals.map(g => {
        const pct = Math.min(100, Math.round(g.completionPercentage || 0));
        const isDone = g.status === 'ACHIEVED' || pct >= 100;
        return `
          <article class="goal-card">
            <div class="goal-card-top">
              <div>
                <h3 class="goal-card-title">${escapeHtml(g.title)}</h3>
                <div class="habit-tags-row">
                  <span class="habit-freq-chip tabular-num">${g.targetDays}-Day Target</span>
                  <span class="status-badge ${isDone ? 'status-badge--success' : 'status-badge--info'}">${isDone ? 'Achieved' : 'In Progress'}</span>
                </div>
              </div>
              <button type="button" class="btn-item-action delete" onclick="App.deleteGoal(${g.id}, '${escapeAttr(g.title)}')" aria-label="Delete goal ${escapeAttr(g.title)}" title="Remove Goal">&times;</button>
            </div>

            <div>
              <div class="goal-dash-top">
                <span class="muted-copy">Day ${g.currentProgressDays} of ${g.targetDays}</span>
                <span class="goal-dash-pct tabular-num">${pct}%</span>
              </div>
              <div class="progress-bar-nature">
                <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" data-pct="${pct}"></div>
              </div>
            </div>

            <div class="goal-card-footer tabular-num">
              <span>Target: <strong>${formatShortDate(g.targetDate)}</strong></span>
              <span>Remaining: <strong>${g.remainingDays} days</strong></span>
            </div>
          </article>
        `;
      }).join('');
      gridContainer.querySelectorAll('[data-pct]').forEach(el => {
        el.style.width = `${el.getAttribute('data-pct')}%`;
      });
    }
  }

  async function submitAddGoal() {
    const title = document.getElementById('goalTitleInput').value;
    const preset = document.getElementById('goalDurationPreset').value;
    const startDate = document.getElementById('goalStartDateInput').value;

    let targetDays = parseInt(preset, 10);
    if (preset === 'custom') {
      targetDays = parseInt(document.getElementById('goalCustomDaysInput').value, 10);
    }

    if (!title || !title.trim()) {
      showToast('Goal title is required', 'warning');
      return;
    }
    if (isNaN(targetDays) || targetDays < 1) {
      showToast('Target days must be at least 1', 'warning');
      return;
    }

    try {
      await api('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          targetDays,
          startDate: startDate || state.todayDate
        })
      });
      showToast(`Goal "${title.trim()}" created`);
      hideModal('modalAddGoal');
      document.getElementById('goalTitleInput').value = '';
      await loadGoals();
    } catch (err) {}
  }

  function deleteGoal(id, title) {
    openConfirmDialog({
      title: 'Remove Goal',
      message: `Remove goal "${title}"?`,
      confirmLabel: 'Remove Goal',
      onConfirm: async () => {
        await api(`/api/goals/${id}`, { method: 'DELETE' });
        showToast('Goal removed');
        hideModal('modalConfirmDelete');
        await loadGoals();
      }
    });
  }

  // =========================================================================
  // STREAKS & ACHIEVEMENTS
  // =========================================================================
  async function loadStreaks() {
    if (!state.token) return;
    try {
      const streak = await api('/api/streaks');
      state.streak = streak;

      const topbarStreakText = document.getElementById('topbarStreakText');
      if (topbarStreakText) topbarStreakText.textContent = `${streak.currentStreak} Day Streak`;

      const dashCurrent = document.getElementById('dashCurrentStreak');
      if (dashCurrent) dashCurrent.textContent = streak.currentStreak;

      const dashStreakCtx = document.getElementById('dashStreakContext');
      if (dashStreakCtx) {
        dashStreakCtx.textContent = streak.currentStreak > 0
          ? `${streak.totalSuccessfulDays} total perfect days`
          : 'Complete 100% today to start';
      }

      const dashLongest = document.getElementById('dashLongestStreak');
      if (dashLongest) dashLongest.textContent = streak.longestStreak;

      const bigCurr = document.getElementById('streakBigNumber');
      if (bigCurr) bigCurr.textContent = streak.currentStreak;

      const bigLong = document.getElementById('longestBigNumber');
      if (bigLong) bigLong.textContent = streak.longestStreak;

      const bigTotal = document.getElementById('totalSuccessfulBigNumber');
      if (bigTotal) bigTotal.textContent = streak.totalSuccessfulDays;

      const sumBest = document.getElementById('goalsSummaryBestStreak');
      if (sumBest) sumBest.textContent = `${streak.longestStreak} days`;

      // Next Milestone Progress
      const bestForNext = streak.currentStreak;
      const nextTarget = MILESTONE_TARGETS.find(t => t > bestForNext) || 100;
      const nextPct = Math.min(100, Math.round((bestForNext / nextTarget) * 100));
      const nextLabel = document.getElementById('streakNextMilestoneLabel');
      const nextRatio = document.getElementById('streakNextMilestoneRatio');
      const nextBar = document.getElementById('streakNextMilestoneBar');
      if (nextLabel) nextLabel.textContent = bestForNext >= 100 ? 'Mastery milestone reached' : `Next milestone: ${nextTarget}-day streak`;
      if (nextRatio) nextRatio.textContent = `${bestForNext} / ${nextTarget}`;
      if (nextBar) nextBar.style.width = `${nextPct}%`;

      const achievements = await api('/api/streaks/achievements');
      state.achievements = achievements;
      renderAchievements(achievements);
      updateProfileStats();
    } catch (err) {
      console.error('Failed to load streaks:', err);
    }
  }

  function getBadgeProgress(badgeKey) {
    const bestStreak = state.streak ? Math.max(state.streak.currentStreak || 0, state.streak.longestStreak || 0) : 0;
    const perfectDays = state.streak ? (state.streak.totalSuccessfulDays || 0) : 0;
    const completedToday = state.todayChecklist ? (state.todayChecklist.completedTasks || 0) : 0;

    switch (badgeKey) {
      case 'FIRST_STEP':
        return { current: Math.min(1, perfectDays > 0 || completedToday > 0 ? 1 : 0), target: 1, unit: 'task' };
      case 'STREAK_7':
        return { current: Math.min(7, bestStreak), target: 7, unit: 'days' };
      case 'STREAK_14':
        return { current: Math.min(14, bestStreak), target: 14, unit: 'days' };
      case 'STREAK_28':
        return { current: Math.min(28, bestStreak), target: 28, unit: 'days' };
      case 'STREAK_60':
        return { current: Math.min(60, bestStreak), target: 60, unit: 'days' };
      case 'STREAK_100':
        return { current: Math.min(100, bestStreak), target: 100, unit: 'days' };
      case 'PERFECT_MONTH':
        return { current: Math.min(30, perfectDays), target: 30, unit: 'days' };
      default:
        return { current: 0, target: 1, unit: 'step' };
    }
  }

  function renderAchievements(achievements) {
    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const unlockedCountEl = document.getElementById('unlockedBadgesCount');
    if (unlockedCountEl) unlockedCountEl.textContent = `${unlockedCount} / ${achievements.length}`;

    const dashContainer = document.getElementById('dashMilestonesList');
    if (dashContainer) {
      const unlocked = achievements.filter(a => a.unlocked);
      if (unlocked.length === 0) {
        dashContainer.innerHTML = renderEmptyState({
          icon: SVG_ICONS.target,
          title: 'First milestone awaits',
          description: 'Complete today’s checklist 100% to earn your first badge.'
        });
      } else {
        dashContainer.innerHTML = unlocked.slice(0, 4).map(a => `
          <div class="milestone-mini-tile">
            <div class="milestone-mini-icon" aria-hidden="true">${a.icon}</div>
            <div class="milestone-mini-title">${escapeHtml(a.title)}</div>
          </div>
        `).join('');
      }
    }

    const fullContainer = document.getElementById('badgesContainer');
    if (fullContainer) {
      let filtered = achievements;
      if (ui.badgeFilter === 'UNLOCKED') filtered = achievements.filter(a => a.unlocked);
      if (ui.badgeFilter === 'LOCKED') filtered = achievements.filter(a => !a.unlocked);

      if (filtered.length === 0) {
        fullContainer.innerHTML = renderEmptyState({
          icon: SVG_ICONS.leaf,
          title: 'No badges in this filter',
          description: 'Switch filter tabs to view all milestones.'
        });
        return;
      }

      fullContainer.innerHTML = filtered.map(a => {
        const prog = getBadgeProgress(a.badgeKey);
        const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
        return `
          <div class="badge-card ${a.unlocked ? '' : 'locked'}">
            <div class="badge-icon-box" aria-hidden="true">${a.icon}</div>
            <div class="badge-title">${escapeHtml(a.title)}</div>
            <div class="badge-desc">${escapeHtml(a.description)}</div>
            <div class="badge-progress-wrap">
              ${a.unlocked
                ? '<span class="status-badge status-badge--success">✓ Unlocked</span>'
                : `<span class="badge-progress-text tabular-num">${prog.current}/${prog.target} ${prog.unit}</span>
                   <div class="progress-bar-nature progress-bar-nature--sm"><div class="progress-bar-fill" data-pct="${pct}"></div></div>`
              }
            </div>
          </div>
        `;
      }).join('');
      fullContainer.querySelectorAll('[data-pct]').forEach(el => {
        el.style.width = `${el.getAttribute('data-pct')}%`;
      });
    }
  }

  // =========================================================================
  // CALENDAR & HISTORICAL INSPECTOR
  // =========================================================================
  async function renderCalendar(targetInspectDate = null) {
    const month = state.calendarMonth;
    const year = state.calendarYear;

    const label = document.getElementById('calendarMonthYearLabel');
    if (label) {
      label.textContent = FMT_MONTH_YEAR.format(new Date(year, month - 1, 1));
    }

    try {
      const historyData = await api(`/api/reports/month?year=${year}&month=${month}`);
      const historyMap = {};
      historyData.forEach(h => { historyMap[h.date] = h; });

      const container = document.getElementById('calendarCellsContainer');
      if (!container) return;
      container.innerHTML = '';

      const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell calendar-cell--pad';
        emptyCell.setAttribute('aria-hidden', 'true');
        container.appendChild(emptyCell);
      }

      const todayStr = state.todayDate || new Date().toISOString().split('T')[0];
      const defaultSelected = targetInspectDate || (todayStr.startsWith(`${year}-${String(month).padStart(2, '0')}`) ? todayStr : `${year}-${String(month).padStart(2, '0')}-01`);

      for (let day = 1; day <= daysInMonth; day++) {
        const monthPad = String(month).padStart(2, '0');
        const dayPad = String(day).padStart(2, '0');
        const dateStr = `${year}-${monthPad}-${dayPad}`;

        const isToday = (dateStr === todayStr);
        const isFuture = (dateStr > todayStr);
        const rec = historyMap[dateStr];

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-cell';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('data-date', dateStr);

        let statusText = 'No tasks';
        if (isToday) cell.classList.add('today');
        if (dateStr === defaultSelected && !isFuture) cell.classList.add('selected');

        if (isFuture) {
          cell.classList.add('future');
          cell.setAttribute('aria-disabled', 'true');
          cell.setAttribute('tabindex', '-1');
          cell.setAttribute('aria-label', `${formatDateReadable(dateStr)}, Locked future date`);
          cell.title = 'Upcoming date (locked)';
        } else {
          if (rec) {
            const pct = rec.total > 0 ? Math.round((rec.completed / rec.total) * 100) : 0;
            if (rec.successful && rec.total > 0) {
              cell.classList.add('perfect');
              statusText = `100% completed (${rec.completed}/${rec.total})`;
            } else if (rec.completed > 0) {
              const lvl = pct >= 75 ? 'partial-4' : pct >= 50 ? 'partial-3' : pct >= 25 ? 'partial-2' : 'partial-1';
              cell.classList.add(lvl);
              statusText = `${pct}% partial (${rec.completed}/${rec.total})`;
            } else if (rec.total > 0) {
              cell.classList.add('missed');
              statusText = 'Incomplete / Missed';
            }
          }
          cell.setAttribute('aria-label', `${formatDateReadable(dateStr)}, ${statusText}`);
          cell.title = statusText;
          cell.addEventListener('click', () => {
            container.querySelectorAll('.calendar-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            inspectCalendarDate(dateStr, isToday, false);
            if (window.innerWidth < 768) {
              const insp = document.getElementById('calendarInspectorCard');
              if (insp) insp.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }

        const numSpan = document.createElement('span');
        numSpan.textContent = String(day);
        cell.appendChild(numSpan);

        if (rec && rec.total > 0 && !isFuture) {
          const dot = document.createElement('span');
          dot.className = 'calendar-cell-dot';
          dot.setAttribute('aria-hidden', 'true');
          cell.appendChild(dot);
        }

        container.appendChild(cell);
      }

      const inspectIsToday = defaultSelected === todayStr;
      const inspectIsFuture = defaultSelected > todayStr;
      inspectCalendarDate(defaultSelected, inspectIsToday, inspectIsFuture);
    } catch (err) {
      console.error('Failed to render calendar:', err);
    }
  }

  function handleCalendarKeydown(e) {
    const cell = e.target.closest('.calendar-cell[data-date]');
    if (!cell) return;
    const container = document.getElementById('calendarCellsContainer');
    if (!container) return;

    const enabledCells = Array.from(container.querySelectorAll('.calendar-cell[data-date]:not(.future)'));
    const idx = enabledCells.indexOf(cell);
    if (idx < 0) return;

    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = Math.min(enabledCells.length - 1, idx + 1);
    else if (e.key === 'ArrowLeft') nextIdx = Math.max(0, idx - 1);
    else if (e.key === 'ArrowDown') nextIdx = Math.min(enabledCells.length - 1, idx + 7);
    else if (e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 7);
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = enabledCells.length - 1;
    else return;

    e.preventDefault();
    enabledCells[nextIdx].focus();
  }

  async function inspectCalendarDate(dateStr, isToday, isFuture) {
    const titleEl = document.getElementById('selectedDateInspectorTitle');
    const badgeEl = document.getElementById('selectedDateProtectionBadge');
    const scoreEl = document.getElementById('selectedDateScoreBadge');
    const ringEl = document.getElementById('selectedDateRingCircle');
    const container = document.getElementById('selectedDateChecklistDetails');

    if (titleEl) titleEl.textContent = formatDateReadable(dateStr);

    if (badgeEl) {
      badgeEl.className = 'status-badge';
      if (isToday) {
        badgeEl.textContent = 'Today (Active Checklist)';
        badgeEl.classList.add('status-badge--success');
      } else if (isFuture) {
        badgeEl.textContent = 'Upcoming Day (Locked)';
        badgeEl.classList.add('status-badge--muted');
      } else {
        badgeEl.textContent = 'Archived History (Read-Only)';
        badgeEl.classList.add('status-badge--info');
      }
    }

    try {
      const data = await api(`/api/checklist/date/${dateStr}`);
      const pct = Math.round(data.completionPercentage || 0);
      if (scoreEl) scoreEl.textContent = `${pct}%`;
      if (ringEl) {
        const circumference = 2 * Math.PI * 21;
        ringEl.style.strokeDashoffset = (circumference - (pct / 100) * circumference).toFixed(2);
      }

      if (!container) return;

      if (!data.items || data.items.length === 0) {
        container.innerHTML = renderEmptyState({
          icon: SVG_ICONS.history,
          title: isFuture ? 'Future date locked' : 'No records for this date',
          description: isFuture
            ? 'Future days stay locked until they arrive.'
            : 'No tasks were recorded on this day.'
        });
        return;
      }

      container.innerHTML = data.items.map(item => `
        <div class="checklist-item checklist-item--compact ${item.completed ? 'completed' : ''}">
          <div class="item-left">
            <span class="status-badge ${item.completed ? 'status-badge--success' : 'status-badge--muted'}">${item.completed ? '✓' : '—'}</span>
            <div class="item-details">
              <span class="item-title">${escapeHtml(item.title)}</span>
              <div class="item-meta">
                ${getCategoryTagHtml(item.category || 'GENERAL')}
                <span>${item.completed ? 'Completed' : 'Not completed'}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      if (container) {
        container.innerHTML = `<p class="muted-copy">Could not load checklist details for ${escapeHtml(dateStr)}.</p>`;
      }
    }
  }

  // =========================================================================
  // HISTORICAL LOG & MINI HEATMAP
  // =========================================================================
  async function refreshMiniHeatmap() {
    if (!state.token) return;
    try {
      const records = await api('/api/reports/history', { silentToast: true });
      state.history = records || [];
      renderMiniHeatmap(state.history);
    } catch (err) {}
  }

  function renderMiniHeatmap(records) {
    const container = document.getElementById('dashMiniHeatmap');
    if (!container) return;

    const map = {};
    (records || []).forEach(r => { map[r.date] = r; });

    const baseDate = parseYmd(state.todayDate) || new Date();
    const cells = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const rec = map[key];

      let cls = '';
      let pctText = '—';
      if (rec && rec.totalTasks > 0) {
        const pct = Math.round(rec.completionPercentage || 0);
        pctText = `${pct}%`;
        if (rec.isSuccessful || pct === 100) cls = 'is-perfect';
        else if (rec.completedTasks > 0) cls = 'is-partial';
        else cls = 'is-missed';
      }

      cells.push(`
        <div class="mini-heat-cell" title="${formatShortDate(key)}: ${pctText}">
          <div class="mini-heat-box ${cls} tabular-num">${rec && rec.totalTasks > 0 ? Math.round(rec.completionPercentage) : '·'}</div>
          <span class="mini-heat-day">${FMT_WEEKDAY_SHORT.format(d).slice(0, 2)}</span>
        </div>
      `);
    }

    container.innerHTML = cells.join('');
  }

  async function loadHistory() {
    if (!state.token) return;
    try {
      const records = await api('/api/reports/history');
      state.history = records || [];
      ui.historyVisibleLimit = 20;
      applyHistoryFilters();
      renderMiniHeatmap(state.history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function applyHistoryFilters() {
    const dateVal = document.getElementById('historyDateFilter')?.value || '';
    const statusVal = ui.historyStatusFilter || 'ALL';

    let filtered = state.history.slice();
    if (dateVal) {
      filtered = filtered.filter(r => r.date === dateVal);
    }
    if (statusVal === 'PERFECT') {
      filtered = filtered.filter(r => r.totalTasks > 0 && Math.round(r.completionPercentage) === 100);
    } else if (statusVal === 'PARTIAL') {
      filtered = filtered.filter(r => r.completedTasks > 0 && Math.round(r.completionPercentage) < 100);
    } else if (statusVal === 'MISSED') {
      filtered = filtered.filter(r => r.totalTasks > 0 && r.completedTasks === 0);
    }

    renderHistoryTable(filtered);
  }

  function renderHistoryTable(records) {
    const container = document.getElementById('historyTableContainer');
    if (!container) return;

    const daysLoggedEl = document.getElementById('historyDaysLogged');
    const perfectDaysEl = document.getElementById('historyPerfectDays');
    const avgEl = document.getElementById('historyAvgCompletion');

    const perfectCount = records.filter(r => r.totalTasks > 0 && Math.round(r.completionPercentage) === 100).length;
    const avgPct = records.length > 0
      ? Math.round(records.reduce((acc, r) => acc + (r.completionPercentage || 0), 0) / records.length)
      : 0;

    if (daysLoggedEl) daysLoggedEl.textContent = records.length;
    if (perfectDaysEl) perfectDaysEl.textContent = perfectCount;
    if (avgEl) avgEl.textContent = `${avgPct}%`;

    if (records.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: SVG_ICONS.history,
        title: 'No matching history records',
        description: 'Adjust filters or complete today’s checklist to start building your archive.'
      });
      return;
    }

    const visible = records.slice(0, ui.historyVisibleLimit);

    const getStatusBadge = r => {
      if (r.completionPercentage < 100 && r.completedTasks > 0) {
        return '<span class="status-badge status-badge--warning">Partial</span>';
      }
      if (r.completedTasks === 0 && r.totalTasks > 0) {
        return '<span class="status-badge status-badge--danger">Missed</span>';
      }
      return '<span class="status-badge status-badge--success">100% Perfect</span>';
    };

    const tableRows = visible.map(r => {
      const pct = Math.round(r.completionPercentage || 0);
      return `
        <tr>
          <td><strong>${escapeHtml(formatDateReadable(r.date))}</strong></td>
          <td class="tabular-num">${r.totalTasks}</td>
          <td class="tabular-num">${r.completedTasks}</td>
          <td class="tabular-num">
            <div class="score-cell-bar">
              <span class="score-mini-track" aria-hidden="true"><span class="score-mini-fill" data-pct="${pct}"></span></span>
              <strong>${pct}%</strong>
            </div>
          </td>
          <td>${getStatusBadge(r)}</td>
          <td>
            <button type="button" class="btn-forge btn-forge-secondary btn-forge-sm" onclick="App.viewHistoricalDay('${r.date}')">
              View Tasks
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const mobileCards = visible.map(r => {
      const pct = Math.round(r.completionPercentage || 0);
      return `
        <div class="history-mobile-card">
          <div>
            <div class="history-mobile-meta">${escapeHtml(formatDateReadable(r.date))} · ${r.completedTasks} of ${r.totalTasks} · ${pct}%</div>
            <div class="history-mobile-sub">${getStatusBadge(r)}</div>
          </div>
          <button type="button" class="btn-forge btn-forge-secondary btn-forge-sm" onclick="App.viewHistoricalDay('${r.date}')">View</button>
        </div>
      `;
    }).join('');

    const loadMoreBtn = records.length > visible.length
      ? `<div class="load-more-wrap"><button type="button" class="btn-forge btn-forge-outline btn-forge-sm" id="btnHistoryLoadMore">Load more (${records.length - visible.length} remaining)</button></div>`
      : '';

    container.innerHTML = `
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Total</th>
              <th scope="col">Completed</th>
              <th scope="col">Score</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="history-cards-mobile">${mobileCards}</div>
      ${loadMoreBtn}
    `;

    container.querySelectorAll('[data-pct]').forEach(el => {
      el.style.width = `${el.getAttribute('data-pct')}%`;
    });

    const moreBtn = document.getElementById('btnHistoryLoadMore');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        ui.historyVisibleLimit += 20;
        applyHistoryFilters();
      });
    }
  }

  async function viewHistoricalDay(dateStr) {
    const parts = (dateStr || '').split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      state.calendarYear = parts[0];
      state.calendarMonth = parts[1];
    }
    navigateTo('calendar');
    await renderCalendar(dateStr);
  }

  // =========================================================================
  // REPORTS & LAZY CHART.JS
  // =========================================================================
  function loadChartJs() {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    if (ui.chartJsPromise) return ui.chartJsPromise;

    ui.chartJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Chart.js'));
      document.head.appendChild(script);
    });
    return ui.chartJsPromise;
  }

  async function renderReports() {
    if (!state.token) return;
    try {
      const summary = await api('/api/reports/summary');
      ui.lastReportSummary = summary;
      renderReportsSummaryCards(summary);

      const hasTrend = summary.trend14Days && Object.keys(summary.trend14Days).length > 0;
      const cats = summary.categoryDistribution ? Object.keys(summary.categoryDistribution) : [];
      const hasCats = cats.length > 0;

      const chartsGrid = document.getElementById('reportsChartsGrid');
      const emptyBox = document.getElementById('reportsEmptyState');

      if (!hasTrend && !hasCats && summary.totalDaysTracked === 0) {
        if (chartsGrid) chartsGrid.classList.add('is-hidden');
        if (emptyBox) {
          emptyBox.classList.remove('is-hidden');
          emptyBox.innerHTML = renderEmptyState({
            icon: SVG_ICONS.chart,
            title: 'No report data yet',
            description: 'Complete tasks on Today’s Checklist to generate trends and category breakdowns.'
          });
        }
        return;
      }

      if (chartsGrid) chartsGrid.classList.remove('is-hidden');
      if (emptyBox) emptyBox.classList.add('is-hidden');

      await loadChartJs();
      drawReportCharts(summary);
    } catch (err) {
      console.error('Failed to render reports:', err);
    }
  }

  function renderReportsSummaryCards(summary) {
    const summaryTable = document.getElementById('reportsSummaryTable');
    if (!summaryTable) return;
    summaryTable.innerHTML = `
      <div class="grid-4">
        <div class="summary-mini-card">
          <span class="summary-mini-label">Completed Tasks</span>
          <strong class="display-num summary-mini-value summary-mini-value--brand">${summary.totalCompletedTasks || 0}</strong>
        </div>
        <div class="summary-mini-card">
          <span class="summary-mini-label">Missed Tasks</span>
          <strong class="display-num summary-mini-value summary-mini-value--danger">${summary.totalMissedTasks || 0}</strong>
        </div>
        <div class="summary-mini-card">
          <span class="summary-mini-label">Active Streak</span>
          <strong class="display-num summary-mini-value summary-mini-value--amber">${summary.currentStreak || 0}</strong>
        </div>
        <div class="summary-mini-card">
          <span class="summary-mini-label">Best Streak</span>
          <strong class="display-num summary-mini-value">${summary.longestStreak || 0}</strong>
        </div>
      </div>
    `;
  }

  function drawReportCharts(summary) {
    if (typeof Chart === 'undefined' || !summary) return;

    const css = getComputedStyle(document.documentElement);
    const text3 = css.getPropertyValue('--text-3').trim();
    const borderCol = css.getPropertyValue('--border').trim();
    const surfaceCol = css.getPropertyValue('--surface-2').trim();
    const brandInk = css.getPropertyValue('--brand-ink').trim();
    const brandSoft = css.getPropertyValue('--brand-soft').trim();

    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = text3;

    const trendSkel = document.getElementById('trendChartSkeleton');
    const catSkel = document.getElementById('categoryChartSkeleton');
    if (trendSkel) trendSkel.classList.add('is-hidden');
    if (catSkel) catSkel.classList.add('is-hidden');

    const trendCanvas = document.getElementById('chartDailyTrend');
    if (trendCanvas && summary.trend14Days) {
      const labels = Object.keys(summary.trend14Days).map(d => {
        const dt = parseYmd(d);
        return dt ? `${dt.getMonth() + 1}/${dt.getDate()}` : d;
      });
      const dataValues = Object.values(summary.trend14Days);

      if (state.charts.trend) state.charts.trend.destroy();

      state.charts.trend = new Chart(trendCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Completion %',
            data: dataValues,
            borderColor: brandInk,
            backgroundColor: brandSoft,
            tension: 0.32,
            fill: true,
            pointBackgroundColor: brandInk,
            pointRadius: 3.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: borderCol } },
            y: {
              min: 0,
              max: 100,
              grid: { color: borderCol },
              ticks: { callback: v => `${v}%` }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    const catCanvas = document.getElementById('chartCategoryDist');
    const customLegend = document.getElementById('categoryCustomLegend');
    const centerTotal = document.getElementById('doughnutCenterTotal');
    const centerVal = document.getElementById('doughnutTotalValue');

    if (catCanvas && summary.categoryDistribution) {
      const cats = Object.keys(summary.categoryDistribution);
      const counts = Object.values(summary.categoryDistribution);
      const totalTasks = counts.reduce((a, b) => a + b, 0);

      if (state.charts.category) state.charts.category.destroy();

      if (cats.length > 0) {
        const colors = cats.map(c => {
          const meta = CATEGORY_META[c] || CATEGORY_META.GENERAL;
          return css.getPropertyValue(meta.cssVar).trim();
        });

        state.charts.category = new Chart(catCanvas, {
          type: 'doughnut',
          data: {
            labels: cats.map(c => (CATEGORY_META[c] || CATEGORY_META.GENERAL).label),
            datasets: [{
              data: counts,
              backgroundColor: colors,
              borderColor: surfaceCol,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: { display: false }
            }
          }
        });

        if (centerTotal && centerVal) {
          centerVal.textContent = totalTasks;
          centerTotal.classList.remove('is-hidden');
        }

        if (customLegend) {
          customLegend.innerHTML = cats.map((c, idx) => {
            const meta = CATEGORY_META[c] || CATEGORY_META.GENERAL;
            return `
              <span class="chart-legend-item">
                <span class="chart-legend-dot" data-color="${escapeAttr(colors[idx])}"></span>
                <span>${escapeHtml(meta.label)}</span>
                <strong class="tabular-num">${counts[idx]}</strong>
              </span>
            `;
          }).join('');
          customLegend.querySelectorAll('[data-color]').forEach(dot => {
            dot.style.backgroundColor = dot.getAttribute('data-color');
          });
        }
      }
    }
  }

  // Data Export Functions
  function exportReportCSV() {
    closeAllMenus();
    if (!state.history || state.history.length === 0) {
      showToast('No history available to export', 'warning');
      return;
    }
    let csv = 'Date,Total Tasks,Completed Tasks,Completion Percentage,Successful\n';
    state.history.forEach(r => {
      csv += `${r.date},${r.totalTasks},${r.completedTasks},${r.completionPercentage},${r.isSuccessful}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keizoku_productivity_${state.todayDate || 'export'}.csv`;
    a.click();
    showToast('Productivity CSV exported');
  }

  function exportReportJSON() {
    closeAllMenus();
    exportFullBackup();
  }

  function exportFullBackup() {
    const backupData = {
      user: state.user,
      today: state.todayDate,
      streak: state.streak,
      goals: state.goals,
      habits: state.habits,
      history: state.history,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keizoku_backup_${state.todayDate || 'export'}.json`;
    a.click();
    showToast('Full JSON backup downloaded');
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  function getNoticeKey(n) {
    return `${n.id || ''}:${n.type || ''}:${n.title || ''}`;
  }

  function updateUnreadBadge() {
    const badge = document.getElementById('unreadNoticeBadge');
    if (!badge) return;
    const hasUnread = ui.notices.some(n => !ui.readNoticeKeys.has(getNoticeKey(n)));
    badge.classList.toggle('is-hidden', !hasUnread);
  }

  async function refreshNotificationBadge() {
    if (!state.token) return;
    try {
      const notices = await api('/api/notifications', { silentToast: true });
      ui.notices = Array.isArray(notices) ? notices : [];
      updateUnreadBadge();
    } catch (err) {}
  }

  async function loadNotifications() {
    if (!state.token) return;
    try {
      const notices = await api('/api/notifications');
      ui.notices = Array.isArray(notices) ? notices : [];
      updateUnreadBadge();
      renderNotificationsFeed();

      const prefs = await api('/api/notifications/preferences');
      const timeInput = document.getElementById('prefDailyReminderTime');
      if (timeInput) timeInput.value = prefs.dailyReminderTime || '08:00';

      const reminderCheck = document.getElementById('prefDailyReminderEnabled');
      if (reminderCheck) reminderCheck.checked = prefs.dailyReminderEnabled;

      const pendingCheck = document.getElementById('prefPendingReminder');
      if (pendingCheck) pendingCheck.checked = prefs.pendingTaskReminder;

      const streakCheck = document.getElementById('prefStreakWarning');
      if (streakCheck) streakCheck.checked = prefs.streakWarningEnabled;

      const qStart = document.getElementById('prefQuietStart');
      if (qStart) qStart.value = prefs.quietHoursStart || '22:00';

      const qEnd = document.getElementById('prefQuietEnd');
      if (qEnd) qEnd.value = prefs.quietHoursEnd || '07:00';

      updateBrowserNotifStatus();
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  function renderNotificationsFeed() {
    const container = document.getElementById('notificationsFeedList');
    if (!container) return;

    if (!ui.notices || ui.notices.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: SVG_ICONS.bell,
        title: "You're all caught up",
        description: 'No active reminders or streak alerts right now.'
      });
      return;
    }

    container.innerHTML = ui.notices.map(n => {
      const isUnread = !ui.readNoticeKeys.has(getNoticeKey(n));
      const levelClass = n.level === 'warning'
        ? 'notice-icon-circle--warning'
        : n.level === 'success'
          ? 'notice-icon-circle--success'
          : '';
      return `
        <div class="notice-card">
          <div class="notice-card-left">
            <div class="notice-icon-circle ${levelClass}" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            </div>
            <div>
              <div class="notice-title">${escapeHtml(n.title)}</div>
              <div class="notice-msg">${escapeHtml(n.message)}</div>
              <div class="notice-time">${escapeHtml(n.time || '')}</div>
            </div>
          </div>
          ${isUnread ? '<span class="notice-unread-pill" title="Unread"></span>' : ''}
        </div>
      `;
    }).join('');
  }

  function markAllNotificationsRead() {
    ui.notices.forEach(n => ui.readNoticeKeys.add(getNoticeKey(n)));
    updateUnreadBadge();
    renderNotificationsFeed();
    showToast('All notifications marked as read');
  }

  function clearAllNotifications() {
    ui.notices.forEach(n => ui.readNoticeKeys.add(getNoticeKey(n)));
    ui.notices = [];
    updateUnreadBadge();
    renderNotificationsFeed();
    showToast('Notifications cleared');
  }

  function updateBrowserNotifStatus() {
    const textEl = document.getElementById('browserNotifStatusText');
    const dotEl = document.getElementById('browserNotifDot');
    if (!textEl) return;

    if (!('Notification' in window)) {
      textEl.textContent = 'Web notifications are not supported in this browser.';
      if (dotEl) dotEl.className = 'status-dot status-dot--muted';
    } else if (Notification.permission === 'granted') {
      textEl.textContent = 'Browser notifications are active.';
      if (dotEl) dotEl.className = 'status-dot status-dot--active';
    } else if (Notification.permission === 'denied') {
      textEl.textContent = 'Blocked in browser settings.';
      if (dotEl) dotEl.className = 'status-dot status-dot--danger';
    } else {
      textEl.textContent = 'Permission has not been requested yet.';
      if (dotEl) dotEl.className = 'status-dot status-dot--warning';
    }
  }

  async function requestBrowserNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported by this browser', 'warning');
      return;
    }
    const perm = await Notification.requestPermission();
    updateBrowserNotifStatus();
    if (perm === 'granted') {
      showToast('Notification permission granted');
      try {
        new Notification('KEIZOKU', { body: 'Discipline notifications are now active.' });
      } catch (e) {}
    } else {
      showToast('Notification permission denied or dismissed', 'warning');
    }
  }

  async function saveNotificationPreferences() {
    const dailyReminderTime = document.getElementById('prefDailyReminderTime').value;
    const dailyReminderEnabled = document.getElementById('prefDailyReminderEnabled').checked;
    const pendingTaskReminder = document.getElementById('prefPendingReminder').checked;
    const streakWarningEnabled = document.getElementById('prefStreakWarning').checked;
    const quietHoursStart = document.getElementById('prefQuietStart').value;
    const quietHoursEnd = document.getElementById('prefQuietEnd').value;

    try {
      await api('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          dailyReminderEnabled,
          dailyReminderTime,
          pendingTaskReminder,
          streakWarningEnabled,
          quietHoursEnabled: true,
          quietHoursStart,
          quietHoursEnd,
          browserNotificationsEnabled: ('Notification' in window && Notification.permission === 'granted')
        })
      });
      showToast('Notification settings saved');
    } catch (err) {}
  }

  // =========================================================================
  // SETTINGS & THEME MANAGEMENT
  // =========================================================================
  function updateTimezoneHint() {
    const select = document.getElementById('settingTimezoneSelect');
    const hint = document.getElementById('timezoneCurrentTimeHint');
    if (!select || !hint) return;
    try {
      const tz = select.value;
      const nowStr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(new Date());
      hint.textContent = `Current time in ${tz}: ${nowStr} · Used for midnight transitions.`;
    } catch (e) {
      hint.textContent = 'Used for automatic date transitions at midnight.';
    }
  }

  function resolveTheme(mode) {
    if (mode === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    ui.themeMode = mode || 'light';
    localStorage.setItem('keizoku_theme_mode', ui.themeMode);

    const resolved = resolveTheme(ui.themeMode);
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('keizoku_theme', resolved);
    localStorage.setItem('dayforge_theme', resolved);

    const metaTheme = document.getElementById('metaThemeColor');
    if (metaTheme) metaTheme.setAttribute('content', resolved === 'dark' ? '#0E1412' : '#1C4736');

    const iconSun = document.getElementById('iconSun');
    const iconMoon = document.getElementById('iconMoon');
    const themeBtn = document.getElementById('btnThemeToggle');
    if (iconSun && iconMoon) {
      iconSun.classList.toggle('is-hidden', resolved === 'dark');
      iconMoon.classList.toggle('is-hidden', resolved !== 'dark');
    }
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      themeBtn.setAttribute('title', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }

    const select = document.getElementById('settingThemeSelect');
    if (select) select.value = ui.themeMode;

    document.querySelectorAll('[data-theme-choice]').forEach(card => {
      const match = card.getAttribute('data-theme-choice') === ui.themeMode;
      card.setAttribute('aria-checked', String(match));
    });

    if (ui.activeSection === 'reports' && ui.lastReportSummary) {
      drawReportCharts(ui.lastReportSummary);
    }
  }

  function toggleTheme() {
    const currentResolved = document.documentElement.getAttribute('data-theme') || 'light';
    const next = currentResolved === 'light' ? 'dark' : 'light';
    applyTheme(next);
  }

  async function saveGeneralSettings() {
    const tz = document.getElementById('settingTimezoneSelect').value;
    const theme = document.getElementById('settingThemeSelect').value;

    try {
      await api('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({ timezone: tz })
      });

      applyTheme(theme);
      showToast(`Settings saved (${tz})`);
      if (state.user) state.user.timezone = tz;
      updateUserUI();
      await loadTodayChecklist();
    } catch (err) {}
  }

  function resetAllUserData() {
    openConfirmDialog({
      title: 'Reset All User Data',
      message: 'This permanently deletes all checklist entries, habits, goals, milestones, and resets your streak to 0. This cannot be undone.',
      confirmLabel: 'Reset Everything',
      requireDeleteWord: true,
      onConfirm: async () => {
        await api('/api/user/reset-data', { method: 'POST' });
        showToast('All records deleted. Your slate is clean.');
        hideModal('modalConfirmDelete');
        await loadTodayChecklist();
        await loadHabits();
        await loadGoals();
        await loadStreaks();
        await loadHistory();
        if (ui.activeSection === 'reports') renderReports();
      }
    });
  }

  // =========================================================================
  // EVENT WIRING
  // =========================================================================
  function bindEvents() {
    // Sidebar nav items
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        if (section) navigateTo(section);
      });
    });

    // Sidebar rail collapse (>=1024px)
    const collapseBtn = document.getElementById('btnSidebarCollapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const collapsed = document.body.classList.toggle('sidebar-collapsed');
        collapseBtn.setAttribute('aria-pressed', String(collapsed));
        localStorage.setItem('keizoku_sidebar_collapsed', collapsed ? '1' : '0');
      });
    }

    // Mobile drawer controls
    const mobileMenuBtn = document.getElementById('btnMobileMenuToggle');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        setDrawerOpen(!(sidebar && sidebar.classList.contains('open')));
      });
    }

    const sidebarCloseBtn = document.getElementById('btnSidebarClose');
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', () => setDrawerOpen(false));

    const sidebarScrim = document.getElementById('sidebarScrim');
    if (sidebarScrim) sidebarScrim.addEventListener('click', () => setDrawerOpen(false));

    // Mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const section = btn.getAttribute('data-section');
        if (section) navigateTo(section);
      });
    });

    const moreBtn = document.getElementById('btnMobileMore');
    if (moreBtn) moreBtn.addEventListener('click', () => showModal('mobileMoreSheet'));

    document.querySelectorAll('[data-more-section]').forEach(item => {
      item.addEventListener('click', () => {
        const sec = item.getAttribute('data-more-section');
        if (sec) navigateTo(sec);
      });
    });

    // Topbar controls
    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const bellBtn = document.getElementById('btnTopBell');
    if (bellBtn) bellBtn.addEventListener('click', () => navigateTo('notifications'));

    const avatarMenuBtn = document.getElementById('btnTopbarAvatarMenu');
    const avatarMenu = document.getElementById('topbarAvatarMenu');
    if (avatarMenuBtn && avatarMenu) {
      avatarMenuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const willOpen = avatarMenu.classList.contains('is-hidden');
        closeAllMenus();
        avatarMenu.classList.toggle('is-hidden', !willOpen);
        avatarMenuBtn.setAttribute('aria-expanded', String(willOpen));
      });
    }

    document.querySelectorAll('[data-avatar-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-avatar-action');
        closeAllMenus();
        if (act === 'profile') navigateTo('profile');
        else if (act === 'settings') navigateTo('settings');
        else if (act === 'logout') performLogout();
      });
    });

    // Global delegated click for dropdown menus & modal backdrop close
    document.addEventListener('click', e => {
      const kebabBtn = e.target.closest('.js-kebab-trigger');
      if (kebabBtn) {
        e.stopPropagation();
        const menu = kebabBtn.nextElementSibling;
        const willOpen = menu && menu.classList.contains('is-hidden');
        closeAllMenus();
        if (menu && willOpen) {
          menu.classList.remove('is-hidden');
          kebabBtn.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      if (!e.target.closest('.dropdown-menu')) {
        closeAllMenus();
      }

      // History & Reports export dropdown buttons
      const expTrigger = e.target.closest('#btnHistoryExportMenu, #btnReportsExportMenu');
      if (expTrigger) {
        e.stopPropagation();
        const menu = expTrigger.nextElementSibling;
        const willOpen = menu && menu.classList.contains('is-hidden');
        closeAllMenus();
        if (menu && willOpen) {
          menu.classList.remove('is-hidden');
          expTrigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      // Modal backdrop click close
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        hideModal(e.target.id);
      }
    });

    // Global keyboard support (Escape & Modal Focus Trap)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAllMenus();
        const openModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
        if (openModals.length > 0) {
          hideModal(openModals[openModals.length - 1].id);
          return;
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          setDrawerOpen(false);
        }
        return;
      }

      if (e.key === 'Tab') {
        const openModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
        if (openModals.length === 0) return;
        const topModal = openModals[openModals.length - 1];
        const focusables = getFocusableElements(topModal);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Sidebar auth button
    const authToggle = document.getElementById('btnSidebarAuthToggle');
    if (authToggle) authToggle.addEventListener('click', () => openAuthSurface(false));

    // Today & Dashboard Actions
    const btnOpenBatch = document.getElementById('btnOpenBatchAddModal');
    if (btnOpenBatch) btnOpenBatch.addEventListener('click', () => showModal('modalBatchAdd'));

    const btnOpenSingle = document.getElementById('btnOpenSingleAddModal');
    if (btnOpenSingle) btnOpenSingle.addEventListener('click', () => showModal('modalSingleAdd'));

    const btnCompleteAll = document.getElementById('btnCompleteAllToday');
    if (btnCompleteAll) btnCompleteAll.addEventListener('click', completeAllToday);

    const btnGroupCat = document.getElementById('btnGroupByCategory');
    if (btnGroupCat) {
      btnGroupCat.addEventListener('click', () => {
        ui.todayGroupByCategory = !ui.todayGroupByCategory;
        btnGroupCat.setAttribute('aria-pressed', String(ui.todayGroupByCategory));
        if (state.todayChecklist) renderTodayChecklist(state.todayChecklist);
      });
    }

    const btnDashBatch = document.getElementById('btnDashBatchAdd');
    if (btnDashBatch) {
      btnDashBatch.addEventListener('click', () => {
        const input = document.getElementById('dashQuickBatchInput');
        const cat = document.getElementById('dashQuickCategorySelect')?.value || 'GENERAL';
        if (input) submitBatchAdd(input.value, cat);
      });
    }

    const dashQuickInput = document.getElementById('dashQuickBatchInput');
    if (dashQuickInput) {
      dashQuickInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const cat = document.getElementById('dashQuickCategorySelect')?.value || 'GENERAL';
          submitBatchAdd(dashQuickInput.value, cat);
        }
      });
    }

    // Modal submit buttons
    const btnSubmitBatch = document.getElementById('btnSubmitBatchAdd');
    if (btnSubmitBatch) {
      btnSubmitBatch.addEventListener('click', () => {
        const text = document.getElementById('batchInputTextarea').value;
        const cat = document.getElementById('batchCategorySelect').value;
        submitBatchAdd(text, cat);
      });
    }

    const btnSubmitSingle = document.getElementById('btnSubmitSingleAdd');
    if (btnSubmitSingle) {
      btnSubmitSingle.addEventListener('click', () => {
        const title = document.getElementById('singleItemTitle').value;
        const cat = document.getElementById('singleItemCategory').value;
        submitSingleAdd(title, cat);
      });
    }

    const singleTitleInp = document.getElementById('singleItemTitle');
    if (singleTitleInp) {
      singleTitleInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitSingleAdd(singleTitleInp.value, document.getElementById('singleItemCategory').value);
        }
      });
    }

    const btnSubmitEdit = document.getElementById('btnSubmitEditItem');
    if (btnSubmitEdit) btnSubmitEdit.addEventListener('click', submitEditItem);

    const btnSubmitDelete = document.getElementById('btnSubmitConfirmDelete');
    if (btnSubmitDelete) btnSubmitDelete.addEventListener('click', submitConfirmDelete);

    const typedConfirmInp = document.getElementById('confirmDeleteTypedInput');
    if (typedConfirmInp) {
      typedConfirmInp.addEventListener('input', () => {
        if (ui.pendingConfirm && ui.pendingConfirm.requireDeleteWord && btnSubmitDelete) {
          btnSubmitDelete.disabled = typedConfirmInp.value.trim() !== 'DELETE';
        }
      });
    }

    // Habits Modal
    const btnOpenHabit = document.getElementById('btnOpenAddHabitModal');
    if (btnOpenHabit) btnOpenHabit.addEventListener('click', () => showModal('modalAddHabit'));

    const btnSubmitHabit = document.getElementById('btnSubmitAddHabit');
    if (btnSubmitHabit) btnSubmitHabit.addEventListener('click', submitAddHabit);

    const btnAddHabitRow = document.getElementById('btnAddHabitRow');
    if (btnAddHabitRow) btnAddHabitRow.addEventListener('click', () => addHabitRow());

    const initialHabitInp = document.querySelector('.habit-row-title');
    if (initialHabitInp) initialHabitInp.addEventListener('input', updateHabitRowsState);

    document.querySelectorAll('[data-freq-opt]').forEach(btn => {
      btn.addEventListener('click', () => setHabitFrequencyUI(btn.getAttribute('data-freq-opt')));
    });

    const habitFreq = document.getElementById('habitFrequencySelect');
    if (habitFreq) {
      habitFreq.addEventListener('change', e => setHabitFrequencyUI(e.target.value));
    }

    // Goals Modal
    const btnOpenGoal = document.getElementById('btnOpenAddGoalModal');
    if (btnOpenGoal) btnOpenGoal.addEventListener('click', () => showModal('modalAddGoal'));

    const btnSubmitGoal = document.getElementById('btnSubmitAddGoal');
    if (btnSubmitGoal) btnSubmitGoal.addEventListener('click', submitAddGoal);

    const goalPreset = document.getElementById('goalDurationPreset');
    if (goalPreset) {
      goalPreset.addEventListener('change', e => {
        const customGroup = document.getElementById('goalCustomDurationGroup');
        if (customGroup) customGroup.classList.toggle('is-hidden', e.target.value !== 'custom');
      });
    }

    // Calendar controls
    const btnPrevMonth = document.getElementById('btnCalPrevMonth');
    if (btnPrevMonth) {
      btnPrevMonth.addEventListener('click', () => {
        state.calendarMonth--;
        if (state.calendarMonth < 1) {
          state.calendarMonth = 12;
          state.calendarYear--;
        }
        renderCalendar();
      });
    }

    const btnNextMonth = document.getElementById('btnCalNextMonth');
    if (btnNextMonth) {
      btnNextMonth.addEventListener('click', () => {
        state.calendarMonth++;
        if (state.calendarMonth > 12) {
          state.calendarMonth = 1;
          state.calendarYear++;
        }
        renderCalendar();
      });
    }

    const btnCalToday = document.getElementById('btnCalToday');
    if (btnCalToday) {
      btnCalToday.addEventListener('click', () => {
        const today = parseYmd(state.todayDate) || new Date();
        state.calendarYear = today.getFullYear();
        state.calendarMonth = today.getMonth() + 1;
        renderCalendar(state.todayDate);
      });
    }

    const calGrid = document.getElementById('calendarCellsContainer');
    if (calGrid) calGrid.addEventListener('keydown', handleCalendarKeydown);

    // History filters
    const btnResetHistory = document.getElementById('btnResetHistoryFilter');
    if (btnResetHistory) {
      btnResetHistory.addEventListener('click', () => {
        const picker = document.getElementById('historyDateFilter');
        const statusSel = document.getElementById('historyStatusFilter');
        if (picker) picker.value = '';
        if (statusSel) statusSel.value = 'ALL';
        ui.historyStatusFilter = 'ALL';
        ui.historyVisibleLimit = 20;
        applyHistoryFilters();
      });
    }

    const historyFilter = document.getElementById('historyDateFilter');
    if (historyFilter) historyFilter.addEventListener('change', applyHistoryFilters);

    const historyStatusFilter = document.getElementById('historyStatusFilter');
    if (historyStatusFilter) {
      historyStatusFilter.addEventListener('change', e => {
        ui.historyStatusFilter = e.target.value;
        ui.historyVisibleLimit = 20;
        applyHistoryFilters();
      });
    }

    // Streaks badge filter chips
    document.querySelectorAll('[data-badge-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.badgeFilter = btn.getAttribute('data-badge-filter');
        document.querySelectorAll('[data-badge-filter]').forEach(b => {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderAchievements(state.achievements || []);
      });
    });

    // Notifications
    const btnReqNotif = document.getElementById('btnRequestBrowserNotif');
    if (btnReqNotif) btnReqNotif.addEventListener('click', requestBrowserNotificationPermission);

    const btnSaveNotif = document.getElementById('btnSaveNotifSettings');
    if (btnSaveNotif) btnSaveNotif.addEventListener('click', saveNotificationPreferences);

    const btnMarkAllRead = document.getElementById('btnMarkAllRead');
    if (btnMarkAllRead) btnMarkAllRead.addEventListener('click', markAllNotificationsRead);

    // Settings
    const tzSelect = document.getElementById('settingTimezoneSelect');
    if (tzSelect) tzSelect.addEventListener('change', updateTimezoneHint);

    document.querySelectorAll('[data-theme-choice]').forEach(card => {
      card.addEventListener('click', () => {
        applyTheme(card.getAttribute('data-theme-choice'));
      });
    });

    const themeSelect = document.getElementById('settingThemeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', e => applyTheme(e.target.value));
    }

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => {
        if (ui.themeMode === 'system') applyTheme('system');
      };
      if (media.addEventListener) media.addEventListener('change', handleSystemChange);
    }

    const btnSaveGen = document.getElementById('btnSaveGeneralSettings');
    if (btnSaveGen) btnSaveGen.addEventListener('click', saveGeneralSettings);

    // Sign out
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', performLogout);

    // Password visibility toggles
    document.querySelectorAll('.btn-pw-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('data-pw-target'));
        if (!target) return;
        const show = target.type === 'password';
        target.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });

    // Auth Modal Tabs & Forms
    const tabLogin = document.getElementById('btnTabLogin');
    const tabRegister = document.getElementById('btnTabRegister');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');

    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.addEventListener('click', () => {
        clearAuthErrors();
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        tabLogin.setAttribute('aria-selected', 'true');
        tabRegister.setAttribute('aria-selected', 'false');
        formLogin.classList.remove('is-hidden');
        formRegister.classList.add('is-hidden');
        document.getElementById('authModalTitle').textContent = 'Sign In to KEIZOKU';
      });

      tabRegister.addEventListener('click', () => {
        clearAuthErrors();
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.setAttribute('aria-selected', 'true');
        tabLogin.setAttribute('aria-selected', 'false');
        formLogin.classList.add('is-hidden');
        formRegister.classList.remove('is-hidden');
        document.getElementById('authModalTitle').textContent = 'Create KEIZOKU Account';
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', async e => {
        e.preventDefault();
        clearAuthErrors();
        const u = document.getElementById('loginUsername').value.trim();
        const p = document.getElementById('loginPassword').value;

        let valid = true;
        if (!u) { setFieldError('loginUsername', 'Username is required.'); valid = false; }
        if (!p) { setFieldError('loginPassword', 'Password is required.'); valid = false; }
        if (!valid) return;

        const submitBtn = document.getElementById('btnSubmitLogin');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing in...';
        }

        try {
          const res = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p })
          });
          state.token = res.token;
          localStorage.setItem('keizoku_token', state.token);
          localStorage.setItem('dayforge_token', state.token);
          state.user = res;
          document.body.classList.remove('unauthenticated');
          const authModal = document.getElementById('modalAuth');
          if (authModal) authModal.classList.remove('auth-fullscreen');
          showToast(`Welcome back, ${res.fullName}!`);
          updateUserUI();
          hideModal('modalAuth');
          await loadTodayChecklist();
        } catch (err) {
          showAuthErrorBanner(err.message || 'Invalid username or password.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
          }
        }
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', async e => {
        e.preventDefault();
        clearAuthErrors();
        const fullName = document.getElementById('regFullName').value.trim();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        let valid = true;
        if (!fullName) { setFieldError('regFullName', 'Full name is required.'); valid = false; }
        if (!username) { setFieldError('regUsername', 'Username is required.'); valid = false; }
        if (!email || !email.includes('@')) { setFieldError('regEmail', 'Enter a valid email address.'); valid = false; }
        if (!password || password.length < 6) { setFieldError('regPassword', 'Password must be at least 6 characters.'); valid = false; }
        if (!valid) return;

        const submitBtn = document.getElementById('btnSubmitRegister');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating account...';
        }

        try {
          const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
          const res = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ fullName, username, email, password, timezone: clientTz })
          });
          state.token = res.token;
          localStorage.setItem('keizoku_token', state.token);
          localStorage.setItem('dayforge_token', state.token);
          state.user = res;
          document.body.classList.remove('unauthenticated');
          const authModal = document.getElementById('modalAuth');
          if (authModal) authModal.classList.remove('auth-fullscreen');
          showToast(`Account created! Welcome, ${res.fullName}!`);
          updateUserUI();
          hideModal('modalAuth');
          await loadTodayChecklist();
        } catch (err) {
          showAuthErrorBanner(err.message || 'Could not create account.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
          }
        }
      });
    }
  }

  function performLogout() {
    localStorage.removeItem('keizoku_token');
    localStorage.removeItem('dayforge_token');
    state.token = '';
    state.user = null;
    showToast('Signed out');
    initAuth();
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  async function init() {
    applyTheme(ui.themeMode);

    if (localStorage.getItem('keizoku_sidebar_collapsed') === '1') {
      document.body.classList.add('sidebar-collapsed');
      const collapseBtn = document.getElementById('btnSidebarCollapse');
      if (collapseBtn) collapseBtn.setAttribute('aria-pressed', 'true');
    }

    bindEvents();
    await initAuth();
    if (state.token) {
      await loadTodayChecklist();
    }
  }

  // Exported Public API (strictly preserved)
  return {
    init,
    navigateTo,
    showModal,
    hideModal,
    filterTodayCategory,
    toggleItemStatus,
    openEditItemModal,
    openDeleteConfirmModal,
    reorderItem,
    toggleHabitActive,
    deleteHabit,
    deleteGoal,
    inspectCalendarDate,
    viewHistoricalDay,
    clearAllNotifications,
    exportReportCSV,
    exportReportJSON,
    exportFullBackup,
    resetAllUserData
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
