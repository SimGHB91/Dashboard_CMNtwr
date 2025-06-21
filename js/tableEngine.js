// ===== TABLEENGINE.JS - TABELLE E PAGINAZIONE =====
// Dashboard RO - Modulo Table Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    EVENTS, 
    FORMATTERS 
} from './config.js';

import { showToast, escapeHtml } from './core.js';

/* ===== AGGIORNAMENTO TABELLA PRINCIPALE ===== */
export function updateDataTable() {
    const tableSection = document.getElementById('dataTableSection');
    if (!tableSection || tableSection.style.display === 'none') return;
    
    performance.mark('table-update-start');
    console.log('📋 Aggiornamento tabella dati...');
    
    const tableBody = document.getElementById('dataTableBody');
    const tableCount = document.getElementById('tableCount');
    
    if (!tableBody || !tableCount) return;
    
    // Aggiorna contatore
    tableCount.textContent = `(${STATE.filteredData.length} record)`;
    
    // Applica ordinamento
    let sortedData = applySorting([...STATE.filteredData]);
    
    // Calcola paginazione
    const totalPages = Math.ceil(sortedData.length / STATE.itemsPerPage);
    const startIndex = (STATE.currentPage - 1) * STATE.itemsPerPage;
    const endIndex = startIndex + STATE.itemsPerPage;
    const pageData = sortedData.slice(startIndex, endIndex);
    
    // Genera righe tabella
    generateTableRows(tableBody, pageData);
    
    // Aggiorna controlli paginazione
    updatePagination(sortedData.length);
    
    performance.mark('table-update-end');
    performance.measure('table-update-duration', 'table-update-start', 'table-update-end');
    
    console.log(`✅ Tabella aggiornata: ${pageData.length} righe visualizzate`);
    
    EVENTS.emit('table:updated', { 
        pageData: pageData.length,
        totalData: sortedData.length,
        currentPage: STATE.currentPage 
    });
}

/* ===== APPLICAZIONE ORDINAMENTO ===== */
function applySorting(data) {
    if (!STATE.sortColumn) return data;
    
    return data.sort((a, b) => {
        let aVal = a[STATE.sortColumn];
        let bVal = b[STATE.sortColumn];
        
        // Gestione valori null/undefined
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Ordinamento numerico
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return STATE.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Ordinamento date
        if (STATE.sortColumn === 'RO_data') {
            const dateA = new Date(aVal);
            const dateB = new Date(bVal);
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return STATE.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
        }
        
        // Ordinamento valori monetari
        if (STATE.sortColumn === 'Offerta_Valore' || STATE.sortColumn === 'Valore_Contratto') {
            const numA = parseFloat(aVal) || 0;
            const numB = parseFloat(bVal) || 0;
            return STATE.sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        
        // Ordinamento stringhe
        const strA = aVal.toString().toLowerCase();
        const strB = bVal.toString().toLowerCase();
        
        if (STATE.sortDirection === 'asc') {
            return strA.localeCompare(strB, 'it', { numeric: true });
        } else {
            return strB.localeCompare(strA, 'it', { numeric: true });
        }
    });
}

/* ===== GENERAZIONE RIGHE TABELLA ===== */
function generateTableRows(tableBody, data) {
    // Svuota tabella
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="no-data-row">
                <div class="no-data-cell">
                    <span class="no-data-icon">📭</span>
                    <span>Nessun dato da visualizzare con i filtri attuali</span>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // Genera righe con animazione stagger
    data.forEach((ro, index) => {
        const row = createTableRow(ro, index);
        tableBody.appendChild(row);
        
        // Animazione entrata staggered
        setTimeout(() => {
            row.classList.add('row-visible');
        }, index * 20);
    });
}

function createTableRow(ro, index) {
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.dataset.roId = ro.ID;
    
    // Alterna colori righe
    if (index % 2 === 0) {
        row.classList.add('even-row');
    }
    
    // Determina classe CSS per percentuale realizzazione
    const percClass = getPercRealizationClass(ro.Perc_realizzazione);
    const percDisplay = ro.Perc_realizzazione > 0 ? `${ro.Perc_realizzazione}%` : '-';
    
    row.innerHTML = `
        <td class="ro-number-cell">
            <span class="ro-number">${escapeHtml(ro.RO_num)}</span>
            ${ro.RO_num.startsWith('C-') ? '<span class="commercial-badge">C</span>' : ''}
        </td>
        <td class="date-cell">
            <span class="date-value">${formatDisplayDate(ro.RO_data)}</span>
            <small class="date-relative">${getRelativeDate(ro.RO_data)}</small>
        </td>
        <td class="country-cell">
            <span class="country-flag">${getCountryFlag(ro.Nazione)}</span>
            <span class="country-name">${escapeHtml(ro.Nazione)}</span>
        </td>
        <td class="agent-cell">
            <div class="agent-info">
                <span class="agent-name">${escapeHtml(ro.Agente_nome)}</span>
                <small class="agent-stats">${getAgentStats(ro.Agente_nome)}</small>
            </div>
        </td>
        <td class="value-cell text-right">
            <span class="value-amount">${FORMATTERS.currency(ro.Offerta_Valore)}</span>
            <div class="value-bar">
                <div class="value-fill" style="width: ${getValueBarWidth(ro.Offerta_Valore)}%"></div>
            </div>
        </td>
        <td class="outcome-cell">
            <span class="badge ${getEsitoBadgeClass(ro.Offerta_Esito)}">${escapeHtml(ro.Offerta_Esito)}</span>
        </td>
        <td class="contract-cell text-right">
            ${ro.Valore_Contratto ? `
                <span class="contract-amount">${FORMATTERS.currency(ro.Valore_Contratto)}</span>
                <small class="conversion-rate">${getConversionRate(ro.Offerta_Valore, ro.Valore_Contratto)}%</small>
            ` : '<span class="no-contract">-</span>'}
        </td>
        <td class="probability-cell text-center">
            <span class="probability-badge ${percClass}">${percDisplay}</span>
            ${ro.Perc_realizzazione > 0 ? `
                <div class="probability-bar">
                    <div class="probability-fill ${percClass}" style="width: ${ro.Perc_realizzazione}%"></div>
                </div>
            ` : ''}
        </td>
        <td class="category-cell">
            <span class="category-name">${escapeHtml(ro.Offerta_Categoria)}</span>
        </td>
    `;
    
    // Aggiungi event listeners
    row.addEventListener('click', () => showRowDetails(ro));
    row.addEventListener('mouseenter', () => highlightRow(row, true));
    row.addEventListener('mouseleave', () => highlightRow(row, false));
    
    return row;
}

function getPercRealizationClass(percentage) {
    if (!percentage || percentage === 0) return 'prob-none';
    if (percentage >= 90) return 'prob-high';
    if (percentage >= 60) return 'prob-medium-high';
    if (percentage >= 30) return 'prob-medium';
    if (percentage >= 10) return 'prob-low';
    return 'prob-none';
}

/* ===== ORDINAMENTO COLONNE ===== */
export function sortTable(column) {
    console.log(`🔽 Ordinamento per: ${column}`);
    
    if (STATE.sortColumn === column) {
        STATE.sortDirection = STATE.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        STATE.sortColumn = column;
        STATE.sortDirection = 'asc';
    }
    
    updateSortIndicators(column);
    updateDataTable();
    
    showToast('Ordinamento', `Ordinato per ${getColumnDisplayName(column)} (${STATE.sortDirection === 'asc' ? 'crescente' : 'decrescente'})`, 'info');
}

function updateSortIndicators(activeColumn) {
    // Reset tutti gli indicatori
    document.querySelectorAll('.data-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕️';
    });
    
    // Imposta indicatore attivo
    const activeHeader = document.querySelector(`[onclick*="handleSortTable('${activeColumn}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(STATE.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        const icon = activeHeader.querySelector('.sort-icon');
        if (icon) {
            icon.textContent = STATE.sortDirection === 'asc' ? '↑' : '↓';
        }
    }
}

/* ===== PAGINAZIONE ===== */
export function changePage(direction) {
    const totalPages = Math.ceil(STATE.filteredData.length / STATE.itemsPerPage);
    
    if (direction === -1 && STATE.currentPage > 1) {
        STATE.currentPage--;
    } else if (direction === 1 && STATE.currentPage < totalPages) {
        STATE.currentPage++;
    }
    
    updateDataTable();
    
    // Scroll to top della tabella
    const tableSection = document.getElementById('dataTableSection');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function goToPage(page) {
    const totalPages = Math.ceil(STATE.filteredData.length / STATE.itemsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        STATE.currentPage = page;
        updateDataTable();
    }
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / STATE.itemsPerPage);
    const startIndex = (STATE.currentPage - 1) * STATE.itemsPerPage + 1;
    const endIndex = Math.min(STATE.currentPage * STATE.itemsPerPage, totalItems);
    
    // Aggiorna info paginazione
    updatePaginationInfo(startIndex, endIndex, totalItems);
    
    // Aggiorna bottoni
    updatePaginationButtons(totalPages);
    
    // Aggiorna numeri pagina
    updatePageNumbers(totalPages);
}

function updatePaginationInfo(start, end, total) {
    const elements = {
        start: document.getElementById('paginationStart'),
        end: document.getElementById('paginationEnd'),
        total: document.getElementById('paginationTotal')
    };
    
    if (elements.start) elements.start.textContent = total > 0 ? start : 0;
    if (elements.end) elements.end.textContent = end;
    if (elements.total) elements.total.textContent = total;
}

function updatePaginationButtons(totalPages) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = STATE.currentPage <= 1;
        prevBtn.classList.toggle('disabled', STATE.currentPage <= 1);
    }
    
    if (nextBtn) {
        nextBtn.disabled = STATE.currentPage >= totalPages;
        nextBtn.classList.toggle('disabled', STATE.currentPage >= totalPages);
    }
}

function updatePageNumbers(totalPages) {
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
    pageNumbers.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, STATE.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Aggiusta range se necessario
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Prima pagina
    if (startPage > 1) {
        pageNumbers.appendChild(createPageButton(1));
        if (startPage > 2) {
            pageNumbers.appendChild(createEllipsis());
        }
    }
    
    // Pagine centrali
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.appendChild(createPageButton(i));
    }
    
    // Ultima pagina
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageNumbers.appendChild(createEllipsis());
        }
        pageNumbers.appendChild(createPageButton(totalPages));
    }
}

function createPageButton(page) {
    const btn = document.createElement('button');
    btn.textContent = page;
    btn.onclick = () => goToPage(page);
    btn.className = 'page-btn';
    
    if (page === STATE.currentPage) {
        btn.classList.add('active');
    }
    
    return btn;
}

function createEllipsis() {
    const span = document.createElement('span');
    span.textContent = '...';
    span.className = 'pagination-ellipsis';
    return span;
}

/* ===== TOGGLE VISIBILITÀ TABELLA ===== */
export function toggleTableView() {
    const tableSection = document.getElementById('dataTableSection');
    const toggleBtn = document.getElementById('toggleTableBtn');
    
    if (!tableSection || !toggleBtn) return;
    
    const isVisible = tableSection.style.display !== 'none';
    
    if (isVisible) {
        // Nascondi tabella
        tableSection.style.display = 'none';
        toggleBtn.innerHTML = '<span>📋</span> Mostra Dettaglio Dati';
        showToast('Tabella nascosta', 'Tabella dati nascosta', 'info');
    } else {
        // Mostra tabella
        tableSection.style.display = 'block';
        toggleBtn.innerHTML = '<span>👁️</span> Nascondi Tabella';
        updateDataTable();
        showToast('Tabella mostrata', 'Tabella dati visualizzata', 'info');
        
        // Scroll alla tabella
        setTimeout(() => {
            tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

/* ===== UTILITY FUNCTIONS ===== */
function formatDisplayDate(dateString) {
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
}

function getRelativeDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Oggi';
        if (diffDays === 1) return 'Ieri';
        if (diffDays < 7) return `${diffDays} giorni fa`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
        return `${Math.floor(diffDays / 365)} anni fa`;
    } catch {
        return '';
    }
}

function getCountryFlag(country) {
    const flags = {
        'Italia': '🇮🇹',
        'Francia': '🇫🇷',
        'Germania': '🇩🇪',
        'Spagna': '🇪🇸',
        'Regno Unito': '🇬🇧',
        'Stati Uniti': '🇺🇸',
        'Svizzera': '🇨🇭',
        'Austria': '🇦🇹',
        'Olanda': '🇳🇱',
        'Belgio': '🇧🇪'
    };
    return flags[country] || '🌍';
}

function getAgentStats(agentName) {
    if (!agentName || agentName === 'Non specificato') return '';
    
    const agentROs = STATE.filteredData.filter(ro => ro.Agente_nome === agentName);
    return `${agentROs.length} RO`;
}

function getValueBarWidth(value) {
    if (!value || value <= 0) return 0;
    
    const maxValue = Math.max(...STATE.filteredData.map(ro => ro.Offerta_Valore || 0));
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
}

function getEsitoBadgeClass(esito) {
    if (!esito) return 'badge info';
    
    const esitoLower = esito.toLowerCase();
    
    if (esitoLower.includes('presa') || esitoLower.includes('vinta') || esitoLower.includes('won')) {
        return 'badge success';
    }
    if (esitoLower.includes('persa') || esitoLower.includes('rifiutata') || esitoLower.includes('lost')) {
        return 'badge error';
    }
    if (esitoLower.includes('corso') || esitoLower.includes('pending') || esitoLower.includes('sospesa')) {
        return 'badge warning';
    }
    
    return 'badge info';
}

function getConversionRate(offerValue, contractValue) {
    if (!offerValue || offerValue <= 0) return 0;
    if (!contractValue || contractValue <= 0) return 0;
    
    return Math.round((contractValue / offerValue) * 100);
}

function getColumnDisplayName(column) {
    const names = {
        'RO_num': 'Numero RO',
        'RO_data': 'Data',
        'Nazione': 'Nazione',
        'Agente_nome': 'Agente',
        'Offerta_Valore': 'Valore Offerta',
        'Offerta_Esito': 'Esito',
        'Valore_Contratto': 'Valore Contratto',
        'Perc_realizzazione': 'Probabilità',
        'Offerta_Categoria': 'Categoria'
    };
    return names[column] || column;
}

function highlightRow(row, highlight) {
    if (highlight) {
        row.classList.add('row-highlighted');
    } else {
        row.classList.remove('row-highlighted');
    }
}

function showRowDetails(ro) {
    console.log('📋 Dettagli RO:', ro);
    showToast('Dettagli RO', `RO ${ro.RO_num} selezionato`, 'info');
    
    EVENTS.emit('row:selected', { ro });
}

/* ===== EXPORT TABELLA ===== */
export async function exportFilteredData() {
    if (STATE.filteredData.length === 0) {
        showToast('Nessun dato', 'Nessun dato filtrato da esportare', 'warning');
        return;
    }
    
    try {
        // Verifica disponibilità XLSX
        if (typeof XLSX === 'undefined') {
            showToast('Errore', 'Libreria Excel non disponibile', 'error');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(STATE.filteredData.map(ro => ({
            'RO Numero': ro.RO_num,
            'Data': formatDisplayDate(ro.RO_data),
            'Nazione': ro.Nazione,
            'Agente': ro.Agente_nome,
            'Valore Offerta': ro.Offerta_Valore,
            'Esito': ro.Offerta_Esito,
            'Valore Contratto': ro.Valore_Contratto,
            'Probabilità %': ro.Perc_realizzazione,
            'Categoria': ro.Offerta_Categoria
        })));
        
        XLSX.utils.book_append_sheet(wb, ws, 'Dati Filtrati');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = `Dashboard_RO_Filtrati_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showToast('Export completato', `${STATE.filteredData.length} record esportati`, 'success');
        
        EVENTS.emit('data:exported', { 
            type: 'filtered',
            recordCount: STATE.filteredData.length,
            filename 
        });
        
    } catch (error) {
        console.error('❌ Errore export:', error);
        showToast('Errore export', 'Errore durante l\'esportazione', 'error');
    }
}

/* ===== PERFORMANCE HELPERS ===== */
export function getTablePerformanceMetrics() {
    return {
        totalRecords: STATE.roData.length,
        filteredRecords: STATE.filteredData.length,
        currentPage: STATE.currentPage,
        itemsPerPage: STATE.itemsPerPage,
        sortColumn: STATE.sortColumn,
        sortDirection: STATE.sortDirection,
        lastUpdate: performance.now()
    };
}

/* ===== EXPORT TABLE ENGINE ===== */
export default {
    updateDataTable,
    sortTable,
    changePage,
    goToPage,
    toggleTableView,
    exportFilteredData,
    getTablePerformanceMetrics
};