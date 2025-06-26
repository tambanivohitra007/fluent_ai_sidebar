// renderer.js
// --- Globals & DOM Elements ---
let GEMINI_API_KEY = null;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

let tesseractWorker = null;
let clipboardWatcherInterval = null;
let isOcrReady = false;
let currentCaptureURL = null; 
const IS_WINDOWS = navigator.platform.indexOf('Win') > -1;

// --- DOM Elements ---
const closeBtn = document.getElementById('close-btn');
const inputTextEl = document.getElementById('input-text');
const outputContentEl = document.getElementById('output-content');
const statusTextEl = document.getElementById('status-text');
const loaderEl = document.getElementById('loader');
const historyListEl = document.getElementById('history-list');
const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const historyPanelEl = document.getElementById('history-panel');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// --- Settings Panel Elements ---
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');

// --- FIX: Need to get references to the new UI elements ---
const capturePanel = document.getElementById('capture-panel');
const capturedImagePreview = document.getElementById('captured-image-preview');
const extractTextBtn = document.getElementById('extract-text-btn');
const textInteractionPanel = document.getElementById('text-interaction-panel');
const actionButtons = document.querySelectorAll('#text-interaction-panel .action-btn');


// --- Initialization ---
async function initializeApp() {
    GEMINI_API_KEY = await window.electronAPI.getGeminiApiKey();

    if (!GEMINI_API_KEY) {
        showSettingsPanel();
    } else {
        initializeOcr();
        loadHistory();
    }
}

function showSettingsPanel() {
    settingsPanel.classList.remove('hidden');
    capturePanel.classList.add('hidden');
    textInteractionPanel.classList.add('hidden');
    statusTextEl.textContent = 'API Key required.';
    historyPanelEl.classList.add('hidden');
}

async function initializeOcr() {
    extractTextBtn.disabled = true;

    // On non-Windows platforms, we need to initialize Tesseract.
    if (!IS_WINDOWS) {
        showLoader(true, 'Initializing Tesseract...');
        try {
            tesseractWorker = await Tesseract.createWorker({
                langPath: './tessdata',
                logger: m => console.log(m),
            });
            await tesseractWorker.loadLanguage('eng+fra');
            await tesseractWorker.initialize('eng+fra');
            isOcrReady = true;
            extractTextBtn.disabled = false;
            showLoader(false, 'Ready');
        } catch (error) {
            console.error("Tesseract Init Error:", error);
            showLoader(false, 'Tesseract failed to load.');
        }
    } else {
        // On Windows, the OCR is native, so it's always "ready".
        isOcrReady = true;
        extractTextBtn.disabled = false;
        statusTextEl.textContent = 'Ready (Using Windows OCR)';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});


// --- Event Listeners ---
closeBtn.addEventListener('click', () => window.electronAPI.hideSidebar());

saveApiKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        await window.electronAPI.setGeminiApiKey(key);
        GEMINI_API_KEY = key;
        settingsPanel.classList.add('hidden');
        apiKeyInput.style.borderColor = '';
        initializeOcr();
        loadHistory();
        showOutput('<p class="placeholder">API Key saved. Ready to start.</p>', 'success');
    } else {
        apiKeyInput.style.borderColor = 'red';
    }
});

extractTextBtn.addEventListener('click', async () => {
    if (!currentCaptureURL) return showOutput('No image captured.', 'error');
    if (!isOcrReady) return showOutput('OCR engine is not ready yet.', 'error');
    
    showLoader(true, 'Extracting text...');
    let extractedText = '';
    try {
        if (IS_WINDOWS) {
            extractedText = await window.electronAPI.performNativeOcr(currentCaptureURL);
        } else {
            const { data: { text } } = await tesseractWorker.recognize(currentCaptureURL);
            extractedText = text;
        }
        
        showLoader(false, 'Text extracted.');
        inputTextEl.value = extractedText;

        if (extractedText) {
            capturePanel.classList.add('hidden');
            textInteractionPanel.classList.remove('hidden');
            processWithAI(extractedText, 'explain'); // Auto-explain after extraction
        } else {
            showOutput('Could not find any text.', 'status');
        }

    } catch (error) {
        console.error("OCR Extraction failed:", error);
        showLoader(false, 'OCR Failed.');
        showOutput(`<strong>Error:</strong> ${error.message}`, 'error');
    }
});

actionButtons.forEach(button => {
    button.addEventListener('click', () => {
        const action = button.dataset.action;
        const text = inputTextEl.value;
        if (text) processWithAI(text, action);
    });
});

toggleHistoryBtn.addEventListener('click', () => historyPanelEl.classList.toggle('hidden'));

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history?')) {
        localStorage.removeItem('ai-sidebar-history');
        loadHistory();
    }
});

// --- IPC LISTENERS ---
// This is the primary listener that kicks off the UI flow.
window.electronAPI.onShowCapture(({ dataURL }) => {
    if (!GEMINI_API_KEY) {
        showSettingsPanel();
        showOutput('<strong>Error:</strong> Please set your API key before using the capture feature.', 'error');
        return;
    }
    currentCaptureURL = dataURL;
    capturedImagePreview.src = dataURL;
    
    // Show the capture panel and hide the text panel
    capturePanel.classList.remove('hidden');
    textInteractionPanel.classList.add('hidden');
    outputContentEl.innerHTML = '<p class="placeholder">AI-generated content will appear here.</p>';

    statusTextEl.textContent = 'Image captured. Click to extract text.';
});

window.electronAPI.onClipboardToggle((isEnabled) => {
    if (isEnabled) {
        startClipboardWatcher();
    } else {
        stopClipboardWatcher();
    }
});


// --- Core AI & Helper Functions (Unchanged) ---
async function processWithAI(text, action) {
    if (!GEMINI_API_KEY) {
        showOutput('<strong>Error:</strong> Gemini API key is not configured.', 'error');
        showSettingsPanel();
        return;
    }
    showLoader(true, `AI is thinking...`);
    let userPrompt = "";
    switch (action) {
        case 'explain': userPrompt = `Explain the following text concisely:\n\n"${text}"`; break;
        case 'translate': userPrompt = `Translate the following text to English. If it is already in English, translate it to French:\n\n"${text}"`; break;
        case 'reply': userPrompt = `Draft a polite and professional reply to the following message:\n\n"${text}"`; break;
        case 'rephrase': userPrompt = `Rephrase the following text to be clearer and more professional:\n\n"${text}"`; break;
        case 'answer': userPrompt = `Carefully analyze the following text. It might be a simple question, a multiple-choice question, or an open-ended question. Your task is to provide the most accurate answer possible based on the text.
                    - For multiple-choice questions, identify the correct option.
                    - For direct questions, provide a concise answer.
                    - For open-ended questions, provide a clear and comprehensive response.
                    If the text contains both context and a question, use only the provided context to formulate your answer.
                    Here is the text:
                    "${text}"`; break;
        default: showLoader(false, 'Unknown action.'); return;
    }
    try {
        const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }] })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API request failed: ${errorBody.error.message}`);
        }
        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;
        showOutput(resultText); 
        saveHistory(text, resultText);
    } catch (error) {
        console.error('AI Processing Error:', error);
        showOutput(`<strong>AI Error:</strong><br>${error.message}`, 'error');
    } finally {
        showLoader(false, 'Ready');
    }
}

function showOutput(content, type = 'success') {
    outputContentEl.innerHTML = content.replace(/\n/g, '<br>');
    outputContentEl.style.color = (type === 'error') ? '#ff4d4d' : 'var(--text-color)';
}

function showLoader(visible, text = '') {
    loaderEl.classList.toggle('hidden', !visible);
    statusTextEl.textContent = text;
}

function startClipboardWatcher() {
    if (clipboardWatcherInterval) return;
    console.log('Starting clipboard watcher...');
    statusTextEl.textContent = 'Clipboard watcher active.';
    clipboardWatcherInterval = setInterval(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text !== lastClipboardText) {
                lastClipboardText = text;
                console.log('New clipboard text detected:', text);
                capturePanel.classList.add('hidden');
                textInteractionPanel.classList.remove('hidden');
                inputTextEl.value = text;
                 if (text) processWithAI(text, 'explain');
            }
        } catch (err) {
            // Ignore.
        }
    }, 1000);
}

function stopClipboardWatcher() {
    if (clipboardWatcherInterval) {
        console.log('Stopping clipboard watcher...');
        statusTextEl.textContent = 'Ready';
        clearInterval(clipboardWatcherInterval);
        clipboardWatcherInterval = null;
    }
}

function saveHistory(input, output) {
    let history = JSON.parse(localStorage.getItem('ai-sidebar-history') || '[]');
    history.unshift({ id: Date.now(), input: input.substring(0, 100), fullInput: input, fullOutput: output, timestamp: new Date().toISOString() });
    if (history.length > 50) history.pop();
    localStorage.setItem('ai-sidebar-history', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    let history = JSON.parse(localStorage.getItem('ai-sidebar-history') || '[]');
    historyListEl.innerHTML = history.length ? '' : '<li>No history yet.</li>';
    history.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.textContent = `${new Date(entry.timestamp).toLocaleString()}: ${entry.input}...`;
        li.title = entry.input;
        li.onclick = () => {
            textInteractionPanel.classList.remove('hidden');
            capturePanel.classList.add('hidden');
            inputTextEl.value = entry.fullInput;
            showOutput(entry.fullOutput);
        };
        historyListEl.appendChild(li);
    });
}
