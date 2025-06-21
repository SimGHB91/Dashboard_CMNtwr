// ===== DATAENGINE.JS - GESTIONE FILE E PROCESSING DATI =====
// Dashboard RO - Modulo Data Engine v2.0 - Performance Optimized

import { 
    CONFIG, 
    STATE, 
    CACHE, 
    ERROR_LOG, 
    EVENTS, 
    VALIDATORS, 
    FORMATTERS,
    MAPPING_UTILS
} from './config.js';

import { showToast, loadModule } from './core.js';

/* ===== FILE UPLOAD E HANDLING ===== */
export function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (!uploadArea || !fileInput) {
        console.warn('⚠️ Elementi upload non trovati');
        return;
    }

    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // File input change
    fileInput.addEventListener('change', handleFileInputChange);
    
    console.log('📁 Sistema file upload inizializzato');
}

export function triggerFileSelect() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

/* ===== DRAG & DROP HANDLERS ===== */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
    
    const uploadIcon = e.currentTarget.querySelector('.upload-icon');
    if (uploadIcon) {
        uploadIcon.style.transform = 'scale(1.1)';
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('dragover');
        
        const uploadIcon = e.currentTarget.querySelector('.upload-icon');
        if (uploadIcon) {
            uploadIcon.style.transform = 'scale(1)';
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const uploadArea = e.currentTarget;
    uploadArea.classList.remove('dragover');
    
    const uploadIcon = uploadArea.querySelector('.upload-icon');
    if (uploadIcon) {
        uploadIcon.style.transform = 'scale(1)';
    }
    
    const files = e.dataTransfer.files;
    
    if (files.length === 0) {
        showToast('Nessun file', 'Nessun file rilevato nel drop', 'warning');
        return;
    }
    
    if (files.length > 1) {
        showToast('Troppi file', 'Seleziona un solo file Excel', 'warning');
        return;
    }
    
    handleFile(files[0]);
}

function handleFileInputChange(e) {
    const files = e.target.files;
    
    if (files.length === 0) return;
    
    if (files.length > 1) {
        showToast('Troppi file', 'Seleziona un solo file Excel', 'warning');
        return;
    }
    
    handleFile(files[0]);
}

/* ===== GESTIONE FILE PRINCIPALE ===== */
export async function handleFile(file) {
    console.log('📁 Inizio caricamento file:', file.name);
    performance.mark('file-load-start');
    
    try {
        // Reset stato precedente
        resetFileState();
        
        // Validazione file
        if (!validateFile(file)) return;
        
        // Mostra stato loading
        showLoadingState(true, 'Caricamento file...');
        updateProgress(10);
        
        // Leggi file
        const data = await readFileAsync(file);
        updateProgress(30);
        
        // Parse Excel
        console.log('📊 Parsing file Excel...');
        const workbook = XLSX.read(data, { 
            type: 'array',
            cellStyles: true,
            cellFormulas: true,
            cellDates: true
        });
        updateProgress(50);
        
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('Nessun foglio trovato nel file Excel');
        }
        
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: null,
            blankrows: false,
            raw: false
        });
        updateProgress(70);
        
        if (jsonData.length < 2) {
            throw new Error('File Excel vuoto o senza dati validi');
        }
        
        // Processa dati
        await processExcelData(jsonData, file);
        updateProgress(100);
        
        // Salva info file
        STATE.lastFileLoaded = {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            loadTime: Date.now()
        };
        
        showFileInfo(file);
        showToast('Successo', `File caricato: ${STATE.roData.length} record elaborati`, 'success');
        
        performance.mark('file-load-end');
        performance.measure('file-load-duration', 'file-load-start', 'file-load-end');
        
        EVENTS.emit(EVENTS.DATA_LOADED, { 
            recordCount: STATE.roData.length,
            fileName: file.name 
        });
        
    } catch (error) {
        console.error('❌ Errore caricamento file:', error);
        ERROR_LOG.addFileError(file.name, error);
        
        let errorMessage = 'Errore nel caricamento del file.';
        
        if (error.message.includes('Excel')) {
            errorMessage += ' Verifica che sia un file Excel valido.';
        } else if (error.message.includes('vuoto')) {
            errorMessage += ' Il file sembra essere vuoto.';
        } else if (error.message.includes('formato')) {
            errorMessage += ' Formato file non supportato.';
        }
        
        showToast('Errore', errorMessage, 'error');
        showMessage(errorMessage, 'error');
        
        EVENTS.emit(EVENTS.ERROR_OCCURRED, { 
            type: 'file',
            error: error.message 
        });
        
    } finally {
        showLoadingState(false);
        hideProgress();
        STATE.isLoading = false;
    }
}

/* ===== VALIDAZIONE FILE ===== */
function validateFile(file) {
    console.log('🔍 Validazione file:', file.name);
    
    if (!VALIDATORS.isValidExcelFile(file)) {
        if (!CONFIG.SUPPORTED_FORMATS.some(format => 
            file.name.toLowerCase().endsWith(format))) {
            showToast('Formato non valido', 
                     `Seleziona un file Excel (${CONFIG.SUPPORTED_FORMATS.join(', ')})`, 
                     'error');
        } else if (file.size > CONFIG.MAX_FILE_SIZE) {
            showToast('File troppo grande', 
                     `Dimensione massima: ${FORMATTERS.fileSize(CONFIG.MAX_FILE_SIZE)}`, 
                     'error');
        } else {
            showToast('File vuoto', 'Il file selezionato è vuoto', 'error');
        }
        return false;
    }
    
    console.log('✅ File validato con successo');
    return true;
}

/* ===== LETTURA FILE ASINCRONA ===== */
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = e => {
            console.log('📖 File letto con successo');
            resolve(new Uint8Array(e.target.result));
        };
        
        reader.onerror = () => {
            console.error('❌ Errore lettura file');
            reject(new Error('Errore nella lettura del file'));
        };
        
        reader.onprogress = e => {
            if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 20) + 10; // 10-30%
                updateProgress(progress);
            }
        };
        
        reader.readAsArrayBuffer(file);
    });
}

/* ===== PROCESSING PRINCIPALE DATI EXCEL ===== */
async function processExcelData(jsonData, file) {
    console.log('⚙️ Inizio elaborazione dati Excel con deduplicazione e mappatura agenti/categorie...');
    performance.mark('processing-start');
    
    if (!jsonData || jsonData.length < 2) {
        throw new Error('File Excel vuoto o non valido');
    }

    const headers = jsonData[0];
    console.log('📋 Headers rilevati:', headers);
    
    // Rilevamento automatico colonne
    const columnMap = detectColumns(headers);
    console.log('🔍 Mapping colonne:', columnMap);
    
    // Validazione colonne essenziali
    validateRequiredColumns(columnMap);
    
    // Reset cache e dati
    CACHE.clear();
    STATE.roData = [];
    
    let processedCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    const totalRows = jsonData.length - 1;
    const processingErrors = [];
    const rawRecords = [];
    
    console.log(`📊 Elaborazione ${totalRows} righe...`);
    
    // FASE 1: Elaborazione batch di tutti i record grezzi
    for (let i = 1; i < jsonData.length; i += CONFIG.BATCH_SIZE) {
        const endIndex = Math.min(i + CONFIG.BATCH_SIZE, jsonData.length);
        const batch = jsonData.slice(i, endIndex);
        
        for (let j = 0; j < batch.length; j++) {
            const rowIndex = i + j;
            const row = batch[j];
            
            // Skip righe completamente vuote
            if (!row || row.every(cell => cell === null || cell === '' || cell === undefined)) {
                continue;
            }

            try {
                const record = createRecordFromRow(row, columnMap, rowIndex);
                if (record && VALIDATORS.isValidRORecord(record)) {
                    rawRecords.push(record);
                    processedCount++;
                } else {
                    warningCount++;
                }
            } catch (error) {
                errorCount++;
                processingErrors.push({
                    row: rowIndex,
                    error: error.message,
                    data: row.slice(0, 3)
                });
                
                console.warn(`⚠️ Errore riga ${rowIndex}:`, error.message);
            }
        }
        
        // Update progress ogni batch
        const progress = 70 + Math.round(((i + CONFIG.BATCH_SIZE) / totalRows) * 15); // 70-85%
        updateProgress(Math.min(progress, 85));
        
        // Yield control per non bloccare UI
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    console.log(`📋 Record grezzi elaborati: ${rawRecords.length}`);
    updateProgress(90);

    // FASE 2: Deduplicazione RO
    console.log('🔄 Inizio deduplicazione RO...');
    const { deduplicatedRecords, duplicatesRemoved, stats } = deduplicateRO(rawRecords);
    
    STATE.roData = deduplicatedRecords;
    updateProgress(95);

    performance.mark('processing-end');
    performance.measure('processing-duration', 'processing-start', 'processing-end');
    
    const successRate = totalRows > 0 ? ((processedCount / totalRows) * 100).toFixed(1) : 0;
    
    console.log(`✅ Elaborazione completata:
        - Record grezzi: ${rawRecords.length}
        - Duplicati rimossi: ${duplicatesRemoved}
        - Record finali: ${STATE.roData.length}
        - RO Normali: ${stats.normali}
        - RO Commerciali: ${stats.commerciali}
        - Tasso successo: ${successRate}%
        - Errori: ${errorCount}
        - Warning: ${warningCount}`);
    
    // Log errori se presenti
    if (processingErrors.length > 0) {
        ERROR_LOG.processingErrors = processingErrors;
        console.warn('⚠️ Errori dettagliati:', processingErrors.slice(0, 10));
    }
    
    // Validazione minima
    if (STATE.roData.length === 0) {
        throw new Error('Nessun record valido trovato nel file');
    }
    
    // Mostra messaggi informativi
    const messages = [];
    if (duplicatesRemoved > 0) {
        messages.push(`${duplicatesRemoved} RO duplicate rimosse`);
    }
    if (errorCount > 0) {
        messages.push(`${errorCount} righe con errori ignorate`);
    }
    if (warningCount > 0) {
        messages.push(`${warningCount} righe incomplete elaborate`);
    }
    
    if (messages.length > 0) {
        showToast('Elaborazione completata', messages.join('. '), 'info');
    }
    
    // Inizializza dashboard
    await initializeDashboard();
    STATE.hasData = true;
    
    console.log(`🎉 Dati pronti: ${STATE.roData.length} record unici caricati con mappatura agenti/categorie`);
}

/* ===== PARSING VALORI NUMERICI ===== */
export function parseNumericValue(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    // Se è già un numero
    if (typeof value === 'number') return value;
    
    // Converti string in numero - GESTIONE FORMATO ITALIANO/EXCEL
    const stringValue = value.toString().trim();
    
    // RIMUOVI SIMBOLI EURO, SPAZI E CARATTERI NON NUMERICI
    let cleanValue = stringValue.replace(/[€\s\u00A0]/g, ''); // Include spazio non-breaking
    
    // GESTIONE FORMATO ITALIANO COMPLETO
    if (cleanValue.includes(',') && cleanValue.includes('.')) {
        // Formato: €116,230.00 - Le virgole sono separatori migliaia
        cleanValue = cleanValue.replace(/,/g, '');
    } else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
        // Formato: €116,23 (virgola come decimali)
        cleanValue = cleanValue.replace(',', '.');
    }
    
    // Rimuovi eventuali caratteri rimanenti non numerici eccetto punto e meno
    cleanValue = cleanValue.replace(/[^\d.-]/g, '');
    
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
}

/* ===== RILEVAMENTO AUTOMATICO COLONNE ===== */
function findColumnIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header) {
            const headerStr = header.toString().toLowerCase().trim();
            for (const name of possibleNames) {
                if (headerStr === name.toLowerCase() || 
                    headerStr.includes(name.toLowerCase())) {
                    return i;
                }
            }
        }
    }
    return -1;
}

function detectColumns(headers) {
    const columnMap = {
        ID: findColumnIndex(headers, ['ID', 'id', 'Id']),
        RO_num: findColumnIndex(headers, ['RO_num', 'RO Numero', 'Numero RO', 'RO Number', 'NumRO', 'N. RO']),
        RO_rev: findColumnIndex(headers, ['RO_rev', 'RO Rev', 'Revisione', 'Rev', 'RO_revisione']),
        RO_data: findColumnIndex(headers, ['RO_data', 'RO Data', 'Data RO', 'Date', 'Data', 'Data Creazione']),
        Nazione: findColumnIndex(headers, ['Nazione', 'Nation', 'Country', 'Paese', 'Stato', 'Cliente Nazione']),
        Agente_nome: findColumnIndex(headers, ['Agente_nome', 'Agente Nome', 'Agent', 'Agente', 'Nome Agente', 'Responsabile']),
        Offerta_Valore: findColumnIndex(headers, ['Offerta_Valore', 'Valore Offerta', 'Offer Value', 'Valore', 'Importo', 'Prezzo']),
        Offerta_Esito: findColumnIndex(headers, ['Offerta_Esito', 'Esito Offerta', 'Outcome', 'Esito', 'Status', 'Stato']),
        Valore_Contratto: findColumnIndex(headers, ['Valore_Contratto', 'Contract Value', 'Contratto', 'Valore Contratto', 'Importo Contratto']),
        Offerta_Categoria: findColumnIndex(headers, ['Offerta_Categoria', 'Category', 'Categoria', 'Tipo', 'Settore', 'Prodotto']),
        Offerta_Descrizione: findColumnIndex(headers, ['Offerta_Descrizione', 'Description', 'Descrizione', 'Note', 'Dettagli']),
        Perc_realizzazione: findColumnIndex(headers, ['Perc_realizzazione', 'Percentuale Realizzazione', 'Perc Realizzazione', '% Realizzazione'])
    };
    
    // Log mapping per debug
    Object.entries(columnMap).forEach(([field, index]) => {
        if (index !== -1) {
            console.log(`✅ ${field}: colonna ${index} (${headers[index]})`);
        } else {
            console.log(`❌ ${field}: non trovata`);
        }
    });
    
    return columnMap;
}

/* ===== CREAZIONE RECORD DA RIGA CON MAPPATURA ===== */
function createRecordFromRow(row, columnMap, rowIndex) {
    const rawAgentValue = getColumnValue(row, columnMap.Agente_nome, 'string');
    const rawCategoryValue = getColumnValue(row, columnMap.Offerta_Categoria, 'string');
    
    const record = {
        ID: getColumnValue(row, columnMap.ID, 'number') || rowIndex,
        RO_num: getColumnValue(row, columnMap.RO_num, 'string') || `RO-${rowIndex}`,
        RO_rev: getColumnValue(row, columnMap.RO_rev, 'string') || '01',
        RO_data: formatDate(getColumnValue(row, columnMap.RO_data)),
        Nazione: cleanStringValue(getColumnValue(row, columnMap.Nazione, 'string')) || 'Non specificata',
        
        // APPLICA MAPPATURA AGENTI
        Agente_nome: MAPPING_UTILS.getAgentName(rawAgentValue) || 'Non specificato',
        Agente_codice: rawAgentValue, // Mantieni il codice originale per i filtri
        
        // Salva valore originale per debug
        Offerta_Valore_Original: getColumnValue(row, columnMap.Offerta_Valore, 'raw'),
        Offerta_Valore: parseNumericValue(getColumnValue(row, columnMap.Offerta_Valore, 'raw')),
        
        Offerta_Esito: cleanStringValue(getColumnValue(row, columnMap.Offerta_Esito, 'string')) || 'In corso',
        
        // Salva valore contratto originale per debug  
        Valore_Contratto_Original: getColumnValue(row, columnMap.Valore_Contratto, 'raw'),
        Valore_Contratto: parseNumericValue(getColumnValue(row, columnMap.Valore_Contratto, 'raw')),
        
        // APPLICA MAPPATURA CATEGORIE
        Offerta_Categoria: MAPPING_UTILS.getCategoryName(rawCategoryValue) || 'Non specificata',
        Categoria_codice: rawCategoryValue, // Mantieni il codice originale per i filtri
        
        Offerta_Descrizione: cleanStringValue(getColumnValue(row, columnMap.Offerta_Descrizione, 'string')) || '',
        Perc_realizzazione: getColumnValue(row, columnMap.Perc_realizzazione, 'percentage') || 0
    };
    
    return record;
}

function getColumnValue(row, columnIndex, type = 'string') {
    if (columnIndex === -1 || !row || row[columnIndex] === null || row[columnIndex] === undefined) {
        return null;
    }
    
    let value = row[columnIndex];
    
    // Skip empty strings
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }
    
    // Gestione tipo RAW (per valori monetari)
    if (type === 'raw') {
        return value;
    }
    
    // Gestione tipo percentuale
    if (type === 'percentage') {
        return parsePercentageValue(value);
    }
    
    if (type === 'number') {
        return parseNumericValue(value);
    }
    
    return value;
}

function parsePercentageValue(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    // Se è già un numero tra 0 e 1
    if (typeof value === 'number') {
        if (value <= 1) return value * 100; // Converti in percentuale
        return value; // Già in percentuale
    }
    
    // Converti string in percentuale
    const stringValue = value.toString().trim();
    
    // Rimuovi simbolo % se presente
    const cleanValue = stringValue.replace('%', '');
    const num = parseFloat(cleanValue);
    
    return isNaN(num) ? 0 : num;
}

function cleanStringValue(value) {
    if (!value) return null;
    
    const cleaned = value.toString().trim();
    
    // Skip valori placeholder
    const placeholders = ['-', '--', 'n/a', 'na', 'null', 'undefined', '#N/A', 'N/D'];
    if (placeholders.includes(cleaned.toLowerCase())) {
        return null;
    }
    
    return cleaned || null;
}

function formatDate(dateValue) {
    if (!dateValue) return null;
    
    // Se già in formato ISO
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateValue;
    }
    
    // Escludi date invalide del 1900
    const invalidDates1900 = ['1900-01-01', '1900-01-02', '1900-01-03'];
    if (typeof dateValue === 'string' && invalidDates1900.includes(dateValue)) {
        return null;
    }
    
    // Excel serial date (numero)
    if (typeof dateValue === 'number' && dateValue > 25000 && dateValue < 100000) {
        try {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
            
            if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
                const formattedDate = date.toISOString().split('T')[0];
                
                if (invalidDates1900.includes(formattedDate)) {
                    return null;
                }
                
                return formattedDate;
            }
        } catch (e) {
            console.warn('⚠️ Errore parsing Excel date:', dateValue);
        }
    }
    
    // Prova parsing standard
    try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
            const formattedDate = date.toISOString().split('T')[0];
            
            if (invalidDates1900.includes(formattedDate)) {
                return null;
            }
            
            return formattedDate;
        }
    } catch (e) {
        console.warn('⚠️ Errore parsing date:', dateValue);
    }
    
    return null;
}

/* ===== DEDUPLICAZIONE RO ===== */
function deduplicateRO(records) {
    console.log('🔄 Avvio processo deduplicazione...');
    
    // Raggruppa per RO_num
    const roGroups = {};
    records.forEach(ro => {
        const roNum = ro.RO_num;
        if (!roGroups[roNum]) {
            roGroups[roNum] = [];
        }
        roGroups[roNum].push(ro);
    });
    
    console.log(`📊 RO_num unici trovati: ${Object.keys(roGroups).length}`);
    
    // Processa ogni gruppo per mantenere solo la revisione più alta
    const deduplicatedRecords = [];
    let duplicatesRemoved = 0;
    
    Object.entries(roGroups).forEach(([roNum, group]) => {
        if (group.length === 1) {
            deduplicatedRecords.push(group[0]);
        } else {
            // Mantieni quello con RO_rev più alto
            const sorted = group.sort((a, b) => compareRORevision(b.RO_rev, a.RO_rev));
            const selected = sorted[0];
            const removed = sorted.slice(1);
            
            deduplicatedRecords.push(selected);
            duplicatesRemoved += removed.length;
            
            console.log(`🔄 RO ${roNum}: mantenuto rev ${selected.RO_rev}, rimossi ${removed.length} duplicati`);
        }
    });
    
    // Classificazione: Commerciali vs Normali
    const commerciali = deduplicatedRecords.filter(ro => {
        const roNum = ro.RO_num?.toString() || '';
        return roNum.startsWith('C-');
    }).length;
    
    const normali = deduplicatedRecords.filter(ro => {
        const roNum = ro.RO_num?.toString() || '';
        return !roNum.startsWith('C-');
    }).length;
    
    const stats = {
        normali,
        commerciali,
        total: deduplicatedRecords.length
    };
    
    console.log(`✅ Deduplicazione completata:
        - Record finali: ${deduplicatedRecords.length}
        - RO Normali: ${normali}
        - RO Commerciali: ${commerciali}
        - Duplicati rimossi: ${duplicatesRemoved}`);
    
    return {
        deduplicatedRecords,
        duplicatesRemoved,
        stats
    };
}

function compareRORevision(revA, revB) {
    const normalizeRev = (rev) => {
        if (!rev) return 0;
        
        let revStr = rev.toString().trim();
        
        // Gestisce sia .XX che XX
        if (!revStr.startsWith('.')) {
            revStr = '.' + revStr;
        }
        
        // Estrai i numeri dopo il punto (.10 → 10, .01 → 1, .00 → 0)
        const match = revStr.match(/\.(\d{1,2})/);
        if (!match) return 0;
        
        return parseInt(match[1], 10);
    };
    
    const numA = normalizeRev(revA);
    const numB = normalizeRev(revB);
    
    return numA - numB;
}

/* ===== VALIDAZIONE COLONNE RICHIESTE ===== */
function validateRequiredColumns(columnMap) {
    const required = {
        'RO_num': 'Numero RO'
    };
    
    const recommended = {
        'RO_rev': 'Revisione RO',
        'RO_data': 'Data RO',
        'Perc_realizzazione': 'Percentuale Realizzazione'
    };
    
    const missing = [];
    const missingRecommended = [];
    
    Object.entries(required).forEach(([field, label]) => {
        if (columnMap[field] === -1) {
            missing.push(label);
        }
    });
    
    Object.entries(recommended).forEach(([field, label]) => {
        if (columnMap[field] === -1) {
            missingRecommended.push(label);
        }
    });
    
    if (missing.length > 0) {
        throw new Error(`Colonne obbligatorie mancanti: ${missing.join(', ')}`);
    }
    
    if (missingRecommended.length > 0) {
        console.warn('⚠️ Colonne raccomandate mancanti:', missingRecommended);
        showToast('Colonne mancanti', 
                 `Attenzione: colonne ${missingRecommended.join(', ')} non trovate. Alcune funzionalità potrebbero essere limitate.`, 
                 'warning');
    }
    
    // Verifica almeno una colonna di valore
    const valueColumns = ['Offerta_Valore', 'Valore_Contratto'];
    const hasValueColumn = valueColumns.some(col => columnMap[col] !== -1);
    
    if (!hasValueColumn) {
        console.warn('⚠️ Nessuna colonna di valore trovata');
        showToast('Dati incompleti', 
                 'Nessuna colonna di valore trovata. L\'analisi economica sarà limitata.', 
                 'warning');
    }
}

/* ===== INIZIALIZZAZIONE DASHBOARD ===== */
async function initializeDashboard() {
    console.log('🎛️ Inizializzazione dashboard...');
    
    // Nascondi messaggio no-data
    const noDataMessage = document.getElementById('noDataMessage');
    if (noDataMessage) noDataMessage.style.display = 'none';
    
    // Mostra contenuto dashboard
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) dashboardContent.style.display = 'block';
    
    // Carica moduli necessari
    try {
        const [filterEngine, dashboardEngine] = await Promise.all([
            loadModule('filterEngine'),
            loadModule('dashboardEngine')
        ]);
        
        // Inizializza filtri
        await filterEngine.initializeFilters();
        
        // Prima update dashboard
        STATE.filteredData = [...STATE.roData];
        await dashboardEngine.updateDashboard();
        
        console.log('✅ Dashboard inizializzata con mappatura agenti/categorie');
        
    } catch (error) {
        console.error('❌ Errore inizializzazione dashboard:', error);
        ERROR_LOG.addProcessingError(error);
    }
}

/* ===== UI UTILITY FUNCTIONS ===== */
function resetFileState() {
    STATE.roData = [];
    STATE.filteredData = [];
    CACHE.clear();
    
    STATE.isLoading = true;
    STATE.hasData = false;
    
    hideAllMessages();
}

function hideAllMessages() {
    const messageElements = [
        'fileInfo', 'errorMessage', 'successMessage', 'warningMessage'
    ];
    
    messageElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function showFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        const fileSize = FORMATTERS.fileSize(file.size);
        const loadTime = STATE.performanceMetrics.loadTime;
        const loadTimeText = loadTime ? ` in ${loadTime.toFixed(0)}ms` : '';
        
        fileInfo.innerHTML = `
            ✅ <strong>File caricato:</strong> ${file.name} 
            <span class="file-details">(${fileSize}${loadTimeText})</span>
        `;
        fileInfo.style.display = 'block';
        
        // Auto-hide dopo 10 secondi
        setTimeout(() => {
            if (fileInfo.style.display === 'block') {
                fileInfo.style.opacity = '0.7';
            }
        }, 10000);
    }
}

function showMessage(message, type = 'info') {
    const messageTypes = {
        'success': 'successMessage',
        'error': 'errorMessage', 
        'warning': 'warningMessage',
        'info': 'fileInfo'
    };
    
    const elementId = messageTypes[type] || 'fileInfo';
    const messageElement = document.getElementById(elementId);
    
    if (messageElement) {
        messageElement.innerHTML = message;
        messageElement.style.display = 'block';
        
        // Auto-hide dopo 5 secondi per messaggi non critici
        if (type !== 'error') {
            setTimeout(() => {
                if (messageElement.style.display === 'block') {
                    messageElement.style.opacity = '0.7';
                    setTimeout(() => {
                        messageElement.style.display = 'none';
                        messageElement.style.opacity = '1';
                    }, 2000);
                }
            }, 5000);
        }
    }
}

/* ===== PROGRESS BAR ===== */
function updateProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) {
        progressFill.style.width = `${Math.min(percent, 100)}%`;
        progressFill.style.transition = 'width 0.3s ease';
    }
    if (progressText) progressText.textContent = `${Math.min(percent, 100)}%`;
}

function hideProgress() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 500);
    }
}

/* ===== LOADING STATE ===== */
function showLoadingState(show, message = 'Caricamento...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    const uploadArea = document.getElementById('uploadArea');
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    if (messageEl && message) {
        messageEl.textContent = message;
    }
    
    if (uploadArea) {
        if (show) {
            uploadArea.classList.add('loading');
        } else {
            uploadArea.classList.remove('loading');
        }
    }
    
    STATE.isLoading = show;
}

/* ===== UTILITY DI CLASSIFICAZIONE RO ===== */
export function isROCommerciale(roNum) {
    const roNumStr = roNum?.toString() || '';
    return roNumStr.startsWith('C-');
}

export function isRONormale(roNum) {
    return !isROCommerciale(roNum);
}

/* ===== EXPORT DATA ENGINE ===== */
export default {
    setupFileUpload,
    handleFile,
    triggerFileSelect,
    parseNumericValue,
    isROCommerciale,
    isRONormale
};