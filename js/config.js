// ===== CONFIG.JS - CONFIGURAZIONI E COSTANTI GLOBALI =====
// Dashboard RO - Modulo Configurazioni v2.0 - Performance Optimized

/* ===== MAPPATURE AGENTI E CATEGORIE ===== */
export const AGENT_MAPPING = {
    '1': 'Sig. Bacco',
    '2': 'Renato Bacco', 
    '3': 'Serena Padrono',
    '4': 'Luca De Gaetano',
    '5': 'Andrea Zara',
    '6': 'Mattia Arata',
    '7': 'Arrigo Bussinello',
    '8': 'Francesco',
    'P01': 'Terapeutico'
};

export const CATEGORY_MAPPING = {
    'P02': 'Benessere',
    'P03': 'Grandi impianti', 
    'P04': 'Privato',
    'P05': 'Top Class',
    'P06': 'Extra',
    'P07': 'Eccezionale',
    'P08': 'Residence',
    'P09': 'Assistenza'
};

/* ===== UTILITY MAPPATURE ===== */
export const MAPPING_UTILS = {
    // Converte codice agente in nome
    getAgentName(code) {
        if (!code) return 'Non specificato';
        
        // Se è già un nome (non un numero/codice), restituiscilo
        if (isNaN(code) && !code.startsWith('P') && !AGENT_MAPPING[code]) {
            return code;
        }
        
        return AGENT_MAPPING[code] || code;
    },
    
    // Converte nome agente in codice (per filtri)
    getAgentCode(name) {
        if (!name || name === 'Non specificato') return null;
        
        // Cerca il codice corrispondente al nome
        const entry = Object.entries(AGENT_MAPPING).find(([code, agentName]) => agentName === name);
        return entry ? entry[0] : name;
    },
    
    // Converte codice categoria in nome
    getCategoryName(code) {
        if (!code) return 'Non specificata';
        
        // Se è già un nome (non inizia con P), restituiscilo
        if (!code.startsWith('P') && !CATEGORY_MAPPING[code]) {
            return code;
        }
        
        return CATEGORY_MAPPING[code] || code;
    },
    
    // Converte nome categoria in codice (per filtri)
    getCategoryCode(name) {
        if (!name || name === 'Non specificata') return null;
        
        // Cerca il codice corrispondente al nome
        const entry = Object.entries(CATEGORY_MAPPING).find(([code, categoryName]) => categoryName === name);
        return entry ? entry[0] : name;
    }
};

/* ===== CONFIGURAZIONE APPLICAZIONE ===== */
export const CONFIG = {
    // File handling
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    SUPPORTED_FORMATS: ['.xlsx', '.xls'],
    
    // Chart colors - Vivaci per entrambi i temi
    CHART_COLORS: [
        '#4F7CFF',     // Blu brillante
        '#00E5A0',     // Verde acqua
        '#FFD700',     // Giallo oro
        '#FF6B9D',     // Rosa vivace
        '#9B59B6',     // Viola
        '#FF8C42',     // Arancione
        '#1ABC9C',     // Turchese
        '#E74C3C'      // Rosso
    ],
    
    CHART_BORDER_COLORS: [
        '#4F7CFF',
        '#00E5A0', 
        '#FFD700',
        '#FF6B9D',
        '#9B59B6',
        '#FF8C42',
        '#1ABC9C',
        '#E74C3C'
    ],
    
    // Theme settings
    THEME_STORAGE_KEY: 'dashboard_theme_preference',
    DEFAULT_THEME: 'light',
    
    // Performance settings
    BATCH_SIZE: 100, // Righe da processare per batch
    UPDATE_INTERVAL: 16, // 60fps
    DEBOUNCE_DELAY: 300,
    CHART_ANIMATION_DURATION: 1000,
    
    // Animation settings
    ANIMATION_DURATION: {
        FAST: 150,
        NORMAL: 300,
        SLOW: 500,
        CHART: 1000
    }
};

/* ===== STATO GLOBALE DELL'APPLICAZIONE ===== */
export const STATE = {
    // Dati principali
    roData: [],
    filteredData: [],
    
    // Filtri e vista
    currentTipoFilter: 'tutti',
    percRealizzazioneView: 'count',
    agentiView: 'count',
    temporaleView: 'month',
    categorieView: 'value',
    
    // Paginazione e ordinamento
    currentPage: 1,
    itemsPerPage: 50,
    sortColumn: null,
    sortDirection: 'asc',
    
    // Grafici
    charts: {},
    
    // Stato applicazione
    isLoading: false,
    hasData: false,
    filtersActive: 0,
    lastFileLoaded: null,
    currentTheme: CONFIG.DEFAULT_THEME,
    
    // Performance metrics
    performanceMetrics: {
        loadTime: 0,
        filterTime: 0,
        chartRenderTime: 0,
        charts: {}
    }
};

/* ===== CACHE PER PERFORMANCE ===== */
export const CACHE = {
    monthlyData: null,
    quarterlyData: null,
    weeklyData: null,
    agentData: null,
    lastUpdate: null,
    
    // Metodi cache
    clear() {
        this.monthlyData = null;
        this.quarterlyData = null;
        this.weeklyData = null;
        this.agentData = null;
        this.lastUpdate = null;
    },
    
    isValid() {
        return this.lastUpdate === STATE.filteredData.length;
    }
};

/* ===== ERROR TRACKING ===== */
export const ERROR_LOG = {
    fileErrors: [],
    processingErrors: [],
    chartErrors: [],
    
    // Metodi logging
    addFileError(fileName, error) {
        this.fileErrors.push({
            fileName,
            error: error.message,
            timestamp: Date.now()
        });
    },
    
    addProcessingError(error, row = null) {
        this.processingErrors.push({
            error: error.message,
            row,
            timestamp: Date.now()
        });
    },
    
    addChartError(chartId, error) {
        this.chartErrors.push({
            chartId,
            error: error.message,
            timestamp: Date.now(),
            stack: error.stack
        });
    },
    
    getRecentErrors(hours = 1) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return {
            file: this.fileErrors.filter(e => e.timestamp > cutoff),
            processing: this.processingErrors.filter(e => e.timestamp > cutoff),
            chart: this.chartErrors.filter(e => e.timestamp > cutoff)
        };
    }
};

/* ===== TIMEOUTS E INTERVALLI ===== */
export const TIMERS = {
    filterTimeout: null,
    searchTimeout: null,
    resizeTimeout: null,
    
    clearAll() {
        clearTimeout(this.filterTimeout);
        clearTimeout(this.searchTimeout);
        clearTimeout(this.resizeTimeout);
    }
};

/* ===== UTILITÀ DI CONFIGURAZIONE ===== */
export const CONFIG_UTILS = {
    // Ottieni colore tema corrente
    getThemeColor(property) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(property).trim();
    },
    
    // Verifica supporto funzionalità
    hasSupport: {
        webWorkers: typeof Worker !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        fileAPI: typeof FileReader !== 'undefined',
        performance: typeof performance !== 'undefined'
    },
    
    // Impostazioni responsive
    getBreakpoint() {
        const width = window.innerWidth;
        if (width >= 1400) return 'xl';
        if (width >= 1200) return 'lg';
        if (width >= 768) return 'md';
        if (width >= 480) return 'sm';
        return 'xs';
    },
    
    // Ottimizzazioni basate su device
    getOptimizations() {
        const breakpoint = this.getBreakpoint();
        return {
            animationDuration: breakpoint === 'xs' ? CONFIG.ANIMATION_DURATION.FAST : CONFIG.ANIMATION_DURATION.NORMAL,
            batchSize: breakpoint === 'xs' ? Math.floor(CONFIG.BATCH_SIZE / 2) : CONFIG.BATCH_SIZE,
            chartHeight: breakpoint === 'xs' ? 280 : 380
        };
    }
};

/* ===== EVENTI PERSONALIZZATI ===== */
export const EVENTS = {
    // Nomi eventi
    DATA_LOADED: 'dashboard:dataLoaded',
    DATA_FILTERED: 'dashboard:dataFiltered',
    CHART_UPDATED: 'dashboard:chartUpdated',
    THEME_CHANGED: 'dashboard:themeChanged',
    ERROR_OCCURRED: 'dashboard:errorOccurred',
    
    // Dispatcher eventi
    emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    },
    
    // Listener eventi
    on(eventName, callback) {
        document.addEventListener(eventName, callback);
        return () => document.removeEventListener(eventName, callback);
    }
};

/* ===== VALIDATORI ===== */
export const VALIDATORS = {
    // Valida file Excel
    isValidExcelFile(file) {
        if (!file) return false;
        
        const fileName = file.name.toLowerCase();
        const isValidFormat = CONFIG.SUPPORTED_FORMATS.some(format => 
            fileName.endsWith(format)
        );
        
        return isValidFormat && 
               file.size > 0 && 
               file.size <= CONFIG.MAX_FILE_SIZE;
    },
    
    // Valida record RO
    isValidRORecord(record) {
        return record && 
               record.RO_num && 
               record.RO_num.length >= 2 &&
               (record.Offerta_Valore || 0) >= 0 &&
               (record.Valore_Contratto || 0) >= 0 &&
               (record.Perc_realizzazione || 0) >= 0 &&
               (record.Perc_realizzazione || 0) <= 100;
    },
    
    // Valida configurazione tema
    isValidTheme(theme) {
        return theme === 'light' || theme === 'dark';
    }
};

/* ===== FORMATTATORI ===== */
export const FORMATTERS = {
    // Formatta valuta
    currency(value) {
        if (value === null || value === undefined || isNaN(value)) return '€0';
        
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    },
    
    // Formatta valuta abbreviata
    currencyShort(value) {
        if (!value || isNaN(value)) return '€0';
        
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M€';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(0) + 'k€';
        }
        return Math.round(value) + '€';
    },
    
    // Formatta numero
    number(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        return new Intl.NumberFormat('it-IT').format(Math.round(value));
    },
    
    // Formatta percentuale
    percentage(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        return `${value.toFixed(decimals)}%`;
    },
    
    // Formatta data
    date(dateString) {
        if (!dateString) return '-';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    },
    
    // Formatta dimensione file
    fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

/* ===== EXPORT CONFIGURAZIONE COMPLETA ===== */
export default {
    CONFIG,
    STATE,
    CACHE,
    ERROR_LOG,
    TIMERS,
    CONFIG_UTILS,
    EVENTS,
    VALIDATORS,
    FORMATTERS,
    AGENT_MAPPING,
    CATEGORY_MAPPING,
    MAPPING_UTILS
};