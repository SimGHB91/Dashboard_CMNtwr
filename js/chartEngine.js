// ===== CHARTENGINE.JS - GESTIONE GRAFICI CHART.JS =====
// Dashboard RO - Modulo Chart Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    CACHE, 
    CONFIG_UTILS, 
    EVENTS, 
    FORMATTERS,
    MAPPING_UTILS
} from './config.js';

import { showToast } from './core.js';

// Importazioni condizionali con fallback
let isROCommerciale, isRONormale, calculateMainMetrics;

// Setup importazioni sicure
try {
    const dataEngineModule = await import('./dataEngine.js');
    isROCommerciale = dataEngineModule.isROCommerciale;
    isRONormale = dataEngineModule.isRONormale;
} catch (error) {
    console.warn('⚠️ DataEngine non disponibile per chartEngine');
    // Fallback functions
    isROCommerciale = (roNum) => roNum?.toString().startsWith('C-');
    isRONormale = (roNum) => !isROCommerciale(roNum);
}

try {
    const dashboardEngineModule = await import('./dashboardEngine.js');
    calculateMainMetrics = dashboardEngineModule.calculateMainMetrics;
} catch (error) {
    console.warn('⚠️ DashboardEngine non disponibile per chartEngine');
    // Fallback function
    calculateMainMetrics = () => ({
        totalValue: 0,
        totalContracts: 0,
        probabilisticValue: 0
    });
}

/* ===== AGGIORNAMENTO TUTTI I GRAFICI ===== */
export function updateCharts() {
    console.log('📈 Aggiornamento grafici con mappatura agenti/categorie...');
    performance.mark('charts-update-start');
    
    // Verifica disponibilità Chart.js
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js non disponibile');
        showToast('Errore grafici', 'Chart.js non caricato', 'error');
        return;
    }
    
    // Verifica dati disponibili
    if (!STATE.filteredData || STATE.filteredData.length === 0) {
        console.warn('⚠️ Nessun dato per i grafici');
        return;
    }
    
    console.log(`📊 Creazione grafici con ${STATE.filteredData.length} record...`);
    
    // Aggiorna tutti i grafici in sequenza (non parallelo per debug)
    const updatePromises = [];
    
    try {
        updatePromises.push(updateTipoChart());
        updatePromises.push(updateAgentiChart());
        updatePromises.push(updateTemporaleChart());
        updatePromises.push(updateEsitiChart());
        updatePromises.push(updateCategorieChart());
        updatePromises.push(updateNazioniChart());
        updatePromises.push(updatePercRealizzazioneChart());
        updatePromises.push(updateAnalisiProbabilisticaChart());
        
        Promise.all(updatePromises).then(() => {
            performance.mark('charts-update-end');
            performance.measure('charts-update-duration', 'charts-update-start', 'charts-update-end');
            console.log('✅ Tutti i grafici aggiornati con successo');
            
            EVENTS.emit(EVENTS.CHART_UPDATED, { 
                chartsCount: Object.keys(STATE.charts).length 
            });
        }).catch(error => {
            console.error('❌ Errore in alcuni grafici:', error);
            showToast('Attenzione', 'Alcuni grafici potrebbero non funzionare correttamente', 'warning');
        });
        
    } catch (error) {
        console.error('❌ Errore critico aggiornamento grafici:', error);
        showToast('Errore grafici', 'Impossibile creare i grafici', 'error');
        
        // Mostra messaggio di errore nei canvas
        document.querySelectorAll('.chart-canvas').forEach(canvas => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#999';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Errore caricamento grafico', canvas.width / 2, canvas.height / 2);
            }
        });
    }
}

/* ===== GRAFICO DISTRIBUZIONE TIPO RO ===== */
function updateTipoChart() {
    const normali = STATE.filteredData.filter(ro => isRONormale(ro.RO_num)).length;
    const commerciali = STATE.filteredData.filter(ro => isROCommerciale(ro.RO_num)).length;

    const ctx = document.getElementById('tipoChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartType = getChartType('tipoChart') || 'doughnut';
    
    const chartData = {
        labels: [`RO Normali (${normali})`, `RO Commerciali (${commerciali})`],
        datasets: [{
            data: [normali, commerciali],
            backgroundColor: [CONFIG.CHART_COLORS[0], CONFIG.CHART_COLORS[1]],
            borderColor: [CONFIG.CHART_COLORS[0], CONFIG.CHART_COLORS[1]],
            borderWidth: 2,
            hoverOffset: chartType === 'doughnut' ? 8 : 0,
            hoverBorderWidth: 3
        }]
    };
    
    if (STATE.charts.tipoChart && STATE.charts.tipoChart.config.type === chartType) {
        STATE.charts.tipoChart.data = chartData;
        STATE.charts.tipoChart.update('active');
    } else {
        if (STATE.charts.tipoChart) STATE.charts.tipoChart.destroy();
        
        STATE.charts.tipoChart = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: getChartOptions(chartType, {
                title: 'Distribuzione RO per Tipo',
                showLegend: true,
                legendPosition: 'bottom',
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                }
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO TOP AGENTI CON NOMI ===== */
function updateAgentiChart() {
    const agentiData = {};
    const agentiValues = {};
    
    STATE.filteredData.forEach(ro => {
        // USA IL NOME DELL'AGENTE (già convertito da mappatura)
        const agente = ro.Agente_nome;
        if (agente && agente !== 'Non specificato') {
            agentiData[agente] = (agentiData[agente] || 0) + 1;
            agentiValues[agente] = (agentiValues[agente] || 0) + (ro.Offerta_Valore || 0);
        }
    });

    const dataToUse = STATE.agentiView === 'count' ? agentiData : agentiValues;
    const sortedAgenti = Object.entries(dataToUse)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    const ctx = document.getElementById('agentiChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartData = {
        labels: sortedAgenti.map(([nome]) => nome), // Ora mostra i nomi
        datasets: [{
            label: STATE.agentiView === 'count' ? 'Numero RO' : 'Valore Offerte (€)',
            data: sortedAgenti.map(([,value]) => value),
            backgroundColor: CONFIG.CHART_COLORS[0],
            borderColor: CONFIG.CHART_COLORS[0],
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: CONFIG.CHART_COLORS[1],
            hoverBorderColor: CONFIG.CHART_COLORS[1]
        }]
    };
    
    if (STATE.charts.agentiChart) {
        STATE.charts.agentiChart.data = chartData;
        STATE.charts.agentiChart.options.scales.y.ticks.callback = function(value) {
            return STATE.agentiView === 'value' ? FORMATTERS.currencyShort(value) : FORMATTERS.number(value);
        };
        STATE.charts.agentiChart.update('active');
    } else {
        STATE.charts.agentiChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: getChartOptions('bar', {
                title: 'Top 5 Agenti',
                showLegend: false,
                yAxisCallback: STATE.agentiView === 'value' ? FORMATTERS.currencyShort : FORMATTERS.number,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = STATE.agentiView === 'value' ? 
                                    FORMATTERS.currency(context.parsed.y) : 
                                    FORMATTERS.number(context.parsed.y);
                                return `${context.dataset.label}: ${value}`;
                            }
                        }
                    }
                }
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO ANDAMENTO TEMPORALE ===== */
function updateTemporaleChart() {
    const data = getTemporalData();
    
    const ctx = document.getElementById('temporaleChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartData = {
        labels: data.labels,
        datasets: [{
            label: 'Numero RO',
            data: data.counts,
            borderColor: CONFIG.CHART_COLORS[0],
            backgroundColor: CONFIG.CHART_COLORS[0] + '20',
            tension: 0.4,
            fill: true,
            yAxisID: 'y',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: CONFIG.CHART_COLORS[0],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        }, {
            label: 'Valore Offerte (€)',
            data: data.values,
            borderColor: CONFIG.CHART_COLORS[2],
            backgroundColor: CONFIG.CHART_COLORS[2] + '20',
            tension: 0.4,
            fill: true,
            yAxisID: 'y1',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: CONFIG.CHART_COLORS[2],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        }]
    };
    
    if (STATE.charts.temporaleChart) {
        STATE.charts.temporaleChart.data = chartData;
        STATE.charts.temporaleChart.update('active');
    } else {
        STATE.charts.temporaleChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: getTemporalChartOptions()
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO DISTRIBUZIONE ESITI ===== */
function updateEsitiChart() {
    const esitiData = {};
    STATE.filteredData.forEach(ro => {
        const esito = ro.Offerta_Esito || 'Non specificato';
        if (esito !== 'NaN' && esito !== '-') {
            esitiData[esito] = (esitiData[esito] || 0) + 1;
        }
    });

    const ctx = document.getElementById('esitiChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartType = getChartType('esitiChart') || 'pie';
    const entries = Object.entries(esitiData);
    
    const chartData = {
        labels: entries.map(([esito]) => esito),
        datasets: [{
            data: entries.map(([,count]) => count),
            backgroundColor: CONFIG.CHART_COLORS.slice(0, entries.length),
            borderColor: CONFIG.CHART_COLORS.slice(0, entries.length),
            borderWidth: 2,
            hoverOffset: chartType === 'pie' ? 8 : 0,
            hoverBorderWidth: 3
        }]
    };
    
    if (STATE.charts.esitiChart && STATE.charts.esitiChart.config.type === chartType) {
        STATE.charts.esitiChart.data = chartData;
        STATE.charts.esitiChart.update('active');
    } else {
        if (STATE.charts.esitiChart) STATE.charts.esitiChart.destroy();
        
        STATE.charts.esitiChart = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: getChartOptions(chartType, {
                title: 'Distribuzione Esiti',
                showLegend: true,
                legendPosition: 'bottom'
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO TOP CATEGORIE CON NOMI ===== */
function updateCategorieChart() {
    const categorieData = {};
    STATE.filteredData.forEach(ro => {
        // USA IL NOME DELLA CATEGORIA (già convertito da mappatura)
        const categoria = ro.Offerta_Categoria;
        if (categoria && categoria !== 'Non specificata') {
            if (STATE.categorieView === 'value') {
                categorieData[categoria] = (categorieData[categoria] || 0) + (ro.Offerta_Valore || 0);
            } else {
                categorieData[categoria] = (categorieData[categoria] || 0) + 1;
            }
        }
    });

    const sortedCategorie = Object.entries(categorieData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6);

    const ctx = document.getElementById('categorieChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartData = {
        labels: sortedCategorie.map(([cat]) => cat), // Ora mostra i nomi
        datasets: [{
            label: STATE.categorieView === 'value' ? 'Valore Offerte (€)' : 'Numero RO',
            data: sortedCategorie.map(([,value]) => value),
            backgroundColor: CONFIG.CHART_COLORS[3],
            borderColor: CONFIG.CHART_COLORS[3],
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: CONFIG.CHART_COLORS[4],
            hoverBorderColor: CONFIG.CHART_COLORS[4]
        }]
    };
    
    if (STATE.charts.categorieChart) {
        STATE.charts.categorieChart.data = chartData;
        STATE.charts.categorieChart.update('active');
    } else {
        STATE.charts.categorieChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: getChartOptions('bar', {
                title: 'Top 6 Categorie',
                showLegend: false,
                yAxisCallback: STATE.categorieView === 'value' ? FORMATTERS.currencyShort : FORMATTERS.number
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO RO PER NAZIONE ===== */
function updateNazioniChart() {
    const nazioniData = {};
    STATE.filteredData.forEach(ro => {
        const nazione = ro.Nazione || 'Non specificata';
        if (nazione !== '-' && nazione !== 'Non specificata') {
            nazioniData[nazione] = (nazioniData[nazione] || 0) + 1;
        }
    });

    const sortedNazioni = Object.entries(nazioniData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

    const ctx = document.getElementById('nazioniChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartType = getChartType('nazioniChart') || 'bar';
    
    const chartData = {
        labels: sortedNazioni.map(([nazione]) => nazione),
        datasets: [{
            label: 'Numero RO',
            data: sortedNazioni.map(([,count]) => count),
            backgroundColor: chartType === 'bar' ? 
                CONFIG.CHART_COLORS[5] : 
                CONFIG.CHART_COLORS.slice(0, sortedNazioni.length),
            borderColor: chartType === 'bar' ? 
                CONFIG.CHART_COLORS[5] : 
                CONFIG.CHART_COLORS.slice(0, sortedNazioni.length),
            borderWidth: 2,
            borderRadius: chartType === 'bar' ? 6 : 0,
            hoverOffset: chartType === 'pie' ? 8 : 0,
            hoverBorderWidth: 3
        }]
    };
    
    if (STATE.charts.nazioniChart && STATE.charts.nazioniChart.config.type === chartType) {
        STATE.charts.nazioniChart.data = chartData;
        STATE.charts.nazioniChart.update('active');
    } else {
        if (STATE.charts.nazioniChart) STATE.charts.nazioniChart.destroy();
        
        STATE.charts.nazioniChart = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: getChartOptions(chartType, {
                title: 'RO per Nazione',
                showLegend: chartType === 'pie',
                legendPosition: 'bottom',
                yAxisCallback: chartType === 'bar' ? FORMATTERS.number : null
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO PERCENTUALE REALIZZAZIONE ===== */
function updatePercRealizzazioneChart() {
    const percData = {};
    const percValues = {};
    
    STATE.filteredData.forEach(ro => {
        const perc = ro.Perc_realizzazione || 0;
        
        // Raggruppa per livelli
        let level;
        if (perc >= 90) level = '90% (Quasi Certa)';
        else if (perc >= 60) level = '60% (Probabile)';
        else if (perc >= 30) level = '30% (Possibile)';
        else if (perc >= 10) level = '10% (Bassa)';
        else level = '0% (Non Specificata)';
        
        percData[level] = (percData[level] || 0) + 1;
        percValues[level] = (percValues[level] || 0) + (ro.Offerta_Valore || 0);
    });

    const ctx = document.getElementById('percRealizzazioneChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartType = getChartType('percRealizzazioneChart') || 'doughnut';
    const dataToUse = STATE.percRealizzazioneView === 'count' ? percData : percValues;
    const entries = Object.entries(dataToUse);
    
    // Colori specifici per livelli di probabilità
    const probabilityColors = [
        '#E74C3C',  // Rosso per 0%
        '#FF8C42',  // Arancione per 10%
        '#FFD700',  // Giallo per 30%
        '#00E5A0',  // Verde acqua per 60%
        '#4F7CFF'   // Blu per 90%
    ];
    
    const chartData = {
        labels: entries.map(([level]) => level),
        datasets: [{
            data: entries.map(([,value]) => value),
            backgroundColor: probabilityColors.slice(0, entries.length),
            borderColor: probabilityColors.slice(0, entries.length),
            borderWidth: 2,
            hoverOffset: chartType === 'doughnut' ? 8 : 0,
            hoverBorderWidth: 3
        }]
    };
    
    if (STATE.charts.percRealizzazioneChart && STATE.charts.percRealizzazioneChart.config.type === chartType) {
        STATE.charts.percRealizzazioneChart.data = chartData;
        STATE.charts.percRealizzazioneChart.update('active');
    } else {
        if (STATE.charts.percRealizzazioneChart) STATE.charts.percRealizzazioneChart.destroy();
        
        STATE.charts.percRealizzazioneChart = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: getChartOptions(chartType, {
                title: 'Distribuzione Probabilità Realizzazione',
                showLegend: true,
                legendPosition: 'bottom',
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                
                                if (STATE.percRealizzazioneView === 'value') {
                                    return `${context.label}: ${FORMATTERS.currency(context.parsed)} (${percentage}%)`;
                                } else {
                                    return `${context.label}: ${context.parsed} RO (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GRAFICO ANALISI PROBABILISTICA ===== */
function updateAnalisiProbabilisticaChart() {
    const metrics = calculateMainMetrics();
    
    const ctx = document.getElementById('analisiProbabilisticaChart')?.getContext('2d');
    if (!ctx) return Promise.resolve();
    
    const chartData = {
        labels: ['Valore Dichiarato', 'Valore Probabile', 'Contratti Realizzati'],
        datasets: [{
            label: 'Analisi Economica (€)',
            data: [
                metrics.totalValue,
                metrics.probabilisticValue,
                metrics.totalContracts
            ],
            backgroundColor: [
                CONFIG.CHART_COLORS[0] + '80', // Blu trasparente
                CONFIG.CHART_COLORS[2] + '80', // Giallo trasparente  
                CONFIG.CHART_COLORS[1] + '80'  // Verde trasparente
            ],
            borderColor: [
                CONFIG.CHART_COLORS[0],
                CONFIG.CHART_COLORS[2],
                CONFIG.CHART_COLORS[1]
            ],
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false
        }]
    };
    
    if (STATE.charts.analisiProbabilisticaChart) {
        STATE.charts.analisiProbabilisticaChart.data = chartData;
        STATE.charts.analisiProbabilisticaChart.update('active');
    } else {
        STATE.charts.analisiProbabilisticaChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: getChartOptions('bar', {
                title: 'Analisi Economica Probabilistica',
                showLegend: false,
                yAxisCallback: FORMATTERS.currencyShort,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${FORMATTERS.currency(context.parsed.y)}`;
                            },
                            afterLabel: function(context) {
                                if (context.dataIndex === 1) { // Valore Probabile
                                    const efficiency = metrics.totalValue > 0 ? 
                                        ((metrics.probabilisticValue / metrics.totalValue) * 100).toFixed(1) : 0;
                                    return `Efficienza Probabilistica: ${efficiency}%`;
                                }
                                return null;
                            }
                        }
                    }
                }
            })
        });
    }
    
    return Promise.resolve();
}

/* ===== GESTIONE DATI TEMPORALI ===== */
function getTemporalData() {
    let data, labels;
    
    switch (STATE.temporaleView) {
        case 'week':
            data = getWeeklyData();
            break;
        case 'quarter':
            data = getQuarterlyData();
            break;
        default:
            data = getMonthlyData();
    }
    
    labels = Object.keys(data.counts).sort();
    
    return {
        labels: labels.map(label => formatTemporalLabel(label, STATE.temporaleView)),
        counts: labels.map(label => data.counts[label] || 0),
        values: labels.map(label => data.values[label] || 0)
    };
}

function getMonthlyData() {
    if (CACHE.monthlyData && CACHE.lastUpdate === STATE.filteredData.length) {
        return CACHE.monthlyData;
    }
    
    const counts = {};
    const values = {};
    
    STATE.filteredData.forEach(ro => {
        if (ro.RO_data) {
            const month = ro.RO_data.substring(0, 7);
            counts[month] = (counts[month] || 0) + 1;
            values[month] = (values[month] || 0) + (ro.Offerta_Valore || 0);
        }
    });
    
    CACHE.monthlyData = { counts, values };
    CACHE.lastUpdate = STATE.filteredData.length;
    
    return { counts, values };
}

function getQuarterlyData() {
    if (CACHE.quarterlyData && CACHE.lastUpdate === STATE.filteredData.length) {
        return CACHE.quarterlyData;
    }
    
    const counts = {};
    const values = {};
    
    STATE.filteredData.forEach(ro => {
        if (ro.RO_data) {
            const quarter = getQuarter(ro.RO_data);
            counts[quarter] = (counts[quarter] || 0) + 1;
            values[quarter] = (values[quarter] || 0) + (ro.Offerta_Valore || 0);
        }
    });
    
    CACHE.quarterlyData = { counts, values };
    CACHE.lastUpdate = STATE.filteredData.length;
    
    return { counts, values };
}

function getWeeklyData() {
    if (CACHE.weeklyData && CACHE.lastUpdate === STATE.filteredData.length) {
        return CACHE.weeklyData;
    }
    
    const counts = {};
    const values = {};
    
    STATE.filteredData.forEach(ro => {
        if (ro.RO_data) {
            const week = getWeek(ro.RO_data);
            counts[week] = (counts[week] || 0) + 1;
            values[week] = (values[week] || 0) + (ro.Offerta_Valore || 0);
        }
    });
    
    CACHE.weeklyData = { counts, values };
    CACHE.lastUpdate = STATE.filteredData.length;
    
    return { counts, values };
}

/* ===== UTILITY FUNCTIONS GRAFICI ===== */
function getQuarter(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
}

function getWeek(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatTemporalLabel(label, view) {
    switch (view) {
        case 'week':
            return `Sett. ${label.split('-W')[1]}/${label.split('-')[0]}`;
        case 'quarter':
            const [year, quarter] = label.split('-Q');
            return `Q${quarter} ${year}`;
        case 'month':
        default:
            const [y, m] = label.split('-');
            const date = new Date(y, m - 1);
            return date.toLocaleDateString('it-IT', { 
                year: 'numeric', 
                month: 'long' 
            });
    }
}

/* ===== INTERAZIONI GRAFICI ===== */
export function toggleAgentiView(view) {
    STATE.agentiView = view;
    updateChartOptionButtons('agentiChart', view);
    updateAgentiChart();
    showToast('Vista agenti', `Vista ${view === 'count' ? 'per numero' : 'per valore'}`, 'info');
}

export function toggleTemporaleView(view) {
    STATE.temporaleView = view;
    updateChartOptionButtons('temporaleChart', view);
    CACHE.clear(); // Clear cache per ricalcolare i dati
    updateTemporaleChart();
    showToast('Vista temporale', `Vista ${getTemporalViewLabel(view)}`, 'info');
}

export function toggleCategorieView(view) {
    STATE.categorieView = view;
    updateChartOptionButtons('categorieChart', view);
    updateCategorieChart();
    showToast('Vista categorie', `Vista ${view === 'count' ? 'per numero' : 'per valore'}`, 'info');
}

export function toggleChartType(chartId, type) {
    localStorage.setItem(`chartType_${chartId}`, type);
    updateChartOptionButtons(chartId, type);
    
    // Trigger chart update
    switch (chartId) {
        case 'tipoChart':
            updateTipoChart();
            break;
        case 'esitiChart':
            updateEsitiChart();
            break;
        case 'nazioniChart':
            updateNazioniChart();
            break;
        case 'percRealizzazioneChart':
            updatePercRealizzazioneChart();
            break;
    }
    
    showToast('Tipo grafico', `Grafico ${type} applicato`, 'info');
}

export function togglePercRealizzazioneView(view) {
    STATE.percRealizzazioneView = view;
    updateChartOptionButtons('percRealizzazioneChart', view);
    updatePercRealizzazioneChart();
    showToast('Vista probabilità', `Vista ${view === 'count' ? 'per numero' : 'per valore'}`, 'info');
}

export function refreshAnalisiProbabilistica() {
    updateAnalisiProbabilisticaChart();
    showToast('Analisi aggiornata', 'Analisi probabilistica aggiornata', 'success');
}

function getChartType(chartId) {
    return localStorage.getItem(`chartType_${chartId}`);
}

function updateChartOptionButtons(chartId, activeOption) {
    const container = document.querySelector(`#${chartId}`)?.closest('.chart-container');
    if (!container) return;
    
    const buttons = container.querySelectorAll('.chart-option-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        const onClick = btn.getAttribute('onclick');
        if (onClick && onClick.includes(`'${activeOption}'`)) {
            btn.classList.add('active');
        }
    });
}

function getTemporalViewLabel(view) {
    const labels = {
        month: 'mensile',
        quarter: 'trimestrale', 
        week: 'settimanale'
    };
    return labels[view] || view;
}

/* ===== CONFIGURAZIONI CHART.JS ===== */
function getChartOptions(type, customOptions = {}) {
    const textColor = CONFIG_UTILS.getThemeColor('--text-secondary');
    const gridColor = CONFIG_UTILS.getThemeColor('--border-color');
    
    // COLORI E DIMENSIONI MIGLIORATI PER DARK THEME
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const labelColor = isDarkTheme ? '#ffffff' : textColor; // Bianco in dark, normale in light
    const labelSize = isDarkTheme ? 12 : 11; // Più grandi in dark theme
    
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
        },
        animation: {
            duration: CONFIG.ANIMATION_DURATION.CHART,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: {
                display: customOptions.showLegend || false,
                position: customOptions.legendPosition || 'top',
                labels: {
                    font: { 
                        size: labelSize + 1, // Legenda leggermente più grande
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                        weight: '500'
                    },
                    usePointStyle: true,
                    padding: 15,
                    color: labelColor, // Bianco in dark theme
                    boxWidth: 12,
                    boxHeight: 12
                }
            },
            tooltip: {
                enabled: true,
                mode: 'nearest',
                backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                cornerRadius: 8,
                padding: 12,
                displayColors: true,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                titleFont: { size: 14, weight: 'bold' }, // Tooltip più grande
                bodyFont: { size: 13 } // Tooltip più grande
            }
        }
    };

    // Configurazioni specifiche per tipo
    if (type === 'bar') {
        baseOptions.scales = getBarChartScales(labelColor, gridColor, customOptions, labelSize);
    } else if (type === 'line') {
        baseOptions.scales = getLineChartScales(labelColor, gridColor, customOptions, labelSize);
    }
    
    // Merge con opzioni custom
    return mergeDeep(baseOptions, customOptions);
}

function getBarChartScales(labelColor, gridColor, customOptions, labelSize) {
    return {
        y: {
            beginAtZero: true,
            grid: {
                color: gridColor,
                borderColor: gridColor,
                lineWidth: 1,
                drawBorder: true
            },
            ticks: {
                font: { 
                    size: labelSize, // Dimensione aumentata
                    weight: '500'    // Peso aumentato per leggibilità
                },
                color: labelColor, // Bianco in dark theme
                padding: 10, // Più spazio
                callback: customOptions.yAxisCallback || function(value) { 
                    return FORMATTERS.number(value); 
                },
                maxTicksLimit: 8
            },
            title: {
                display: true,
                text: customOptions.yAxisTitle || '',
                font: { 
                    size: labelSize + 1, 
                    weight: 'bold' 
                },
                color: labelColor,
                padding: { top: 10, bottom: 10 }
            }
        },
        x: {
            grid: { 
                display: false 
            },
            ticks: {
                font: { 
                    size: labelSize, // Dimensione aumentata
                    weight: '500'    // Peso aumentato
                },
                color: labelColor, // Bianco in dark theme
                maxRotation: 45,
                minRotation: 0,
                padding: 10 // Più spazio
            },
            title: {
                display: true,
                text: customOptions.xAxisTitle || '',
                font: { 
                    size: labelSize + 1, 
                    weight: 'bold' 
                },
                color: labelColor,
                padding: { top: 10, bottom: 10 }
            }
        }
    };
}

function getLineChartScales(labelColor, gridColor, customOptions, labelSize) {
    return {
        x: {
            grid: { 
                color: gridColor, 
                borderColor: gridColor, 
                lineWidth: 1 
            },
            ticks: { 
                font: { 
                    size: labelSize, // Dimensione aumentata
                    weight: '500'    // Peso aumentato
                }, 
                color: labelColor, // Bianco in dark theme
                maxRotation: 45, 
                padding: 10 
            },
            title: {
                display: true,
                text: customOptions.xAxisTitle || '',
                font: { 
                    size: labelSize + 1, 
                    weight: 'bold' 
                },
                color: labelColor,
                padding: { top: 10, bottom: 10 }
            }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { 
                color: gridColor, 
                borderColor: gridColor, 
                lineWidth: 1 
            },
            ticks: {
                font: { 
                    size: labelSize, // Dimensione aumentata
                    weight: '500'    // Peso aumentato
                },
                color: labelColor, // Bianco in dark theme
                padding: 10,
                callback: function(value) { return FORMATTERS.number(value); },
                maxTicksLimit: 8
            },
            title: { 
                display: true, 
                text: 'Numero RO', 
                font: { 
                    size: labelSize + 1, 
                    weight: 'bold' 
                }, 
                color: labelColor,
                padding: { top: 10, bottom: 10 }
            }
        },
        y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { 
                drawOnChartArea: false, 
                color: gridColor, 
                borderColor: gridColor 
            },
            ticks: {
                font: { 
                    size: labelSize, // Dimensione aumentata
                    weight: '500'    // Peso aumentato
                },
                color: labelColor, // Bianco in dark theme
                padding: 10,
                callback: function(value) { return FORMATTERS.currencyShort(value); },
                maxTicksLimit: 8
            },
            title: { 
                display: true, 
                text: 'Valore (€)', 
                font: { 
                    size: labelSize + 1, 
                    weight: 'bold' 
                }, 
                color: labelColor,
                padding: { top: 10, bottom: 10 }
            }
        }
    };
}

function getTemporalChartOptions() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const labelColor = isDarkTheme ? '#ffffff' : CONFIG_UTILS.getThemeColor('--text-secondary');
    const gridColor = CONFIG_UTILS.getThemeColor('--border-color');
    const labelSize = isDarkTheme ? 12 : 11;
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        animation: { duration: CONFIG.ANIMATION_DURATION.CHART, easing: 'easeOutQuart' },
        elements: {
            point: { radius: 4, hoverRadius: 8, borderWidth: 2, hoverBorderWidth: 3 },
            line: { borderWidth: 3, tension: 0.4 }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { 
                    font: { 
                        size: labelSize + 1, 
                        weight: '500' 
                    }, 
                    color: labelColor, // Bianco in dark theme
                    usePointStyle: true, 
                    padding: 20, 
                    boxWidth: 12 
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                cornerRadius: 8,
                padding: 12,
                displayColors: true,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                callbacks: {
                    title: function(context) { return context[0].label; },
                    label: function(context) {
                        if (context.datasetIndex === 1) {
                            return `Valore: ${FORMATTERS.currency(context.parsed.y)}`;
                        }
                        return `RO: ${FORMATTERS.number(context.parsed.y)}`;
                    }
                }
            }
        },
        scales: getLineChartScales(labelColor, gridColor, {}, labelSize)
    };
}

/* ===== TEMA CHARTS MIGLIORATO ===== */
export function updateChartsTheme() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const labelColor = isDarkTheme ? '#ffffff' : CONFIG_UTILS.getThemeColor('--text-secondary');
    
    // Aggiorna default Chart.js
    Chart.defaults.color = labelColor;
    Chart.defaults.font.size = isDarkTheme ? 12 : 11;
    Chart.defaults.font.weight = '500';
    
    console.log(`🎨 Aggiornamento tema grafici: ${isDarkTheme ? 'dark' : 'light'}`);
    
    // Re-render tutti i chart esistenti con nuove dimensioni
    Object.values(STATE.charts).forEach(chart => {
        if (chart && chart.update) {
            // Aggiorna colori legende
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = labelColor;
                chart.options.plugins.legend.labels.font.size = isDarkTheme ? 13 : 12;
                chart.options.plugins.legend.labels.font.weight = '500';
            }
            
            // Aggiorna colori assi X
            if (chart.options.scales?.x?.ticks) {
                chart.options.scales.x.ticks.color = labelColor;
                chart.options.scales.x.ticks.font.size = isDarkTheme ? 12 : 11;
                chart.options.scales.x.ticks.font.weight = '500';
            }
            
            // Aggiorna colori assi Y
            if (chart.options.scales?.y?.ticks) {
                chart.options.scales.y.ticks.color = labelColor;
                chart.options.scales.y.ticks.font.size = isDarkTheme ? 12 : 11;
                chart.options.scales.y.ticks.font.weight = '500';
            }
            
            // Aggiorna colori assi Y1 (per grafici duali)
            if (chart.options.scales?.y1?.ticks) {
                chart.options.scales.y1.ticks.color = labelColor;
                chart.options.scales.y1.ticks.font.size = isDarkTheme ? 12 : 11;
                chart.options.scales.y1.ticks.font.weight = '500';
            }
            
            // Aggiorna titoli assi
            if (chart.options.scales?.x?.title) {
                chart.options.scales.x.title.color = labelColor;
                chart.options.scales.x.title.font.size = isDarkTheme ? 13 : 12;
                chart.options.scales.x.title.font.weight = 'bold';
            }
            
            if (chart.options.scales?.y?.title) {
                chart.options.scales.y.title.color = labelColor;
                chart.options.scales.y.title.font.size = isDarkTheme ? 13 : 12;
                chart.options.scales.y.title.font.weight = 'bold';
            }
            
            if (chart.options.scales?.y1?.title) {
                chart.options.scales.y1.title.color = labelColor;
                chart.options.scales.y1.title.font.size = isDarkTheme ? 13 : 12;
                chart.options.scales.y1.title.font.weight = 'bold';
            }
            
            // Aggiorna tooltip
            if (chart.options.plugins?.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = isDarkTheme ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';
                chart.options.plugins.tooltip.titleFont.size = 14;
                chart.options.plugins.tooltip.bodyFont.size = 13;
            }
            
            chart.update('none');
        }
    });
    
    console.log(`✅ Tema grafici aggiornato per ${Object.keys(STATE.charts).length} grafici`);
}





/* ===== UTILITY FUNCTIONS ===== */
function mergeDeep(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';
    
    if (!isObject(target) || !isObject(source)) {
        return source;
    }
    
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];
        
        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = sourceValue;
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });
    
    return target;
}

/* ===== EXPORT CHART ENGINE ===== */
export default {
    updateCharts,
    updateChartsTheme,
    toggleAgentiView,
    toggleTemporaleView,
    toggleCategorieView,
    toggleChartType,
    togglePercRealizzazioneView,
    refreshAnalisiProbabilistica
};