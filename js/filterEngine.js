// ===== FILTERENGINE.JS - SISTEMA FILTRI E RICERCA =====
// Dashboard RO - Modulo Filter Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    CACHE, 
    TIMERS, 
    EVENTS, 
    FORMATTERS,
    MAPPING_UTILS
} from './config.js';

import { showToast, debounce, loadModule } from './core.js';
import { isROCommerciale, isRONormale } from './dataEngine.js';

/* ===== INIZIALIZZAZIONE FILTRI ===== */
export async function initializeFilters() {
    if (STATE.roData.length === 0) return;

    console.log('🔧 Inizializzazione filtri con mappatura agenti/categorie...');
    performance.mark('filters-init-start');
    
    const validData = STATE.roData.filter(ro => ro.RO_data);
    
    // Estrai valori unici con conteggi - USA LE FUNZIONI AGGIORNATE
    const filterData = {
        mesi: extractMonthsData(validData),
        nazioni: extractUniqueValues(STATE.roData, 'Nazione', ['Non specificata', '-']),
        agenti: extractAgentsData(STATE.roData), // <-- FUNZIONE AGGIORNATA
        esiti: extractUniqueValues(STATE.roData, 'Offerta_Esito', ['-']),
        percentuali: extractPercentualiData(STATE.roData),
        categorie: extractCategoriesData(STATE.roData) // <-- FUNZIONE AGGIORNATA
    };

    // Popola select in parallelo
    await Promise.all([
        populateSelect('filterMese', filterData.mesi),
        populateSelect('filterNazione', filterData.nazioni),
        populateSelect('filterAgente', filterData.agenti), // <-- AGGIORNATO
        populateSelect('filterEsito', filterData.esiti),
        populateSelect('filterPercentuale', filterData.percentuali)
        // Se hai un filtro categoria: populateSelect('filterCategoria', filterData.categorie)
    ]);
    
    // Imposta range date
    setDateRange(validData);
    
    // Setup event listeners
    setupFilterEventListeners();
    
    // Applica filtri iniziali
    applyFilters();
    
    performance.mark('filters-init-end');
    performance.measure('filters-init-duration', 'filters-init-start', 'filters-init-end');
    
    console.log('✅ Filtri inizializzati con mappatura agenti/categorie');
}

/* ===== SETUP EVENT LISTENERS ===== */
function setupFilterEventListeners() {
    console.log('🎧 Setup filtri event listeners...');
    
    // Filtri dropdown con debouncing
    const filterElements = [
        'filterMese', 'filterNazione', 'filterAgente', 'filterEsito', 
        'filterPercentuale', 'filterDataDa', 'filterDataA', 
        'filterValueMin', 'filterValueMax'
    ];
    
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', debouncedApplyFilters);
            element.addEventListener('input', debouncedApplyFilters);
        }
    });

    // Ricerca globale con debouncing
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', debouncedGlobalSearch);
    }

    // Toggle tipo RO
    document.querySelectorAll('.tipo-ro-toggle button').forEach(button => {
        button.addEventListener('click', function() {
            changeTipoFilter(this.dataset.tipo);
        });
    });
    
    console.log('✅ Event listeners filtri configurati');
}

/* ===== DEBOUNCED FUNCTIONS ===== */
const debouncedApplyFilters = debounce(() => {
    applyFilters();
}, CONFIG.DEBOUNCE_DELAY);

const debouncedGlobalSearch = debounce(() => {
    handleGlobalSearch();
}, CONFIG.DEBOUNCE_DELAY);

/* ===== ESTRAZIONE DATI PER FILTRI CON MAPPATURA ===== */
function extractMonthsData(validData) {
    const monthsCount = {};
    
    validData.forEach(ro => {
        const month = ro.RO_data.substring(0, 7);
        monthsCount[month] = (monthsCount[month] || 0) + 1;
    });
    
    return Object.entries(monthsCount)
        .sort(([a], [b]) => b.localeCompare(a)) // Ordine decrescente
        .map(([month, count]) => ({
            value: month,
            text: `${formatMonth(month)} (${count})`,
            count: count
        }));
}

function extractUniqueValues(data, field, excludeValues = []) {
    const valuesCount = {};
    
    data.forEach(ro => {
        const value = ro[field];
        if (value && !excludeValues.includes(value)) {
            valuesCount[value] = (valuesCount[value] || 0) + 1;
        }
    });
    
    return Object.entries(valuesCount)
        .sort(([,a], [,b]) => b - a) // Ordina per count decrescente
        .map(([value, count]) => ({
            value: value,
            text: `${value} (${count})`,
            count: count
        }));
}

// NUOVA FUNZIONE: Estrazione agenti con mappatura
function extractAgentsData(data) {
    const agentsCount = {};
    
    data.forEach(ro => {
        // Usa il nome dell'agente (già convertito da MAPPING_UTILS)
        const agentName = ro.Agente_nome;
        if (agentName && agentName !== 'Non specificato') {
            agentsCount[agentName] = (agentsCount[agentName] || 0) + 1;
        }
    });
    
    return Object.entries(agentsCount)
        .sort(([,a], [,b]) => b - a) // Ordina per count decrescente
        .map(([name, count]) => ({
            value: name, // Usa il nome per il valore
            text: `${name} (${count})`,
            count: count
        }));
}

// NUOVA FUNZIONE: Estrazione categorie con mappatura
function extractCategoriesData(data) {
    const categoriesCount = {};
    
    data.forEach(ro => {
        // Usa il nome della categoria (già convertito da MAPPING_UTILS)
        const categoryName = ro.Offerta_Categoria;
        if (categoryName && categoryName !== 'Non specificata') {
            categoriesCount[categoryName] = (categoriesCount[categoryName] || 0) + 1;
        }
    });
    
    return Object.entries(categoriesCount)
        .sort(([,a], [,b]) => b - a) // Ordina per count decrescente
        .map(([name, count]) => ({
            value: name, // Usa il nome per il valore
            text: `${name} (${count})`,
            count: count
        }));
}

function extractPercentualiData(data) {
    const percCount = {};
    
    data.forEach(ro => {
        const perc = ro.Perc_realizzazione || 0;
        
        // Raggruppa per livelli
        let level;
        if (perc >= 90) level = '90% - Quasi Certa';
        else if (perc >= 60) level = '60% - Probabile';  
        else if (perc >= 30) level = '30% - Possibile';
        else if (perc >= 10) level = '10% - Bassa';
        else level = '0% - Non Specificata';
        
        percCount[level] = (percCount[level] || 0) + 1;
    });
    
    return Object.entries(percCount)
        .sort(([a], [b]) => {
            // Ordina per probabilità decrescente
            const orderMap = {
                '90% - Quasi Certa': 4,
                '60% - Probabile': 3,
                '30% - Possibile': 2,
                '10% - Bassa': 1,
                '0% - Non Specificata': 0
            };
            return (orderMap[b] || 0) - (orderMap[a] || 0);
        })
        .map(([level, count]) => ({
            value: level,
            text: `${level} (${count})`,
            count: count
        }));
}

function setDateRange(validData) {
    if (validData.length === 0) return;
    
    const dates = validData.map(ro => ro.RO_data).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    const filterDataDa = document.getElementById('filterDataDa');
    const filterDataA = document.getElementById('filterDataA');
    
    if (filterDataDa) {
        filterDataDa.min = minDate;
        filterDataDa.max = maxDate;
    }
    if (filterDataA) {
        filterDataA.min = minDate;
        filterDataA.max = maxDate;
    }
    
    console.log(`📅 Range date: ${minDate} → ${maxDate}`);
}

/* ===== POPOLAZIONE SELECT ===== */
function populateSelect(selectId, options) {
    return new Promise(resolve => {
        const select = document.getElementById(selectId);
        if (!select) {
            resolve();
            return;
        }
        
        // Mantieni prima opzione (Tutti)
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }
        
        // Aggiungi nuove opzioni
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            opt.dataset.count = option.count;
            select.appendChild(opt);
        });
        
        resolve();
    });
}

/* ===== APPLICAZIONE FILTRI PRINCIPALE ===== */
export function applyFilters() {
    if (STATE.roData.length === 0) return;
    
    performance.mark('filters-start');
    
    // Ottieni valori filtri
    const filters = getFilterValues();
    
    // Applica filtri
    STATE.filteredData = STATE.roData.filter(ro => applyFilterToRecord(ro, filters));
    
    performance.mark('filters-end');
    performance.measure('filters-duration', 'filters-start', 'filters-end');
    
    console.log(`🔍 Filtri applicati: ${STATE.filteredData.length}/${STATE.roData.length} record`);
    
    // Aggiorna UI
    updateActiveFiltersCount();
    updateTypeToggleCounts();
    resetPagination();
    
    // Notifica altri moduli
    EVENTS.emit(EVENTS.DATA_FILTERED, { 
        filteredCount: STATE.filteredData.length,
        totalCount: STATE.roData.length,
        filters: filters
    });
    
    // Aggiorna dashboard e tabelle
    updateDependentModules();
}

async function updateDependentModules() {
    try {
        // Aggiorna dashboard
        const dashboardEngine = await loadModule('dashboardEngine');
        if (dashboardEngine) {
            dashboardEngine.updateDashboard();
        }
        
        // Aggiorna tabella se visibile
        const tableSection = document.getElementById('dataTableSection');
        if (tableSection && tableSection.style.display !== 'none') {
            const tableEngine = await loadModule('tableEngine');
            if (tableEngine) {
                tableEngine.updateDataTable();
            }
        }
    } catch (error) {
        console.warn('⚠️ Errore aggiornamento moduli dipendenti:', error);
    }
}

function getFilterValues() {
    return {
        // Tipo RO
        tipo: STATE.currentTipoFilter,

        // Filtri percentuali
        percentuale: document.getElementById('filterPercentuale')?.value || '',
        
        // Filtri dropdown
        mese: document.getElementById('filterMese')?.value || '',
        nazione: document.getElementById('filterNazione')?.value || '',
        agente: document.getElementById('filterAgente')?.value || '', // Ora contiene nomi
        esito: document.getElementById('filterEsito')?.value || '',
        
        // Range date
        dataDa: document.getElementById('filterDataDa')?.value || '',
        dataA: document.getElementById('filterDataA')?.value || '',
        
        // Range valori
        valueMin: parseFloat(document.getElementById('filterValueMin')?.value) || null,
        valueMax: parseFloat(document.getElementById('filterValueMax')?.value) || null,
        
        // Ricerca globale
        search: document.getElementById('globalSearch')?.value.toLowerCase().trim() || ''
    };
}

function applyFilterToRecord(ro, filters) {
    // Filtro tipo RO con logica corretta
    if (filters.tipo === 'normali' && isROCommerciale(ro.RO_num)) return false;
    if (filters.tipo === 'commerciali' && isRONormale(ro.RO_num)) return false;

    // Filtri percentuali
    if (filters.percentuale) {
        const roPerc = ro.Perc_realizzazione || 0;
        let roLevel;
        
        if (roPerc >= 90) roLevel = '90% - Quasi Certa';
        else if (roPerc >= 60) roLevel = '60% - Probabile';
        else if (roPerc >= 30) roLevel = '30% - Possibile';
        else if (roPerc >= 10) roLevel = '10% - Bassa';
        else roLevel = '0% - Non Specificata';
        
        if (roLevel !== filters.percentuale) return false;
    }

    // Filtri dropdown
    if (filters.mese && ro.RO_data && !ro.RO_data.startsWith(filters.mese)) return false;
    if (filters.nazione && ro.Nazione !== filters.nazione) return false;
    
    // FILTRO AGENTI - Ora usa i nomi convertiti
    if (filters.agente && ro.Agente_nome !== filters.agente) return false;
    
    if (filters.esito && ro.Offerta_Esito !== filters.esito) return false;
    
    if (filters.dataDa && ro.RO_data && ro.RO_data < filters.dataDa) return false;
    if (filters.dataA && ro.RO_data && ro.RO_data > filters.dataA) return false;
    
    if (filters.valueMin !== null && ro.Offerta_Valore < filters.valueMin) return false;
    if (filters.valueMax !== null && ro.Offerta_Valore > filters.valueMax) return false;
    
    if (filters.search) {
        const searchableText = [
            ro.RO_num, ro.Nazione, ro.Agente_nome, ro.Offerta_Esito,
            ro.Offerta_Categoria, ro.Offerta_Descrizione,
            ro.Offerta_Valore?.toString(), ro.Valore_Contratto?.toString()
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(filters.search)) return false;
    }

    return true;
}

/* ===== GESTIONE TIPO RO ===== */
export function changeTipoFilter(tipo) {
    console.log(`🔄 Cambio tipo filtro: ${tipo}`);
    
    // Aggiorna stato
    STATE.currentTipoFilter = tipo;
    
    // Aggiorna UI
    document.querySelectorAll('.tipo-ro-toggle button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tipo-ro-toggle button[data-tipo="${tipo}"]`)?.classList.add('active');
    
    // Applica filtri
    applyFilters();
    
    showToast('Filtro tipo', `Filtrato per: ${getTipoLabel(tipo)}`, 'info');
}

function getTipoLabel(tipo) {
    const labels = {
        'tutti': 'Tutti i RO',
        'normali': 'RO Normali',
        'commerciali': 'RO Commerciali'
    };
    return labels[tipo] || tipo;
}

/* ===== RICERCA GLOBALE ===== */
function handleGlobalSearch() {
    const searchTerm = document.getElementById('globalSearch')?.value.toLowerCase().trim();
    
    if (!searchTerm) {
        applyFilters();
        return;
    }
    
    console.log(`🔍 Ricerca globale: "${searchTerm}"`);
    
    // Applica filtri normali prima della ricerca
    applyFilters();
}

/* ===== FILTRI RAPIDI ===== */
export function applyQuickFilter(type) {
    console.log(`⚡ Filtro rapido: ${type}`);
    
    // Reset filtri mantenendo il tipo RO
    const currentTipo = STATE.currentTipoFilter;
    resetFilters(false);
    STATE.currentTipoFilter = currentTipo;
    
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    
    switch (type) {
        case 'thisMonth':
            document.getElementById('filterMese').value = currentMonth;
            break;
            
        case 'lastMonth':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                .toISOString().slice(0, 7);
            document.getElementById('filterMese').value = lastMonth;
            break;
            
        case 'thisQuarter':
            const quarter = Math.floor(today.getMonth() / 3);
            const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
            document.getElementById('filterDataDa').value = quarterStart.toISOString().split('T')[0];
            break;
            
        case 'highValue':
            document.getElementById('filterValueMin').value = '50000';
            break;
            
        case 'won':
            const esitoSelect = document.getElementById('filterEsito');
            const wonOptions = [...esitoSelect.options].find(opt => 
                opt.value.toLowerCase().includes('presa') || 
                opt.value.toLowerCase().includes('vinta') ||
                opt.value.toLowerCase().includes('won')
            );
            if (wonOptions) {
                esitoSelect.value = wonOptions.value;
            }
            break;
            
        // FILTRI PROBABILISTICI
        case 'highProbability':
            document.getElementById('filterPercentuale').value = '90% - Quasi Certa';
            break;
            
        case 'mediumProbability':
            document.getElementById('filterPercentuale').value = '60% - Probabile';
            break;
            
        case 'lowProbability':
            document.getElementById('filterPercentuale').value = '10% - Bassa';
            break;
    }
    
    applyFilters();
    showToast('Filtro applicato', `Filtro rapido: ${getQuickFilterLabel(type)}`, 'info');
}

function getQuickFilterLabel(type) {
    const labels = {
        thisMonth: 'Questo Mese',
        lastMonth: 'Mese Scorso', 
        thisQuarter: 'Questo Trimestre',
        highValue: 'Alto Valore (>50k€)',
        won: 'Solo Vinte',
        highProbability: 'Alta Probabilità (90%)',
        mediumProbability: 'Media Probabilità (60%)',
        lowProbability: 'Bassa Probabilità (10%)'
    };
    return labels[type] || type;
}

/* ===== RESET FILTRI ===== */
export function resetFilters(updateUI = true) {
    console.log('🔄 Reset filtri');
    
    const filterElements = [
        'filterMese', 'filterNazione', 'filterAgente', 'filterEsito', 'filterPercentuale',
        'filterDataDa', 'filterDataA', 'filterValueMin', 'filterValueMax', 'globalSearch'
    ];
    
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Reset tipo RO se richiesto
    if (updateUI) {
        document.querySelectorAll('.tipo-ro-toggle button').forEach(b => b.classList.remove('active'));
        document.querySelector('.tipo-ro-toggle button[data-tipo="tutti"]')?.classList.add('active');
        STATE.currentTipoFilter = 'tutti';
    }
    
    if (updateUI) {
        applyFilters();
        showToast('Filtri resettati', 'Tutti i filtri sono stati rimossi', 'info');
    }
}

/* ===== UTILITY FILTRI ===== */
function updateActiveFiltersCount() {
    const activeCount = getActiveFiltersCount();
    const countElement = document.getElementById('activeFiltersCount');
    
    if (countElement) {
        if (activeCount > 0) {
            countElement.textContent = activeCount;
            countElement.style.display = 'inline';
        } else {
            countElement.style.display = 'none';
        }
    }
    
    STATE.filtersActive = activeCount;
}

function getActiveFiltersCount() {
    const filterElements = [
        'filterMese', 'filterNazione', 'filterAgente', 'filterEsito', 'filterPercentuale',
        'filterDataDa', 'filterDataA', 'filterValueMin', 'filterValueMax', 'globalSearch'
    ];
    
    let count = 0;
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element && element.value) count++;
    });
    
    if (STATE.currentTipoFilter !== 'tutti') count++;
    
    return count;
}

function updateTypeToggleCounts() {
    if (STATE.roData.length === 0) return;
    
    // Usa la logica corretta per identificare RO
    const totali = STATE.filteredData.length;
    const normali = STATE.filteredData.filter(ro => isRONormale(ro.RO_num)).length;
    const commerciali = STATE.filteredData.filter(ro => isROCommerciale(ro.RO_num)).length;
    
    const countTutti = document.getElementById('countTutti');
    const countNormali = document.getElementById('countNormali');
    const countCommerciali = document.getElementById('countCommerciali');
    
    if (countTutti) countTutti.textContent = totali;
    if (countNormali) countNormali.textContent = normali;
    if (countCommerciali) countCommerciali.textContent = commerciali;
    
    console.log(`📊 Conteggi aggiornati: Totali=${totali}, Normali=${normali}, Commerciali=${commerciali}`);
}

function resetPagination() {
    STATE.currentPage = 1;
}

/* ===== UTILITY FORMATTING ===== */
function formatMonth(monthString) {
    if (!monthString || !monthString.includes('-')) return monthString;
    
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    
    return date.toLocaleDateString('it-IT', { 
        year: 'numeric', 
        month: 'long' 
    });
}

/* ===== EXPORT FILTER ENGINE ===== */
export default {
    initializeFilters,
    applyFilters,
    changeTipoFilter,
    applyQuickFilter,
    resetFilters
};