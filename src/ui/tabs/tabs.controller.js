export class TabsController {
  constructor() {
    this.tabs = new Map();
    this.activeTab = null;
    this.container = null;
    this.buttonsContainer = null;
    this.contentContainer = null;
    this.init();
  }

  init() {
    this.findContainers();
    this.bindGlobalEvents();
    this.loadPersistedState();
  }

  findContainers() {
    // New layout support
    this.container = document.querySelector('.tab-system') || document.body;
    this.buttonsContainer = document.querySelector('#app-sidebar nav') || this.container.querySelector('.tab-buttons-container');
    this.contentContainer = document.querySelector('#main-container') || this.container.querySelector('.tab-content-container');
    
    if (!this.buttonsContainer || !this.contentContainer) {
      console.warn('Tabs: Some containers not found', { 
        buttons: !!this.buttonsContainer, 
        content: !!this.contentContainer 
      });
    }
  }

  registerTab(id, config = {}) {
    this.tabs.set(id, {
      id,
      icon: config.icon || '',
      label: config.label || id,
      badge: 0,
      badgeType: 'count',
      hasChanges: false,
      dataLoaded: false,
      onLoad: config.onLoad,
      onShow: config.onShow,
      onHide: config.onHide,
      hideNav: !!config.hideNav
    });
    
    this.renderButtons();
    
    // Auto-select first tab if none active
    if (!this.activeTab && this.contentContainer?.querySelector(`#content-${id}`)) {
      this.showTab(id);
    }
  }

  async showTab(tabId, options = {}) {
    const tab = this.tabs.get(tabId);
    if (!tab || tabId === this.activeTab) return false;

    console.debug(`Tabs: Switching to ${tabId}`);

    // Lazy load data
    if (!tab.dataLoaded && typeof tab.onLoad === 'function') {
      this.contentContainer.querySelector('.tab-content.active')?.classList.add('tab-loading');
      await tab.onLoad(options);
      tab.dataLoaded = true;
    }

    // Hide current tab
    if (this.activeTab && typeof this.tabs.get(this.activeTab)?.onHide === 'function') {
      this.tabs.get(this.activeTab).onHide();
    }

    // Show new tab
    this.animateTabTransition(tabId);
    this.updateActiveState(tabId);
    
    // Callbacks
    if (typeof tab.onShow === 'function') {
      tab.onShow(options);
    }

    this.saveState();
    return true;
  }

  updateActiveState(tabId) {
    // Update sidebar items (new layout)
    document.querySelectorAll('#app-sidebar .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Update mobile bottom nav items
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Update content (supports both .tab-content and .view-section)
    const contents = this.contentContainer?.querySelectorAll('.tab-content, .view-section') || [];
    contents.forEach(content => {
      content.classList.toggle('active', content.id === `content-${tabId}`);
      content.classList.remove('tab-loading');
    });

    this.activeTab = tabId;
  }

  renderButtons() {
    if (!this.buttonsContainer) return;
    
    this.buttonsContainer.innerHTML = Array.from(this.tabs.values())
      .filter(tab => !tab.hideNav)
      .map(tab => this.createButtonHTML(tab))
      .join('');

    this.bindButtonEvents();
  }

  createButtonHTML(tab) {
    const isSidebar = this.buttonsContainer?.id === 'app-sidebar-nav' || this.buttonsContainer?.closest('#app-sidebar');
    
    if (isSidebar) {
      return `
        <div class="nav-item ${tab.id === this.activeTab ? 'active' : ''}" 
             data-tab="${tab.id}" 
             onclick="switchTab('${tab.id}')">            
            <span class="nav-icon">${tab.icon}</span>
            <span class="nav-label">${tab.label}</span>
            ${tab.badge > 0 ? `<span class="nav-badge">${tab.badge}</span>` : ''}
        </div>
      `;
    }

    const badgeHTML = tab.badge > 0 
      ? `<span class="tab-badge ${tab.badgeType}">${tab.badge > 99 ? '99+' : tab.badge}</span>`
      : '';
    
    const dirtyIndicator = tab.hasChanges ? '<span class="ml-1 animate-pulse">🔄</span>' : '';
    
    return `
      <button 
        class="tab-btn ${tab.id === this.activeTab ? 'active' : ''}"
        data-tab="${tab.id}"
        aria-label="${tab.label} (${tab.badge > 0 ? tab.badge + ' éléments nouveaux' : ''})"
        aria-selected="${tab.id === this.activeTab}"
        role="tab"
        tabindex="0"
      >
        ${tab.icon} ${tab.label}${dirtyIndicator}${badgeHTML}
      </button>
    `;
  }

  // ===== GESTION DES BADGES =====
  updateBadge(tabId, count = 1, type = 'count') {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.badge = Math.max(0, count);
      tab.badgeType = type;
      this.renderButtons();
    }
  }

  clearBadge(tabId) {
    this.updateBadge(tabId, 0);
  }

  markDirty(tabId, dirty = true) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.hasChanges = dirty;
      if (dirty) {
        tab.badgeType = 'dirty';
        tab.badge = tab.badge || 1;
      }
      this.renderButtons();
    }
  }

  // ===== MISE À JOUR =====
  updateTab(tabId, updates = {}) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    if (updates.label) tab.label = updates.label;
    if (updates.icon) tab.icon = updates.icon;
    
    // Refresh buttons
    this.renderButtons();
  }

  // Alias pour compatibilité
  activateTab(tabId, options = {}) {
    return this.showTab(tabId, options);
  }

  // ===== ÉVÉNEMENTS =====
  bindGlobalEvents() {
    // Delegation pour les boutons
    this.container?.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) {
        e.preventDefault();
        this.showTab(btn.dataset.tab);
      }
    });

    // Keyboard navigation
    this.container?.addEventListener('keydown', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.showTab(btn.dataset.tab);
      }
    });

    // Resize observer pour responsive
    window.addEventListener('resize', () => this.renderButtons());
  }

  bindButtonEvents() {
    // Focus management
    this.buttonsContainer?.querySelectorAll('.tab-btn').forEach((btn, index) => {
      btn.addEventListener('focus', () => {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });
  }

  // ===== ANIMATIONS =====
  animateTabTransition(tabId) {
    const oldContent = this.contentContainer?.querySelector('.tab-content.active, .view-section.active');
    const newContent = document.getElementById(`content-${tabId}`);
    
    if (oldContent && oldContent !== newContent) {
      oldContent.classList.remove('active');
    }
    
    // Force reflow
    newContent?.offsetHeight;
    
    setTimeout(() => {
      if (newContent) {
        newContent.classList.add('active');
      }
    }, 100);
  }

  // ===== PERSISTANCE =====
  saveState() {
    if (this.activeTab) {
      localStorage.setItem('app:tabs:activeTab', this.activeTab);
    }
  }

  loadPersistedState() {
    const saved = localStorage.getItem('app:tabs:activeTab');
    if (saved && this.tabs.has(saved)) {
      // Delay pour s'assurer que les contenus sont chargés
      setTimeout(() => this.showTab(saved), 100);
    }
  }

  // ===== UTILS =====
  getActiveTab() {
    return this.activeTab;
  }

  getTabData(tabId) {
    return this.tabs.get(tabId);
  }

  destroy() {
    this.tabs.clear();
    this.activeTab = null;
  }
}

// Singleton
export const tabs = new TabsController();
