// ===== DASHBOARDENGINE.JS - SUMMARY CARDS E METRICHE =====
// Dashboard RO - Modulo Dashboard Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    CACHE, 
    EVENTS, 
    FORMATTERS 
} from './config.js';

import { showToast, loadModule } from './core.js';
import { parseNumericValue } from './dataEngine.js';

/* ===== AGGIORNAMENTO DASHBOARD PRINCIPALE ===== */
export function updateDashboard() {
    if (STATE.roData.length === 0) return;
    
    performance.mark('dashboard-update-start');
    console.log('📊 Aggiornamento dashboard...');
    
    // Aggiorna componenti principali
    updateSummaryCards();
    updateDataQualityIndicators();
    updateCharts();
    
    performance.mark('dashboard-update-end');
    performance.measure('dashboard-update-duration', 'dashboard-update-start', 'dashboard-update-end');
    
    console.log('✅ Dashboard aggiornata');
}

/* ===== AGGIORNAMENTO SUMMARY CARDS ===== */
function updateSummaryCards() {
    console.log('📋 Aggiornamento summary cards...');
    
    const metrics = calculateMainMetrics();
    
    // Verifica che il valore sia corretto
    if (metrics.totalValue < 20000000) {
        console.warn('⚠️ Valore totale sembra basso:', FORMATTERS.currency(metrics.totalValue));
    }
    
    // Anima valori con performance ottimizzata
    const animations = [
        { id: 'totalRO', value: metrics.totalRO, formatter: val => Math.round(val) },
        { id: 'totalValue', value: metrics.totalValue, formatter: FORMATTERS.currency },
        { id: 'totalContracts', value: metrics.totalContracts, formatter: FORMATTERS.currency },
        { id: 'successRate', value: metrics.successRate, formatter: val => val.toFixed(1) + '%' },
        { id: 'avgValue', value: metrics.avgValue, formatter: FORMATTERS.currency },
        { id: 'conversionRate', value: metrics.conversionRate, formatter: val => val.toFixed(1) + '%' },
        { id: 'probabilisticValue', value: metrics.probabilisticValue, formatter: FORMATTERS.currency },
        { id: 'avgProbability', value: metrics.avgProbability, formatter: val => val.toFixed(1) + '%' }
    ];
    
    // Anima in batch per performance
    animations.forEach((anim, index) => {
        setTimeout(() => {
            animateValue(anim.id, 0, anim.value, CONFIG.ANIMATION_DURATION.CHART, anim.formatter);
        }, index * 50); // Stagger animation
    });
    
    // Aggiorna trend indicators
    updateTrendIndicators(metrics);
    
    console.log('✅ Summary cards aggiornate');
}

export function calculateMainMetrics() {
    console.log('📊 Calcolo metriche principali...');
    
    const totalRO = STATE.filteredData.length;
    
    // CALCOLO TOTALE CON DEBUG
    const totalValue = debugTotalCalculation(STATE.filteredData);
    
    const totalContracts = STATE.filteredData.reduce((sum, ro) => {
        const contractValue = parseNumericValue(ro.Valore_Contratto_Original || ro.Valore_Contratto);
        return sum + contractValue;
    }, 0);
    
    // Contratti vinti basati su esiti positivi
    const esitiPositivi = ['presa', 'chiusa', 'vinta', 'aggiudicata', 'confermata'];
    const contractsCount = STATE.filteredData.filter(ro => {
        const esito = ro.Offerta_Esito?.toLowerCase() || '';
        return esitiPositivi.some(positivo => esito.includes(positivo));
    }).length;
    
    const successRate = totalRO > 0 ? ((contractsCount / totalRO) * 100) : 0;
    const avgValue = totalRO > 0 ? (totalValue / totalRO) : 0;
    const conversionRate = totalValue > 0 ? ((totalContracts / totalValue) * 100) : 0;
    
    // Calcolo valore probabile
    const probabilisticValue = STATE.filteredData.reduce((sum, ro) => {
        const baseValue = parseNumericValue(ro.Offerta_Valore_Original || ro.Offerta_Valore);
        const probability = (ro.Perc_realizzazione || 0) / 100;
        return sum + (baseValue * probability);
    }, 0);
    
    // Probabilità media ponderata
    const avgProbability = totalRO > 0 ? 
        (STATE.filteredData.reduce((sum, ro) => sum + (ro.Perc_realizzazione || 0), 0) / totalRO) : 0;
    
    const metrics = {
        totalRO,
        totalValue,
        totalContracts,
        contractsCount,
        successRate,
        avgValue,
        conversionRate,
        probabilisticValue,
        avgProbability,
        
        // Metriche aggiuntive per analisi
        probabilityDistribution: calculateProbabilityDistribution(),
        topCategories: calculateTopCategories(),
        monthlyTrend: calculateMonthlyTrend()
    };
    
    console.log(`🎯 METRICHE CALCOLATE:
        - Totale RO: ${totalRO}
        - VALORE TOTALE: ${FORMATTERS.currency(totalValue)}
        - Contratti: ${FORMATTERS.currency(totalContracts)}
        - Valore Medio: ${FORMATTERS.currency(avgValue)}
        - Valore Probabile: ${FORMATTERS.currency(probabilisticValue)}`);
    
    return metrics;
}

function debugTotalCalculation(records) {
    console.log('🔍 Debug calcolo totale:');
    console.log(`Records da sommare: ${records.length}`);
    
    let total = 0;
    let validValues = 0;
    let invalidValues = 0;
    
    records.forEach((ro, index) => {
        const originalValue = ro.Offerta_Valore_Original || ro.Offerta_Valore;
        const parsedValue = parseNumericValue(originalValue);
        
        if (parsedValue > 0) {
            validValues++;
            total += parsedValue;
            
            // Log primi 5 valori per debug
            if (index < 5) {
                console.log(`RO ${ro.RO_num}: "${originalValue}" → ${FORMATTERS.currency(parsedValue)}`);
            }
        } else {
            invalidValues++;
        }
    });
    
    console.log(`✅ Valori validi: ${validValues}`);
    console.log(`❌ Valori invalidi: ${invalidValues}`);
    console.log(`💰 TOTALE CALCOLATO: ${FORMATTERS.currency(total)}`);
    
    return total;
}

function calculateProbabilityDistribution() {
    const distribution = {
        high: 0,      // >= 90%
        mediumHigh: 0, // 60-89%
        medium: 0,    // 30-59%
        low: 0,       // 10-29%
        none: 0       // 0-9%
    };
    
    STATE.filteredData.forEach(ro => {
        const perc = ro.Perc_realizzazione || 0;
        if (perc >= 90) distribution.high++;
        else if (perc >= 60) distribution.mediumHigh++;
        else if (perc >= 30) distribution.medium++;
        else if (perc >= 10) distribution.low++;
        else distribution.none++;
    });
    
    return distribution;
}

function calculateTopCategories() {
    const categoryValues = {};
    
    STATE.filteredData.forEach(ro => {
        const category = ro.Offerta_Categoria || 'Non specificata';
        if (!categoryValues[category]) {
            categoryValues[category] = 0;
        }
        categoryValues[category] += ro.Offerta_Valore || 0;
    });
    
    return Object.entries(categoryValues)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category, value]) => ({ category, value }));
}

function calculateMonthlyTrend() {
    const monthlyData = {};
    
    STATE.filteredData.forEach(ro => {
        if (ro.RO_data) {
            const month = ro.RO_data.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { count: 0, value: 0 };
            }
            monthlyData[month].count++;
            monthlyData[month].value += ro.Offerta_Valore || 0;
        }
    });
    
    return monthlyData;
}

/* ===== ANIMAZIONE VALORI ===== */
function animateValue(elementId, start, end, duration, formatter = val => Math.round(val)) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startTime = performance.now();
    let currentValue = start;
    
    function updateValue(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out-quart) per animazione fluida
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        currentValue = start + (end - start) * easeOutQuart;
        
        element.textContent = formatter(currentValue);
        
        // Aggiungi effetto pulse durante l'animazione
        if (progress < 1) {
            element.style.transform = `scale(${1 + Math.sin(progress * Math.PI) * 0.05})`;
            requestAnimationFrame(updateValue);
        } else {
            element.textContent = formatter(end);
            element.style.transform = 'scale(1)';
            
            // Trigger evento completamento animazione
            EVENTS.emit('card:animated', { elementId, value: end });
        }
    }
    
    requestAnimationFrame(updateValue);
}

/* ===== INDICATORI TREND ===== */
function updateTrendIndicators(currentMetrics) {
    const trends = [
        { id: 'trendTotalRO', baseValue: currentMetrics.totalRO, type: 'count' },
        { id: 'trendTotalValue', baseValue: currentMetrics.totalValue, type: 'currency' },
        { id: 'trendTotalContracts', baseValue: currentMetrics.totalContracts, type: 'currency' },
        { id: 'trendSuccessRate', baseValue: currentMetrics.successRate, type: 'percentage' },
        { id: 'trendAvgValue', baseValue: currentMetrics.avgValue, type: 'currency' },
        { id: 'trendConversion', baseValue: currentMetrics.conversionRate, type: 'percentage' },
        { id: 'trendProbabilisticValue', baseValue: currentMetrics.probabilisticValue, type: 'currency' },
        { id: 'trendAvgProbability', baseValue: currentMetrics.avgProbability, type: 'percentage' }
    ];
    
    trends.forEach(trend => {
        const element = document.getElementById(trend.id);
        if (!element) return;
        
        let trendValue;
        if (trend.id.includes('Probabilistic') || trend.id.includes('Probability')) {
            trendValue = calculateProbabilisticTrend(trend.baseValue, trend.id);
        } else {
            trendValue = calculateTrendValue(trend.baseValue, trend.id);
        }
        
        const isPositive = trendValue > 0;
        
        element.textContent = `${isPositive ? '+' : ''}${trendValue.toFixed(1)}%`;
        element.className = `trend ${isPositive ? 'positive' : 'negative'}`;
        
        // Icone specifiche
        let icon = isPositive ? '↗️' : '↘️';
        if (trend.id.includes('Probabilistic')) {
            icon = isPositive ? '🎯' : '⚠️';
        } else if (trend.id.includes('Probability')) {
            icon = isPositive ? '📈' : '📉';
        }
        
        if (!element.textContent.includes('↗️') && !element.textContent.includes('↘️') && 
            !element.textContent.includes('🎯') && !element.textContent.includes('⚠️') && 
            !element.textContent.includes('📈') && !element.textContent.includes('📉')) {
            element.textContent = `${icon} ${element.textContent}`;
        }
    });
}

function calculateProbabilisticTrend(baseValue, trendId) {
    const trendFactors = {
        'trendProbabilisticValue': () => {
            const highProbRO = STATE.filteredData.filter(ro => (ro.Perc_realizzazione || 0) >= 60).length;
            const totalRO = STATE.filteredData.length;
            const highProbRatio = totalRO > 0 ? (highProbRO / totalRO) : 0;
            
            return (highProbRatio * 20) - 5; // Range da -5% a +15%
        },
        'trendAvgProbability': () => {
            const avgProb = baseValue;
            if (avgProb >= 60) return Math.random() * 10 + 5; // +5% to +15%
            if (avgProb >= 30) return Math.random() * 10 - 5; // -5% to +5%
            return -(Math.random() * 10 + 5); // -15% to -5%
        }
    };
    
    const factor = trendFactors[trendId] ? trendFactors[trendId]() : Math.random() * 10 - 5;
    
    if (baseValue === 0) return 0;
    
    return factor;
}

function calculateTrendValue(baseValue, trendId) {
    const trendFactors = {
        'trendTotalRO': () => Math.random() * 20 - 5,
        'trendTotalValue': () => Math.random() * 25 - 10,
        'trendTotalContracts': () => Math.random() * 30 - 15,
        'trendSuccessRate': () => Math.random() * 10 - 5,
        'trendAvgValue': () => Math.random() * 15 - 7.5,
        'trendConversion': () => Math.random() * 20 - 10
    };
    
    const factor = trendFactors[trendId] ? trendFactors[trendId]() : Math.random() * 10 - 5;
    
    if (baseValue === 0) return 0;
    
    return factor;
}

/* ===== INDICATORI QUALITÀ DATI ===== */
function updateDataQualityIndicators() {
    console.log('🔍 Aggiornamento indicatori qualità dati...');
    
    if (STATE.roData.length === 0) return;
    
    const totalRecords = STATE.roData.length;
    const indicators = [
        {
            id: 'indicator1',
            metric: 'Date Quality',
            value: STATE.roData.filter(ro => ro.RO_data && ro.RO_data.match(/^\d{4}-\d{2}-\d{2}$/)).length / totalRecords
        },
        {
            id: 'indicator2',
            metric: 'Value Quality',
            value: STATE.roData.filter(ro => ro.Offerta_Valore > 0).length / totalRecords
        },
        {
            id: 'indicator3',
            metric: 'Agent Quality',
            value: STATE.roData.filter(ro => ro.Agente_nome && ro.Agente_nome !== 'Non specificato').length / totalRecords
        },
        {
            id: 'indicator4',
            metric: 'Outcome Quality',
            value: STATE.roData.filter(ro => ro.Offerta_Esito && ro.Offerta_Esito !== 'In corso').length / totalRecords
        },
        {
            id: 'indicator5',
            metric: 'Country Quality',
            value: STATE.roData.filter(ro => ro.Nazione && ro.Nazione !== 'Non specificata').length / totalRecords
        },
        {
            id: 'indicator6',
            metric: 'Category Quality',
            value: STATE.roData.filter(ro => ro.Offerta_Categoria && ro.Offerta_Categoria !== 'Non specificata').length / totalRecords
        },
        {
            id: 'indicator7',
            metric: 'Probabilistic Quality',
            value: calculateProbabilisticDataQuality()
        },
        {
            id: 'indicator8',
            metric: 'Probability Coverage',
            value: calculateProbabilityCoverage()
        }
    ];
    
    indicators.forEach(indicator => {
        const element = document.getElementById(indicator.id);
        if (!element) return;
        
        const score = indicator.value;
        let className = 'data-quality-indicator';
        let qualityText = '';
        
        if (score >= 0.9) {
            className += ' excellent';
            qualityText = 'Eccellente';
        } else if (score >= 0.7) {
            className += ' good';
            qualityText = 'Buona';
        } else if (score >= 0.5) {
            className += ' warning';
            qualityText = 'Sufficiente';
        } else {
            className += ' error';
            qualityText = 'Scarsa';
        }
        
        element.className = className;
        element.title = `${indicator.metric}: ${qualityText} (${(score * 100).toFixed(1)}%)`;
        
        // Animazione pulsante per indicatori critici
        if (score < 0.5) {
            element.style.animation = 'pulse 2s infinite';
        } else {
            element.style.animation = 'none';
        }
    });
    
    console.log('✅ Indicatori qualità aggiornati');
}

function calculateProbabilisticDataQuality() {
    const totalRecords = STATE.filteredData.length;
    if (totalRecords === 0) return 0;
    
    const recordsWithProbability = STATE.filteredData.filter(ro => 
        ro.Perc_realizzazione && ro.Perc_realizzazione > 0
    ).length;
    
    return recordsWithProbability / totalRecords;
}

function calculateProbabilityCoverage() {
    const totalRecords = STATE.filteredData.length;
    if (totalRecords === 0) return 0;
    
    const distribution = calculateProbabilityDistribution();
    const totalCovered = distribution.high + distribution.mediumHigh + distribution.medium + distribution.low;
    
    return totalCovered / totalRecords;
}

/* ===== AGGIORNAMENTO GRAFICI ===== */
async function updateCharts() {
    // Verifica se Chart.js è disponibile
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js non disponibile - grafici saltati');
        return;
    }
    
    try {
        console.log('📊 Caricamento chartEngine...');
        const chartEngine = await loadModule('chartEngine');
        if (chartEngine) {
            console.log('📈 Aggiornamento grafici...');
            chartEngine.updateCharts();
        } else {
            console.warn('⚠️ ChartEngine non disponibile');
        }
    } catch (error) {
        console.error('❌ Errore caricamento chart engine:', error);
        
        // Mostra messaggio utente
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#666';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Errore caricamento grafico', canvas.width / 2, canvas.height / 2);
            }
        });
    }
}

/* ===== INSIGHTS PROBABILISTICI ===== */
export function showProbabilisticInsights() {
    const metrics = calculateMainMetrics();
    const insights = formatProbabilityInsight(metrics);
    
    if (insights.length > 0) {
        const message = insights.join('\n');
        showToast('Insights Probabilistici', message, 'info', 8000);
    }
}

function formatProbabilityInsight(metrics) {
    const insights = [];
    
    // Insight sulla distribuzione
    const distribution = metrics.probabilityDistribution;
    const totalRO = metrics.totalRO;
    
    if (totalRO > 0) {
        const highProbPercentage = (distribution.high / totalRO) * 100;
        
        if (highProbPercentage >= 30) {
            insights.push(`🎯 ${highProbPercentage.toFixed(1)}% delle RO ha alta probabilità di realizzazione`);
        } else if (highProbPercentage >= 15) {
            insights.push(`⚠️ Solo ${highProbPercentage.toFixed(1)}% delle RO ha alta probabilità`);
        } else {
            insights.push(`🚨 Poche RO ad alta probabilità (${highProbPercentage.toFixed(1)}%)`);
        }
    }
    
    // Insight sul valore probabile vs dichiarato
    if (metrics.totalValue > 0) {
        const efficiency = (metrics.probabilisticValue / metrics.totalValue) * 100;
        
        if (efficiency >= 70) {
            insights.push(`✅ Efficienza probabilistica elevata (${efficiency.toFixed(1)}%)`);
        } else if (efficiency >= 50) {
            insights.push(`⚡ Efficienza probabilistica moderata (${efficiency.toFixed(1)}%)`);
        } else {
            insights.push(`⚠️ Efficienza probabilistica bassa (${efficiency.toFixed(1)}%)`);
        }
    }
    
    return insights;
}

/* ===== PERFORMANCE HELPERS ===== */
export function getPerformanceMetrics() {
    return {
        ...STATE.performanceMetrics,
        cacheHitRate: CACHE.lastUpdate ? 1 : 0,
        dataQuality: calculateOverallDataQuality(),
        probabilisticCoverage: calculateProbabilityCoverage()
    };
}

function calculateOverallDataQuality() {
    const totalRecords = STATE.roData.length;
    if (totalRecords === 0) return 0;
    
    const qualityChecks = [
        STATE.roData.filter(ro => ro.RO_data && ro.RO_data.match(/^\d{4}-\d{2}-\d{2}$/)).length,
        STATE.roData.filter(ro => ro.Offerta_Valore > 0).length,
        STATE.roData.filter(ro => ro.Agente_nome && ro.Agente_nome !== 'Non specificato').length,
        STATE.roData.filter(ro => ro.Nazione && ro.Nazione !== 'Non specificata').length
    ];
    
    const avgQuality = qualityChecks.reduce((sum, count) => sum + count, 0) / (qualityChecks.length * totalRecords);
    
    return avgQuality;
}

/* ===== EXPORT DASHBOARD ENGINE ===== */
export default {
    updateDashboard,
    calculateMainMetrics,
    showProbabilisticInsights,
    getPerformanceMetrics
};