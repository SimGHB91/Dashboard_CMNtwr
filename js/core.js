// ===== CORE.JS - INIZIALIZZAZIONE E FUNZIONALITÀ BASE =====
// Dashboard RO - Modulo Core v2.0 - Performance Optimized


import { 
    CONFIG, 
    STATE, 
    CACHE, 
    ERROR_LOG, 
    TIMERS, 
    CONFIG_UTILS, 
    EVENTS, 
    VALIDATORS 
} from './config.js';

/* ===== MODULI LAZY LOADING ===== */
const MODULES = {
    dataEngine: null,
    filterEngine: null,
    dashboardEngine: null,
    chartEngine: null,
    tableEngine: null,
    exportEngine: null
};

/* ===== INIZIALIZZAZIONE AUTOMATICA ===== */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM già caricato
    setTimeout(initApp, 0);
}

/* ===== INIZIALIZZAZIONE PRINCIPALE ===== */
export async function initApp() {
    try {
        console.log('🚀 Inizializzazione Dashboard RO v2.0 - Modular');
        
        // 1. Setup tema PRIMA di tutto
        initTheme();
        
        // 2. Setup base immediato
        setupBasicUI();
        setupErrorHandling();
        setupPerformanceMonitoring();
        
        // 3. Setup event listeners base
        setupCoreEventListeners();
        
        // 4. Setup responsive handling
        setupResponsiveHandling();
        
        // 5. Pre-carica Chart.js se disponibile
        if (typeof Chart !== 'undefined') {
            setupChartDefaults();
        }
        
        console.log('✅ Core inizializzato con successo');
        EVENTS.emit(EVENTS.APP_INITIALIZED);
        
        showToast('Dashboard caricata', 'Dashboard RO pronta all\'uso', 'success');
        
        // VERIFICA FINALE TEMA
        setTimeout(() => {
            console.log('🔍 Verifica finale tema...');
            debugTheme();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Errore inizializzazione core:', error);
        ERROR_LOG.addProcessingError(error);
        showToast('Errore', 'Errore durante l\'inizializzazione', 'error');
    }
}


/* ===== LAZY LOADING MODULI ===== */
export async function loadModule(moduleName) {
    if (MODULES[moduleName]) {
        return MODULES[moduleName];
    }
    
    try {
        console.log(`📦 Caricamento modulo: ${moduleName}`);
        const startTime = performance.now();
        
        let module;
        switch (moduleName) {
            case 'dataEngine':
                module = await import('./dataEngine.js');
                break;
            case 'filterEngine':
                module = await import('./filterEngine.js');
                break;
            case 'dashboardEngine':
                module = await import('./dashboardEngine.js');
                break;
            case 'chartEngine':
                module = await import('./chartEngine.js');
                break;
            case 'tableEngine':
                module = await import('./tableEngine.js');
                break;
            case 'exportEngine':
                module = await import('./exportEngine.js');
                break;
            default:
                throw new Error(`Modulo sconosciuto: ${moduleName}`);
        }
        
        MODULES[moduleName] = module;
        
        const loadTime = performance.now() - startTime;
        console.log(`✅ Modulo ${moduleName} caricato in ${loadTime.toFixed(2)}ms`);
        
        EVENTS.emit('module:loaded', { moduleName, loadTime });
        return module;
        
    } catch (error) {
        console.error(`❌ Errore caricamento modulo ${moduleName}:`, error);
        ERROR_LOG.addProcessingError(error);
        throw error;
    }
}

/* ===== GESTIONE TEMA ===== */
export function initTheme() {
    console.log('🎨 Inizializzazione sistema tema...');
    
    // Recupera tema salvato o usa quello di sistema
    const savedTheme = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    STATE.currentTheme = savedTheme || systemTheme || CONFIG.DEFAULT_THEME;
    
    console.log(`🎨 Tema iniziale: ${STATE.currentTheme}`);
    
    // APPLICA IMMEDIATAMENTE il tema per evitare flash
    applyTheme(STATE.currentTheme);
    
    // Ascolta cambiamenti tema di sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(CONFIG.THEME_STORAGE_KEY)) {
            STATE.currentTheme = e.matches ? 'dark' : 'light';
            applyTheme(STATE.currentTheme);
        }
    });
}

export function toggleTheme() {
    const newTheme = STATE.currentTheme === 'light' ? 'dark' : 'light';
    
    console.log(`🔄 Toggle tema: ${STATE.currentTheme} → ${newTheme}`);
    
    // Animazione di transizione smooth
    document.body.style.transition = 'all 0.4s ease-in-out';
    
    STATE.currentTheme = newTheme;
    applyTheme(newTheme);
    
    // Salva preferenza
    localStorage.setItem(CONFIG.THEME_STORAGE_KEY, newTheme);
    
    // Aggiorna Chart.js se disponibili
    updateChartsTheme();
    
    EVENTS.emit(EVENTS.THEME_CHANGED, { theme: newTheme });
    showToast('Tema cambiato', `Modalità ${newTheme === 'dark' ? 'scura' : 'chiara'} attivata`, 'info');
    
    // Rimuovi transizione dopo l'animazione
    setTimeout(() => {
        document.body.style.transition = '';
    }, 400);
}

export function applyTheme(theme) {
    if (!VALIDATORS.isValidTheme(theme)) {
        console.warn('⚠️ Tema non valido:', theme);
        return;
    }
    
    console.log(`🎨 Applicazione tema: ${theme}`);
    
    const body = document.body;
    
    // RIMUOVI TUTTE le classi tema esistenti
    body.classList.remove('light-theme', 'dark-theme');
    
    // APPLICA il nuovo tema
    body.classList.add(`${theme}-theme`);
    body.setAttribute('data-theme', theme);
    
    // Aggiorna icona toggle
    updateThemeToggleIcon(theme);
    
    // Aggiorna meta theme-color per mobile
    updateMetaThemeColor(theme);
    
    console.log(`✅ Tema ${theme} applicato. Classi body:`, body.className);
}

function updateThemeToggleIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    
    if (themeIcon) {
        // Icone più chiare per il toggle
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Modalità chiara' : 'Modalità scura';
        
        console.log(`🔄 Icona tema aggiornata: ${themeIcon.textContent}`);
    } else {
        console.warn('⚠️ Elemento theme toggle non trovato');
    }
}

function updateMetaThemeColor(theme) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }
    
    const themeColors = {
        light: '#667eea',
        dark: '#1a1a1a'
    };
    
    metaThemeColor.content = themeColors[theme];
}

async function updateChartsTheme() {
    // Carica chart engine se necessario
    if (STATE.hasData && Object.keys(STATE.charts).length > 0) {
        try {
            const chartEngine = await loadModule('chartEngine');
            if (chartEngine && chartEngine.updateChartsTheme) {
                chartEngine.updateChartsTheme();
                console.log('📊 Tema grafici aggiornato');
            }
        } catch (error) {
            console.warn('⚠️ Impossibile aggiornare tema grafici:', error);
        }
    }
}

/* ===== DEBUG THEME HELPER ===== */
export function debugTheme() {
    console.log('🔍 DEBUG TEMA:');
    console.log('- Tema corrente:', STATE.currentTheme);
    console.log('- Classi body:', document.body.className);
    console.log('- Attributo data-theme:', document.body.getAttribute('data-theme'));
    console.log('- localStorage tema:', localStorage.getItem(CONFIG.THEME_STORAGE_KEY));
    console.log('- Sistema preferisce dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Test colori CSS
    const testElement = document.createElement('div');
    testElement.style.color = 'var(--text-primary)';
    testElement.style.background = 'var(--bg-card)';
    document.body.appendChild(testElement);
    
    const computedStyle = getComputedStyle(testElement);
    console.log('- Colore testo calcolato:', computedStyle.color);
    console.log('- Colore sfondo calcolato:', computedStyle.backgroundColor);
    
    document.body.removeChild(testElement);
}

/* ===== SETUP UI BASE ===== */
async function setupBasicUI() {
    // Setup upload area - CARICA SEMPRE dataEngine per drag & drop
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        try {
            // Pre-carica dataEngine per drag & drop
            console.log('📁 Pre-caricamento dataEngine per upload...');
            const dataEngine = await loadModule('dataEngine');
            
            // Setup completo file upload
            dataEngine.setupFileUpload();
            
            console.log('✅ DataEngine caricato e configurato');
        } catch (error) {
            console.error('❌ Errore setup upload:', error);
            
            // Fallback senza dataEngine
            uploadArea.addEventListener('click', () => {
                document.getElementById('fileInput')?.click();
            });
        }
    }
    
    // PRE-CARICA CHARTENGINE SE CHART.JS È DISPONIBILE
    if (typeof Chart !== 'undefined') {
        try {
            console.log('📊 Pre-caricamento chartEngine per grafici...');
            await loadModule('chartEngine');
            console.log('✅ ChartEngine caricato e pronto');
        } catch (error) {
            console.error('❌ Errore caricamento chartEngine:', error);
        }
    } else {
        console.warn('⚠️ Chart.js non disponibile - grafici disabilitati');
    }
    
    // Setup reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetDashboard);
    }
    
    // Setup fullscreen button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Setup theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Rimuovi eventuali listener esistenti
        themeToggle.replaceWith(themeToggle.cloneNode(true));
        const newThemeToggle = document.getElementById('themeToggle');
        
        newThemeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Click sul theme toggle');
            toggleTheme();
        });
        
        console.log('✅ Theme toggle configurato');
    } else {
        console.warn('⚠️ Theme toggle button non trovato');
    }
}

/* ===== EVENT LISTENERS CORE ===== */
function setupCoreEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Window events
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('resize', debounce(handleResize, 250));
    
    // Visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + shortcuts
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                exportData();
                break;
            case 'r':
                e.preventDefault();
                resetDashboard();
                break;
            case 'd':
                e.preventDefault();
                toggleTheme();
                break;
        }
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
}

function handleResize() {
    // Aggiorna charts se presenti
    if (Object.keys(STATE.charts).length > 0) {
        Object.values(STATE.charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }
    
    // Emit evento resize
    EVENTS.emit('dashboard:resized', { 
        breakpoint: CONFIG_UTILS.getBreakpoint(),
        optimizations: CONFIG_UTILS.getOptimizations()
    });
}

function handleVisibilityChange() {
    if (document.hidden) {
        // Pausa animazioni quando tab non visibile
        TIMERS.clearAll();
    } else {
        // Riprendi operazioni quando tab diventa visibile
        if (STATE.hasData) {
            EVENTS.emit('dashboard:visible');
        }
    }
}

/* ===== PERFORMANCE MONITORING ===== */
function setupPerformanceMonitoring() {
    if (!CONFIG_UTILS.hasSupport.performance) return;
    
    try {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.entryType === 'measure') {
                    console.log(`📊 Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    
                    // Log operazioni lente
                    if (entry.duration > 1000) {
                        console.warn(`⚠️ Operazione lenta: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
                    }
                    
                    // Salva metriche
                    if (entry.name.includes('filter')) {
                        STATE.performanceMetrics.filterTime = entry.duration;
                    } else if (entry.name.includes('chart')) {
                        STATE.performanceMetrics.chartRenderTime = entry.duration;
                    } else if (entry.name.includes('load')) {
                        STATE.performanceMetrics.loadTime = entry.duration;
                    }
                }
            });
        });
        
        observer.observe({ entryTypes: ['measure'] });
    } catch (e) {
        console.warn('Performance Observer non supportato');
    }
}

/* ===== ERROR HANDLING GLOBALE ===== */
function setupErrorHandling() {
    window.addEventListener('error', function(event) {
        console.error('🚨 Dashboard Error:', event.error);
        ERROR_LOG.addProcessingError(event.error);
        showToast('Errore', 'Si è verificato un errore inaspettato', 'error');
    });

    window.addEventListener('unhandledrejection', function(event) {
        console.error('🚨 Unhandled Promise Rejection:', event.reason);
        ERROR_LOG.addProcessingError(new Error(event.reason?.message || 'Promise rejection'));
        showToast('Errore', 'Errore durante l\'elaborazione dei dati', 'error');
    });
}

/* ===== CHART.JS SETUP ===== */
function setupChartDefaults() {
    if (typeof Chart === 'undefined') return;
    
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.color = CONFIG_UTILS.getThemeColor('--text-secondary');
}

/* ===== RESPONSIVE HANDLING ===== */
function setupResponsiveHandling() {
    // Listener per breakpoint changes
    const mediaQueries = {
        xs: window.matchMedia('(max-width: 479px)'),
        sm: window.matchMedia('(min-width: 480px) and (max-width: 767px)'),
        md: window.matchMedia('(min-width: 768px) and (max-width: 1199px)'),
        lg: window.matchMedia('(min-width: 1200px) and (max-width: 1399px)'),
        xl: window.matchMedia('(min-width: 1400px)')
    };
    
    Object.entries(mediaQueries).forEach(([breakpoint, mq]) => {
        mq.addEventListener('change', (e) => {
            if (e.matches) {
                handleBreakpointChange(breakpoint);
            }
        });
    });
}

function handleBreakpointChange(breakpoint) {
    console.log(`📱 Breakpoint changed: ${breakpoint}`);
    
    const optimizations = CONFIG_UTILS.getOptimizations();
    
    // Aggiorna configurazioni basate su breakpoint
    CONFIG.ANIMATION_DURATION.NORMAL = optimizations.animationDuration;
    CONFIG.BATCH_SIZE = optimizations.batchSize;
    
    EVENTS.emit('breakpoint:changed', { breakpoint, optimizations });
}

/* ===== UTILITY FUNCTIONS ===== */
export function resetDashboard() {
    const confirmation = confirm(
        'Sei sicuro di voler resettare completamente la dashboard?\n\n' +
        'Tutti i dati caricati e i filtri verranno persi.\n' +
        'Questa operazione non può essere annullata.'
    );
    
    if (!confirmation) return;
    
    console.log('🔄 Reset completo dashboard...');
    
    try {
        // Reset dati
        STATE.roData = [];
        STATE.filteredData = [];
        STATE.currentPage = 1;
        STATE.sortColumn = null;
        STATE.sortDirection = 'asc';
        STATE.hasData = false;
        STATE.isLoading = false;
        STATE.filtersActive = 0;
        
        // Clear cache
        CACHE.clear();
        
        // Clear timers
        TIMERS.clearAll();
        
        // Distruggi grafici
        Object.values(STATE.charts).forEach(chart => {
            if (chart && chart.destroy) {
                try {
                    chart.destroy();
                } catch (e) {
                    console.warn('Errore distruzione grafico:', e);
                }
            }
        });
        STATE.charts = {};
        
        // Reset UI
        const noDataMessage = document.getElementById('noDataMessage');
        const dashboardContent = document.getElementById('dashboardContent');
        
        if (noDataMessage) noDataMessage.style.display = 'block';
        if (dashboardContent) dashboardContent.style.display = 'none';
        
        showToast('Reset completato', 'Dashboard reimpostata con successo', 'success');
        EVENTS.emit('dashboard:reset');
        
    } catch (error) {
        console.error('❌ Errore durante reset:', error);
        ERROR_LOG.addProcessingError(error);
        showToast('Errore', 'Errore durante il reset della dashboard', 'error');
    }
}

export function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            showToast('Fullscreen', 'Modalità schermo intero attivata', 'info');
        }).catch(err => {
            console.warn('Errore fullscreen:', err);
            showToast('Errore', 'Impossibile attivare modalità schermo intero', 'error');
        });
    } else {
        document.exitFullscreen().then(() => {
            showToast('Fullscreen', 'Modalità schermo intero disattivata', 'info');
        });
    }
}

async function exportData() {
    try {
        const exportEngine = await loadModule('exportEngine');
        await exportEngine.exportData();
    } catch (error) {
        console.error('Errore export:', error);
        showToast('Errore', 'Impossibile esportare i dati', 'error');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    });
}

/* ===== TOAST NOTIFICATION SYSTEM ===== */
export function showToast(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('⚠️ Toast container non trovato');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const toastId = `toast-${Date.now()}`;
    toast.id = toastId;
    
    toast.innerHTML = `
        <div class="toast-header">
            <div class="toast-title">${escapeHtml(title)}</div>
            <button class="toast-close" onclick="window.DashboardRO.closeToast('${toastId}')">&times;</button>
        </div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <div class="toast-progress ${type}"></div>
    `;
    
    container.appendChild(toast);
    
    // Animazione entrata
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    setTimeout(() => {
        closeToast(toastId);
    }, duration);
    
    // Limite massimo toast simultanei
    const maxToasts = 5;
    const allToasts = container.querySelectorAll('.toast');
    if (allToasts.length > maxToasts) {
        closeToast(allToasts[0].id);
    }
}

export function closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    
    toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/* ===== UTILITY FUNCTIONS ===== */
export function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanup() {
    TIMERS.clearAll();
    
    // Cleanup charts
    Object.values(STATE.charts).forEach(chart => {
        if (chart && chart.destroy) {
            try {
                chart.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });
}

/* ===== GLOBAL NAMESPACE SETUP ===== */
if (typeof window !== 'undefined') {
    window.DashboardRO = {
        // Core functions
        initApp,
        loadModule,
        toggleTheme,
        resetDashboard,
        showToast,
        closeToast,
        
        // Debug functions
        debugTheme,
        applyTheme,
        
        // State access
        getState: () => STATE,
        getConfig: () => CONFIG,
        getCache: () => CACHE,
        
        // Utilities
        escapeHtml,
        debounce,
        sleep
    };
    
    // GLOBAL THEME TOGGLE per test
    window.toggleTheme = toggleTheme;
    window.debugTheme = debugTheme;
}