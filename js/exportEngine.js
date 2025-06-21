// ===== EXPORTENGINE.JS - EXPORT E MODAL =====
// Dashboard RO - Modulo Export Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    EVENTS, 
    FORMATTERS 
} from './config.js';

import { showToast } from './core.js';
import { calculateMainMetrics } from './dashboardEngine.js';

/* ===== SISTEMA EXPORT COMPLETO ===== */
export async function exportData() {
    if (STATE.roData.length === 0) {
        showToast('Errore', 'Nessun dato da esportare', 'error');
        return;
    }

    try {
        showLoadingState(true, 'Preparazione export...');
        
        console.log('📤 Inizio export dati...');
        performance.mark('export-start');
        
        // Verifica disponibilità XLSX
        if (typeof XLSX === 'undefined') {
            throw new Error('Libreria Excel non disponibile');
        }
        
        // Crea workbook Excel
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Riepilogo generale
        const summary = calculateExportSummary();
        const summaryWs = XLSX.utils.json_to_sheet([summary]);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Riepilogo');
        
        // Sheet 2: Dati filtrati
        const dataWs = XLSX.utils.json_to_sheet(STATE.filteredData.map(ro => ({
            'RO Numero': ro.RO_num,
            'Data': formatDisplayDate(ro.RO_data),
            'Nazione': ro.Nazione,
            'Agente': ro.Agente_nome,
            'Valore Offerta (€)': ro.Offerta_Valore,
            'Esito': ro.Offerta_Esito,
            'Valore Contratto (€)': ro.Valore_Contratto,
            'Probabilità %': ro.Perc_realizzazione,
            'Categoria': ro.Offerta_Categoria,
            'Descrizione': ro.Offerta_Descrizione
        })));
        XLSX.utils.book_append_sheet(wb, dataWs, 'Dati Filtrati');
        
        // Sheet 3: Analisi per agente
        const agentAnalysis = generateAgentAnalysis();
        const agentWs = XLSX.utils.json_to_sheet(agentAnalysis);
        XLSX.utils.book_append_sheet(wb, agentWs, 'Analisi Agenti');
        
        // Sheet 4: Analisi temporale
        const temporalAnalysis = generateTemporalAnalysis();
        const temporalWs = XLSX.utils.json_to_sheet(temporalAnalysis);
        XLSX.utils.book_append_sheet(wb, temporalWs, 'Analisi Temporale');
        
        // Genera nome file con timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = `Dashboard_RO_Export_${timestamp}.xlsx`;
        
        // Salva file
        XLSX.writeFile(wb, filename);
        
        performance.mark('export-end');
        performance.measure('export-duration', 'export-start', 'export-end');
        
        showToast('Export completato', `Dati esportati in ${filename}`, 'success');
        console.log('✅ Export completato con successo');
        
        EVENTS.emit('data:exported', { 
            type: 'complete',
            filename,
            sheets: 4,
            recordCount: STATE.filteredData.length 
        });
        
    } catch (error) {
        console.error('❌ Errore export:', error);
        showToast('Errore', 'Errore durante l\'esportazione dei dati', 'error');
        
        EVENTS.emit('export:error', { error: error.message });
    } finally {
        showLoadingState(false);
    }
}

function calculateExportSummary() {
    const metrics = calculateMainMetrics();
    
    return {
        'Totale RO': metrics.totalRO,
        'RO Normali': STATE.filteredData.filter(ro => !ro.RO_num.startsWith('C-')).length,
        'RO Commerciali': STATE.filteredData.filter(ro => ro.RO_num.startsWith('C-')).length,
        'Valore Totale Offerte (€)': metrics.totalValue,
        'Valore Totale Contratti (€)': metrics.totalContracts,
        'Valore Probabile (€)': metrics.probabilisticValue,
        'Contratti Vinti': metrics.contractsCount,
        'Tasso di Successo (%)': metrics.successRate.toFixed(2),
        'Valore Medio per RO (€)': metrics.avgValue.toFixed(2),
        'Tasso di Conversione Valore (%)': metrics.conversionRate.toFixed(2),
        'Probabilità Media (%)': metrics.avgProbability.toFixed(2),
        'Periodo Analisi': getPeriodAnalysis(),
        'Filtri Applicati': getActiveFiltersDescription(),
        'Data Export': new Date().toLocaleString('it-IT'),
        'Versione Dashboard': '2.0 - Modular'
    };
}

function generateAgentAnalysis() {
    const agentStats = {};
    
    STATE.filteredData.forEach(ro => {
        const agent = ro.Agente_nome;
        if (agent && agent !== 'Non specificato') {
            if (!agentStats[agent]) {
                agentStats[agent] = {
                    count: 0,
                    totalValue: 0,
                    totalContracts: 0,
                    won: 0,
                    avgProbability: 0
                };
            }
            
            agentStats[agent].count++;
            agentStats[agent].totalValue += ro.Offerta_Valore || 0;
            agentStats[agent].totalContracts += ro.Valore_Contratto || 0;
            agentStats[agent].avgProbability += ro.Perc_realizzazione || 0;
            
            if (ro.Offerta_Esito && (
                ro.Offerta_Esito.toLowerCase().includes('presa') ||
                ro.Offerta_Esito.toLowerCase().includes('vinta')
            )) {
                agentStats[agent].won++;
            }
        }
    });
    
    return Object.entries(agentStats)
        .sort(([,a], [,b]) => b.totalValue - a.totalValue)
        .map(([agent, stats]) => ({
            'Agente': agent,
            'Numero RO': stats.count,
            'Valore Totale Offerte (€)': stats.totalValue,
            'Valore Totale Contratti (€)': stats.totalContracts,
            'Contratti Vinti': stats.won,
            'Tasso Successo (%)': stats.count > 0 ? ((stats.won / stats.count) * 100).toFixed(2) : 0,
            'Valore Medio Offerta (€)': stats.count > 0 ? (stats.totalValue / stats.count).toFixed(2) : 0,
            'Conversione Valore (%)': stats.totalValue > 0 ? ((stats.totalContracts / stats.totalValue) * 100).toFixed(2) : 0,
            'Probabilità Media (%)': stats.count > 0 ? (stats.avgProbability / stats.count).toFixed(2) : 0
        }));
}

function generateTemporalAnalysis() {
    const monthlyData = getMonthlyAnalysisData();
    
    return Object.keys(monthlyData.counts)
        .sort()
        .map(month => ({
            'Periodo': formatMonth(month),
            'Numero RO': monthlyData.counts[month] || 0,
            'Valore Offerte (€)': monthlyData.values[month] || 0,
            'Valore Medio (€)': monthlyData.counts[month] > 0 ? 
                ((monthlyData.values[month] || 0) / monthlyData.counts[month]).toFixed(2) : 0,
            'Probabilità Media (%)': monthlyData.counts[month] > 0 ?
                (monthlyData.probabilities[month] / monthlyData.counts[month]).toFixed(2) : 0
        }));
}

function getMonthlyAnalysisData() {
    const data = { counts: {}, values: {}, probabilities: {} };
    
    STATE.filteredData.forEach(ro => {
        if (ro.RO_data) {
            const month = ro.RO_data.substring(0, 7);
            data.counts[month] = (data.counts[month] || 0) + 1;
            data.values[month] = (data.values[month] || 0) + (ro.Offerta_Valore || 0);
            data.probabilities[month] = (data.probabilities[month] || 0) + (ro.Perc_realizzazione || 0);
        }
    });
    
    return data;
}

/* ===== EXPORT CSV ===== */
export function generateCSVReport() {
    if (STATE.filteredData.length === 0) {
        showToast('Nessun dato', 'Nessun dato da esportare', 'warning');
        return;
    }
    
    try {
        const csvContent = [
            // Header
            ['RO Numero', 'Data', 'Nazione', 'Agente', 'Valore Offerta', 'Esito', 'Valore Contratto', 'Probabilità %', 'Categoria'].join(','),
            // Data rows
            ...STATE.filteredData.map(ro => [
                `"${ro.RO_num}"`,
                `"${formatDisplayDate(ro.RO_data)}"`,
                `"${ro.Nazione}"`,
                `"${ro.Agente_nome}"`,
                ro.Offerta_Valore || 0,
                `"${ro.Offerta_Esito}"`,
                ro.Valore_Contratto || 0,
                ro.Perc_realizzazione || 0,
                `"${ro.Offerta_Categoria}"`
            ].join(','))
        ].join('\n');
        
        // BOM per Excel UTF-8
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Dashboard_RO_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('CSV Export', 'File CSV generato con successo', 'success');
        }
        
    } catch (error) {
        console.error('❌ Errore export CSV:', error);
        showToast('Errore', 'Errore durante l\'esportazione CSV', 'error');
    }
}

/* ===== SISTEMA MODAL ===== */
export function generateReport() {
    console.log('📄 Apertura modal report...');
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus management per accessibilità
        const firstInput = modal.querySelector('input, button, select');
        if (firstInput) firstInput.focus();
        
        EVENTS.emit('modal:opened', { modalId: 'reportModal' });
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        
        // Restituisci focus al trigger
        const triggerBtn = document.querySelector(`[onclick*="${modalId}"]`);
        if (triggerBtn) triggerBtn.focus();
        
        EVENTS.emit('modal:closed', { modalId });
    }
}

export function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    });
}

export async function downloadReport() {
    const format = document.getElementById('reportFormat')?.value || 'excel';
    
    // Ottieni opzioni selezionate
    const options = Array.from(document.querySelectorAll('.report-options input[type="checkbox"]:checked'))
        .map(cb => cb.parentElement.textContent.trim());
    
    console.log(`📋 Generazione report formato: ${format}`);
    console.log('📋 Opzioni selezionate:', options);
    
    try {
        switch (format) {
            case 'excel':
                await exportData();
                break;
            case 'pdf':
                await generatePDFReport(options);
                break;
            case 'csv':
                generateCSVReport();
                break;
            default:
                throw new Error(`Formato non supportato: ${format}`);
        }
        
        showToast('Report generato', `Report ${format.toUpperCase()} creato con successo`, 'success');
        
        EVENTS.emit('report:generated', { format, options });
        
    } catch (error) {
        console.error('❌ Errore generazione report:', error);
        showToast('Errore', 'Errore durante la generazione del report', 'error');
    }
    
    closeModal('reportModal');
}

async function generatePDFReport(options) {
    // Genera contenuto HTML per stampa
    const printContent = generatePrintContent(options);
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Report Dashboard RO</title>
            <style>
                ${getPrintStyles()}
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

function generatePrintContent(options) {
    const summary = calculateExportSummary();
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    
    let content = `
        <div class="print-header">
            <h1>📊 Report Dashboard RO v2.0</h1>
            <div class="report-meta">
                <p><strong>Data generazione:</strong> ${new Date().toLocaleString('it-IT')}</p>
                <p><strong>Tema:</strong> ${currentTheme === 'dark' ? 'Scuro' : 'Chiaro'}</p>
                <p><strong>Record analizzati:</strong> ${STATE.filteredData.length}/${STATE.roData.length}</p>
                <p><strong>Sistema:</strong> Dashboard Modulare v2.0</p>
            </div>
        </div>
    `;
    
    if (options.includes('Riepilogo Generale')) {
        content += `
            <div class="print-section">
                <h2>📋 Riepilogo Generale</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <strong>Totale RO:</strong> ${summary['Totale RO']}
                    </div>
                    <div class="summary-item">
                        <strong>Valore Totale:</strong> ${FORMATTERS.currency(summary['Valore Totale Offerte (€)'])}
                    </div>
                    <div class="summary-item">
                        <strong>Valore Probabile:</strong> ${FORMATTERS.currency(summary['Valore Probabile (€)'])}
                    </div>
                    <div class="summary-item">
                        <strong>Contratti:</strong> ${FORMATTERS.currency(summary['Valore Totale Contratti (€)'])}
                    </div>
                    <div class="summary-item">
                        <strong>Tasso Successo:</strong> ${summary['Tasso di Successo (%)']}%
                    </div>
                    <div class="summary-item">
                        <strong>Probabilità Media:</strong> ${summary['Probabilità Media (%)']}%
                    </div>
                </div>
            </div>
        `;
    }
    
    if (options.includes('Analisi Trend')) {
        content += `
            <div class="print-section">
                <h2>📈 Analisi Trend</h2>
                <p><strong>Periodo di analisi:</strong> ${summary['Periodo Analisi']}</p>
                <p><strong>Filtri applicati:</strong> ${summary['Filtri Applicati']}</p>
                <div class="trend-note">
                    <p><em>Nota: I grafici dettagliati sono disponibili nella dashboard interattiva.</em></p>
                    <p><em>Sistema modulare v2.0 con performance ottimizzate.</em></p>
                </div>
            </div>
        `;
    }
    
    if (options.includes('Dati Dettagliati')) {
        content += `
            <div class="print-section">
                <h2>📋 Dati Dettagliati (Prime 50 righe)</h2>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>RO</th>
                            <th>Data</th>
                            <th>Agente</th>
                            <th>Valore</th>
                            <th>Esito</th>
                            <th>Prob%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        STATE.filteredData.slice(0, 50).forEach(ro => {
            content += `
                <tr>
                    <td>${escapeHtml(ro.RO_num)}</td>
                    <td>${formatDisplayDate(ro.RO_data)}</td>
                    <td>${escapeHtml(ro.Agente_nome)}</td>
                    <td>${FORMATTERS.currency(ro.Offerta_Valore)}</td>
                    <td>${escapeHtml(ro.Offerta_Esito)}</td>
                    <td>${ro.Perc_realizzazione || 0}%</td>
                </tr>
            `;
        });
        
        content += `
                    </tbody>
                </table>
                <p class="table-note">* Visualizzate prime 50 righe. Per dati completi utilizzare export Excel.</p>
            </div>
        `;
    }
    
    return content;
}

/* ===== SHARING E UTILITÀ ===== */
export async function shareData() {
    const summary = calculateExportSummary();
    const shareData = {
        title: 'Dashboard RO - Riepilogo v2.0',
        text: `Dashboard RO Modulare: ${summary['Totale RO']} RO per un valore di ${FORMATTERS.currency(summary['Valore Totale Offerte (€)'])}. Tasso successo: ${summary['Tasso di Successo (%)']}%. Sistema v2.0 ad alte prestazioni.`,
        url: window.location.href
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            showToast('Condivisione', 'Dati condivisi con successo', 'success');
            
            EVENTS.emit('data:shared', { method: 'native' });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Errore condivisione:', error);
                fallbackShare(shareData.text);
            }
        }
    } else {
        fallbackShare(shareData.text);
    }
}

function fallbackShare(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copiato', 'Riepilogo copiato negli appunti', 'success');
            EVENTS.emit('data:shared', { method: 'clipboard' });
        }).catch(() => {
            showToast('Errore', 'Impossibile copiare negli appunti', 'error');
        });
    } else {
        // Fallback per browser più vecchi
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Copiato', 'Riepilogo copiato negli appunti', 'success');
            EVENTS.emit('data:shared', { method: 'legacy' });
        } catch {
            showToast('Errore', 'Impossibile copiare negli appunti', 'error');
        }
        
        document.body.removeChild(textArea);
    }
}

export function printDashboard() {
    const printContent = generatePrintContent(['Riepilogo Generale', 'Analisi Trend']);
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Dashboard RO v2.0</title>
            <style>${getPrintStyles()}</style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    EVENTS.emit('dashboard:printed');
}

/* ===== UTILITY FUNCTIONS ===== */
function getPeriodAnalysis() {
    if (STATE.filteredData.length === 0) return 'Nessun dato';
    
    const dates = STATE.filteredData
        .filter(ro => ro.RO_data)
        .map(ro => ro.RO_data)
        .sort();
    
    if (dates.length === 0) return 'Date non disponibili';
    
    const startDate = formatDisplayDate(dates[0]);
    const endDate = formatDisplayDate(dates[dates.length - 1]);
    
    return `${startDate} - ${endDate}`;
}

function getActiveFiltersDescription() {
    const filters = [];
    
    if (STATE.currentTipoFilter !== 'tutti') {
        filters.push(`Tipo: ${STATE.currentTipoFilter}`);
    }
    
    const filterElements = [
        { id: 'filterMese', label: 'Mese' },
        { id: 'filterNazione', label: 'Nazione' },
        { id: 'filterAgente', label: 'Agente' },
        { id: 'filterEsito', label: 'Esito' },
        { id: 'filterPercentuale', label: 'Probabilità' },
        { id: 'globalSearch', label: 'Ricerca' }
    ];
    
    filterElements.forEach(({ id, label }) => {
        const element = document.getElementById(id);
        if (element && element.value) {
            filters.push(`${label}: ${element.value}`);
        }
    });
    
    return filters.length > 0 ? filters.join(', ') : 'Nessun filtro';
}

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

function formatMonth(monthString) {
    if (!monthString || !monthString.includes('-')) return monthString;
    
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    
    return date.toLocaleDateString('it-IT', { 
        year: 'numeric', 
        month: 'long' 
    });
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getPrintStyles() {
    return `
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            color: #333;
            line-height: 1.4;
        }
        .print-header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #667eea;
            padding-bottom: 20px;
        }
        .print-header h1 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .report-meta {
            font-size: 12px;
            color: #666;
        }
        .print-section { 
            margin-bottom: 30px; 
            page-break-inside: avoid;
        }
        .print-section h2 {
            color: #667eea;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .summary-item {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background: #f9f9f9;
        }
        .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px;
        }
        .print-table th, .print-table td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
            font-size: 11px;
        }
        .print-table th { 
            background-color: #f2f2f2; 
            font-weight: bold;
        }
        .trend-note, .table-note {
            font-style: italic;
            color: #666;
            margin-top: 15px;
            font-size: 12px;
        }
        @media print { 
            body { margin: 0; }
            .print-section { page-break-inside: avoid; }
            .summary-grid { grid-template-columns: 1fr; }
        }
    `;
}

function showLoadingState(show, message = 'Elaborazione...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    if (messageEl && message) {
        messageEl.textContent = message;
    }
}

/* ===== EXPORT ENGINE ===== */
export default {
    exportData,
    generateCSVReport,
    generateReport,
    downloadReport,
    closeModal,
    closeAllModals,
    shareData,
    printDashboard
};