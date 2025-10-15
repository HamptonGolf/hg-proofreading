// Hampton Golf AI Proofreader - Enhanced JavaScript with Premium Features

// Configuration
const CONFIG = {
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
    MAX_TOKENS: 4000,
    API_VERSION: '2023-06-01',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ANIMATION_DURATION: 300,
    AUTO_SAVE_DELAY: 1000
};

// Global variables
let selectedFile = null;
let apiKey = null;
let isProcessing = false;
let currentResults = null;
let characterCount = 0;

// Check if PDF.js is loaded
function checkPDFjsLoaded() {
    return typeof pdfjsLib !== 'undefined';
}

// Wait for PDF.js to load with timeout
function waitForPDFjs(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            if (checkPDFjsLoaded()) {
                clearInterval(checkInterval);
                console.log('✅ PDF.js is ready');
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error('❌ PDF.js loading timeout');
                reject(new Error('PDF.js library failed to load. Please refresh the page.'));
            }
        }, 100);
    });
}

// Hampton Golf Proofreading Guidelines (formatted for Claude)
const PROOFREADING_PROMPT = `Proofread this Hampton Golf document for errors only. Do not check these specific words for capitalization (automated separately): member, guest, neighbor, resident, homeowner, team member.

Find actual mistakes:
- Spelling errors and typos - check every word carefully
- Grammar errors
- Capitalization errors (proper nouns, sentence starts, titles—but NOT the automated words listed above)
- Punctuation errors
- Inconsistent time formatting (e.g., "7AM" in one place, "8 AM" elsewhere—only flag if inconsistent within same document)
- Missing accent marks (e.g., "Remoulade" should be "Rémoulade")

Rules:
- Each error gets ONE bullet point only
- Do not suggest word additions unless they fix grammar/spelling
- Ignore spacing in headers—only flag header misspellings/punctuation

Text:
`;

const PROOFREADING_PROMPT_SUFFIX = `

List only genuine errors found in the text:
- [Specific location] > [Error] should be [Correction]

If no errors: "No errors found."`;

// Initialize application
function initializeApp() {
    console.log('🏌️ Hampton Golf AI Proofreader Initializing...');

    // Check PDF.js status
        if (checkPDFjsLoaded()) {
    console.log('✅ PDF.js is available');
}       else {
    console.warn('⚠️ PDF.js is not yet loaded, will load on demand');
}
    
    // Load saved API key
    loadApiKey();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize UI enhancements
    initializeUIEnhancements();
    
    // Check system status
    updateSystemStatus();
    
    console.log('✅ Application Ready');
}

// Enhanced Event Listeners
function setupEventListeners() {
    // File upload handlers
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (e.target.id !== 'file-input') {
                fileInput.click();
            }
        });
        
        // Enhanced drag and drop with visual feedback
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
    }
    
    // Proofread button
    const proofreadBtn = document.getElementById('proofread-btn');
    if (proofreadBtn) {
        proofreadBtn.addEventListener('click', startProofreading);
        
        // Add hover effect
        proofreadBtn.addEventListener('mouseenter', () => {
            if (!isProcessing) {
                proofreadBtn.classList.add('hover');
            }
        });
        
        proofreadBtn.addEventListener('mouseleave', () => {
            proofreadBtn.classList.remove('hover');
        });
    }
    
    // Text input character counter
    const textInput = document.getElementById('text-input');
    if (textInput) {
        textInput.addEventListener('input', (e) => {
            updateCharacterCount(e.target.value.length);
            autoSaveContent(e.target.value);
        });
        
        // Load auto-saved content
        const savedContent = localStorage.getItem('draft_content');
        if (savedContent) {
            textInput.value = savedContent;
            updateCharacterCount(savedContent.length);
        }
    }
    
    // API key input - Enter key support
    const apiKeyInput = document.getElementById('api-key');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveApiKey();
            }
        });
    }
}

// UI Enhancement Functions
function initializeUIEnhancements() {
    // Add animation classes after page load
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
    
    // Initialize tooltips
    initializeTooltips();
    
    // Set current timestamp
    updateTimestamp();
}

// Character counter
function updateCharacterCount(count) {
    characterCount = count;
    const charCountElement = document.getElementById('char-count');
    if (charCountElement) {
        charCountElement.textContent = `${count.toLocaleString()} characters`;
        
        // Add warning color if approaching typical limits
        if (count > 50000) {
            charCountElement.style.color = 'var(--hg-warning-yellow)';
        } else {
            charCountElement.style.color = '';
        }
    }
}

// Auto-save functionality
let autoSaveTimer;
function autoSaveContent(content) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        localStorage.setItem('draft_content', content);
        showNotification('Draft saved', 'success', 1500);
    }, CONFIG.AUTO_SAVE_DELAY);
}

// System status indicator
function updateSystemStatus() {
    const statusElement = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (statusElement && statusDot) {
        if (apiKey) {
            statusElement.textContent = 'Status: Active';
            statusDot.style.background = 'var(--hg-secondary-green)';
        } else {
            statusElement.textContent = 'API Key Required';
            statusDot.style.background = 'var(--hg-warning-yellow)';
        }
    }
}

// API Key Management with Enhanced Feedback
function saveApiKey() {
    const input = document.getElementById('api-key');
    const key = input.value.trim();
    
    if (!key) {
        showNotification('Please enter a valid API key', 'error');
        shakeElement(input);
        return;
    }
    
    // Validate API key format
    if (!key.startsWith('sk-ant-')) {
        showNotification('Invalid API key format', 'error');
        shakeElement(input);
        return;
    }
    
    // Store in localStorage
    localStorage.setItem('claude_api_key', key);
    apiKey = key;
    
    // Visual success feedback
    input.style.borderColor = 'var(--hg-success-green)';
    const saveBtn = document.querySelector('.api-key-save');
    if (saveBtn) {
        const originalText = saveBtn.querySelector('.button-text').textContent;
        saveBtn.querySelector('.button-text').textContent = 'Activated!';
        saveBtn.classList.add('success');
        
        setTimeout(() => {
            input.style.borderColor = '';
            saveBtn.querySelector('.button-text').textContent = originalText;
            saveBtn.classList.remove('success');
        }, 2000);
    }
    
    // Update system status
    updateSystemStatus();
    
    showNotification('API key activated successfully!', 'success');
}

function loadApiKey() {
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey) {
        apiKey = savedKey;
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.value = savedKey;
        }
        updateSystemStatus();
    }
}

// Enhanced Tab Management
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    const proofreadBtn = document.getElementById('proofread-btn');
    
    // Update button text based on active tab
    if (proofreadBtn) {
        const btnText = proofreadBtn.querySelector('.btn-text');
        if (btnText) {
            if (tab === 'text') {
                btnText.textContent = 'Analyze Text';
            } else if (tab === 'file') {
                btnText.textContent = 'Analyze Document';
            }
        }
    }
    
    // Fade out current tab
    tabs.forEach(t => {
        if (t.classList.contains('active')) {
            t.style.opacity = '0';
            setTimeout(() => {
                t.classList.remove('active');
                t.style.opacity = '';
            }, CONFIG.ANIMATION_DURATION / 2);
        }
    });
    
    // Update button states
    buttons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    
    // Fade in new tab
    setTimeout(() => {
        const targetTab = document.getElementById(`${tab}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.opacity = '0';
            setTimeout(() => {
                targetTab.style.opacity = '1';
            }, 50);
        }
        
        // Update active button
        const clickedBtn = Array.from(buttons).find(btn => 
            btn.textContent.toLowerCase().includes(tab.toLowerCase()) ||
            btn.onclick.toString().includes(`'${tab}'`)
        );
        if (clickedBtn) {
            clickedBtn.classList.add('active');
            clickedBtn.setAttribute('aria-selected', 'true');
        }
    }, CONFIG.ANIMATION_DURATION / 2);
}

// Enhanced File Handling
function handleFileSelect(event) {
    const file = event.target.files[0];
    processFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX >= rect.right || 
        e.clientY < rect.top || e.clientY >= rect.bottom) {
        e.currentTarget.classList.remove('dragover');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    processFile(file);
    
    // Update the file input value to match
    const fileInput = document.getElementById('file-input');
    if (fileInput && file) {
        // Create a FileList-like object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
    }
}

async function processFile(file) {
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'application/pdf') {
        showNotification('Please select a valid PDF file', 'error');
        shakeElement(document.getElementById('upload-area'));
        return;
    }
    
    // Validate file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showNotification(`File size must be less than ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
        return;
    }
    
    // Clear any previous results when new file is attached with animation
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    if (resultsSection && resultsSection.classList.contains('show')) {
        // Animate out
        resultsSection.style.opacity = '0';
        resultsSection.style.transform = 'translateY(30px)';
        resultsSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        // Wait for animation, then clear
        await new Promise(resolve => setTimeout(resolve, 500));
        
        resultsSection.classList.remove('show');
        resultsSection.setAttribute('aria-hidden', 'true');
        resultsSection.style.opacity = '';
        resultsSection.style.transform = '';
        resultsSection.style.transition = '';
        
        if (errorList) {
            errorList.innerHTML = '';
        }
        currentResults = null;
    }
    
    selectedFile = file;
    
    // Update UI
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-info').classList.add('show');
    
    // Add file size info
    const fileSizeInMB = (file.size / 1024 / 1024).toFixed(2);
    const fileInfo = document.querySelector('.file-details');
    if (fileInfo) {
        fileInfo.innerHTML = `
            <strong>Selected file:</strong>
            <span id="file-name" class="file-name">${file.name}</span>
            <span class="file-size">(${fileSizeInMB} MB)</span>
        `;
    }
    
    showNotification(`File "${file.name}" ready for analysis`, 'success');
}

function removeFile() {
    selectedFile = null;
    document.getElementById('file-info').classList.remove('show');
    document.getElementById('file-input').value = '';
    showNotification('File removed', 'info');
}

// Enhanced PDF Processing with Progress
async function extractTextFromPDF(file) {
    return new Promise(async (resolve, reject) => {
        try {
            // First, ensure PDF.js is loaded
            if (!checkPDFjsLoaded()) {
                console.log('⏳ Waiting for PDF.js to load...');
                await waitForPDFjs();
            }
            
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    console.log('📄 Starting PDF extraction...');
                    
                    updateLoadingProgress(10, 'Reading PDF file...');
                    
                    const typedarray = new Uint8Array(e.target.result);
                    console.log('PDF file size:', typedarray.length, 'bytes');
                    
                    // Configure PDF.js to work properly
                    const loadingTask = pdfjsLib.getDocument({
                        data: typedarray,
                        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                        cMapPacked: true,
                        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
                    });
                    
                    const pdf = await loadingTask.promise;
                    console.log('PDF loaded, pages:', pdf.numPages);
                    
                    let fullText = '';
                    
                    updateLoadingProgress(30, 'Extracting text content...');
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const progress = 30 + (50 * (i / pdf.numPages));
                        updateLoadingProgress(progress, `Processing page ${i} of ${pdf.numPages}...`);
                        
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items
                            .map(item => item.str)
                            .join(' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        if (pageText) {
                            fullText += `Page ${i}:\n${pageText}\n\n`;
                        }
                    }
                    
                    updateLoadingProgress(80, 'Text extraction complete...');
                    console.log('✅ PDF text extracted, length:', fullText.length);
                    
                    if (!fullText.trim()) {
                        throw new Error('No text content found in PDF. The PDF might be scanned or image-based.');
                    }
                    
                    resolve(fullText);
                } catch (error) {
                    console.error('❌ PDF extraction error:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                console.error('❌ FileReader error');
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
            
        } catch (error) {
            console.error('❌ PDF.js initialization error:', error);
            reject(error);
        }
    });
}

// Loading Progress Management
function updateLoadingProgress(percentage, message) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText && message) {
        progressText.textContent = message;
    }
}

// Rule-based error detection
function runRulesEngine(text) {
    const errors = [];
    
    // Capitalization rules
    const capitalizeWords = [
        { pattern: /\bmembers?\b/gi, correct: 'Member(s)' },
        { pattern: /\bguests?\b/gi, correct: 'Guest(s)' },
        { pattern: /\bneighbors?\b/gi, correct: 'Neighbor(s)' },
        { pattern: /\bresidents?\b/gi, correct: 'Resident(s)' },
        { pattern: /\bhomeowners?\b/gi, correct: 'Homeowner(s)' },
        { pattern: /\bteam\b/gi, correct: 'Team' },
        { pattern: /\bteam members?\b/gi, correct: 'Team Member(s)' }
    ];
    
    capitalizeWords.forEach(rule => {
    let match;
    const regex = new RegExp(rule.pattern);
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
        let searchRegex = new RegExp(rule.pattern.source, rule.pattern.flags);
        while ((match = searchRegex.exec(line)) !== null) {
            const found = match[0];
            const firstChar = found.charAt(0);
            
            if (firstChar !== firstChar.toUpperCase()) {
                // Get surrounding context (10 chars before and after)
                const start = Math.max(0, match.index - 10);
                const end = Math.min(line.length, match.index + found.length + 10);
                const context = line.substring(start, end).trim();
                
                errors.push({
                    location: `Line ${lineIndex + 1}`,
                    error: `"${found}" in "${context}"`,
                    correction: `"${found.charAt(0).toUpperCase() + found.slice(1)}"`,
                    type: 'capitalization'
                });
            }
        }
    });
});
    
    // Date validation - detect year from document
const datePattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Z][a-z]+)\s+(\d{1,2})/gi;
let dateMatch;

// Try to detect year range or single year from document
const yearRangePattern = /20(\d{2})\s*-\s*20(\d{2})/;
const singleYearPattern = /\b(20\d{2})\b/;

const yearRangeMatch = text.match(yearRangePattern);
let startYear = 2025;
let endYear = 2025;

if (yearRangeMatch) {
    startYear = parseInt('20' + yearRangeMatch[1]);
    endYear = parseInt('20' + yearRangeMatch[2]);
} else {
    const singleYearMatch = text.match(singleYearPattern);
    if (singleYearMatch) {
        startYear = parseInt(singleYearMatch[1]);
        endYear = parseInt(singleYearMatch[1]);
    }
}

while ((dateMatch = datePattern.exec(text)) !== null) {
    const dayName = dateMatch[1];
    const month = dateMatch[2];
    const day = parseInt(dateMatch[3]);
    
    const monthMap = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    
    if (monthMap.hasOwnProperty(month)) {
        const monthNum = monthMap[month];
        
        let correctYear = null;
        let actualDayName = null;
        
        for (let year = startYear; year <= endYear; year++) {
            const date = new Date(year, monthNum, day);
            const testDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            
            if (testDayName === dayName) {
                correctYear = year;
                actualDayName = testDayName;
                break;
            }
        }
        
        if (!correctYear) {
            const date = new Date(startYear, monthNum, day);
            actualDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            
            errors.push({
                location: 'Date check',
                error: `${dayName}, ${month} ${day}`,
                correction: `${actualDayName}, ${month} ${day}`,
                type: 'date'
            });
        }
    }
}
    
    // Staff → Team Member
    const staffPattern = /\bstaff\b/gi;
    if (staffPattern.test(text)) {
        errors.push({
            location: 'Style check',
            error: '"staff"',
            correction: '"Team Member(s)"',
            type: 'style'
        });
    }
    
    return errors;
}

// Main Proofreading Function with Enhanced Error Handling
async function startProofreading() {
    // Clear any previous results first with animation
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    if (resultsSection && resultsSection.classList.contains('show')) {
        // Animate out
        resultsSection.style.opacity = '0';
        resultsSection.style.transform = 'translateY(30px)';
        resultsSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        // Wait for animation, then clear
        await new Promise(resolve => setTimeout(resolve, 500));
        
        resultsSection.classList.remove('show');
        resultsSection.setAttribute('aria-hidden', 'true');
        resultsSection.style.opacity = '';
        resultsSection.style.transform = '';
        resultsSection.style.transition = '';
        
        if (errorList) {
            errorList.innerHTML = '';
        }
        currentResults = null;
    }
    
    if (isProcessing) {
        showNotification('Analysis already in progress', 'warning');
        return;
    }
    
    if (!apiKey) {
        showNotification('Please enter and save your Claude API key first', 'error');
        shakeElement(document.querySelector('.api-key-section'));
        document.getElementById('api-key').focus();
        return;
    }
    
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) {
        showNotification('Please select an input method', 'error');
        return;
    }
    
    let textToProofread = '';
    
    if (activeTab.id === 'text-tab') {
        const textInput = document.getElementById('text-input');
        textToProofread = textInput ? textInput.value.trim() : '';
        
        if (!textToProofread) {
            showNotification('Please enter text to proofread', 'error');
            shakeElement(textInput);
            return;
        }
        
        if (textToProofread.length < 10) {
            showNotification('Please enter at least 10 characters', 'error');
            return;
        }
    } else if (activeTab.id === 'file-tab') {
        if (!selectedFile) {
            showNotification('Please select a PDF file to proofread', 'error');
            shakeElement(document.getElementById('upload-area'));
            return;
        }
        
        try {
            showLoading(true);
            // Scroll to loading section - exact same as clear results
            setTimeout(() => {
                const loadingSection = document.getElementById('loading');
                if (loadingSection) {
                    const rect = loadingSection.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetPosition = scrollTop + rect.top - 100; // Position near top with 100px padding
                    smoothScrollTo(targetPosition, 1000);
                }
            }, 100);
            updateLoadingProgress(0, 'Starting PDF analysis...');
            textToProofread = await extractTextFromPDF(selectedFile);
        } catch (error) {
            showLoading(false);
            showNotification(`Error reading PDF: ${error.message}`, 'error');
            console.error('PDF extraction error:', error);
            return;
        }
    }
    
    if (activeTab.id === 'text-tab') {
        localStorage.removeItem('draft_content');
    }
    
    isProcessing = true;
    showLoading(true);
    
    // Scroll to loading section - exact same as clear results
    setTimeout(() => {
        const loadingSection = document.getElementById('loading');
        if (loadingSection) {
            const rect = loadingSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = scrollTop + rect.top - 100; // Position near top with 100px padding
            smoothScrollTo(targetPosition, 1000);
        }
    }, 100);
    
    hideAllNotifications();
    
    updateLoadingProgress(10, 'Running style checks...');
    const ruleErrors = runRulesEngine(textToProofread);
    
    updateLoadingProgress(30, 'Analyzing with Claude AI...');
    const claudeErrors = await proofreadWithClaude(textToProofread);
    
    const allErrors = [...ruleErrors, ...claudeErrors];
    
    updateLoadingProgress(100, 'Analysis complete!');
    setTimeout(() => {
        displayCombinedResults(allErrors);
        showLoading(false);
        isProcessing = false;
    }, 500);
}

async function proofreadWithClaude(text) {
    const fullPrompt = PROOFREADING_PROMPT + text + PROOFREADING_PROMPT_SUFFIX;
    
    console.log('Analyzing with Claude AI...');
    
    try {
        const response = await fetch('/.netlify/functions/proofread', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                text: fullPrompt,
                apiKey: apiKey,
                model: CONFIG.CLAUDE_MODEL
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('API Response Error:', data);
            let errorMessage = data.error || 'API request failed';
            
            if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your credentials.';
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please try again in a moment.';
            }
            
            throw new Error(errorMessage);
        }
        
        if (!data.content || !data.content[0] || !data.content[0].text) {
            throw new Error('Invalid response format from API');
        }
        
        const resultText = data.content[0].text;
        
        if (resultText.toLowerCase().includes('no errors found')) {
            return [];
        }
        
        const lines = resultText.split('\n');
        const errors = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('-')) {
                const content = trimmedLine.substring(1).trim();
                const parts = content.split('>');
                
                if (parts.length >= 2) {
                    const correctionPart = parts.slice(1).join('>').trim();
                    
                    errors.push({
                        location: parts[0].trim(),
                        error: correctionPart.split(' should be ')[0] ? correctionPart.split(' should be ')[0].trim() : correctionPart,
                        correction: correctionPart,
                        type: 'claude'
                    });
                }
            }
        }
        
        return errors;
        
    } catch (error) {
        console.error('API error:', error);
        showNotification(`Error: ${error.message}`, 'error', 5000);
        return [];
    }
}

    // Enhanced Results Display
    function displayResults(resultText) {
        const resultsSection = document.getElementById('results');
        const errorList = document.getElementById('error-list');
        const errorCount = document.getElementById('error-count');
        const resultsFooter = document.querySelector('.results-footer');
        
        if (!resultsSection || !errorList || !errorCount) {
            console.error('Results elements not found');
            return;
        }
        
        // Store results for export
        currentResults = resultText;
        
        // Update timestamp
        updateTimestamp();
        
        // Check for "No errors found" response first
        if (resultText.toLowerCase().includes('no errors found')) {
            // Clear previous results
            errorList.innerHTML = '';
            
            // Show success state
            const successTemplate = document.getElementById('success-template');
            if (successTemplate) {
                errorList.innerHTML = successTemplate.innerHTML;
            } else {
                errorList.innerHTML = `
                    <div class="no-errors-message">
                        <div class="success-animation">
                            <div class="check-icon">✓</div>
                        </div>
                        <h3>Perfect Score!</h3>
                        <p>Your document meets all Hampton Golf excellence standards</p>
                    </div>
                `;
            }
            
            errorCount.innerHTML = `
                <span class="count-number">0</span>
                <span class="count-label">issues found</span>
            `;
            errorCount.className = 'error-count no-errors';
            
            // Update results footer for no errors (hide copy, show clear)
            if (resultsFooter) {
                resultsFooter.innerHTML = `
                    <div class="export-options">
                        <button class="export-btn clear-btn" onclick="clearResults()" aria-label="Clear results and start over">
                            <span class="export-icon">🔄</span>
                            <span>Clear & Start Over</span>
                        </button>
                    </div>
                `;
                resultsFooter.style.display = 'block';
            }
            
            showNotification('Document analysis complete - Perfect score!', 'success');
        } else {
            // Parse results for errors
            const lines = resultText.split('\n');
            const errors = [];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('-')) {
                    errors.push(trimmedLine.substring(1).trim());
                }
            }
            
            // Clear previous results
            errorList.innerHTML = '';
            
            if (errors.length === 0 || (errors.length === 1 && errors[0] === '')) {
                // No errors found - show success state
                const successTemplate = document.getElementById('success-template');
                if (successTemplate) {
                    errorList.innerHTML = successTemplate.innerHTML;
                } else {
                    errorList.innerHTML = `
                        <div class="no-errors-message">
                            <div class="success-animation">
                                <div class="check-icon">✓</div>
                            </div>
                            <h3>Perfect Score!</h3>
                            <p>Your document meets all Hampton Golf excellence standards</p>
                        </div>
                    `;
                }
                
                errorCount.innerHTML = `
                    <span class="count-number">0</span>
                    <span class="count-label">issues found</span>
                `;
                errorCount.className = 'error-count no-errors';
                
                // Update results footer for no errors (hide copy, show clear)
                if (resultsFooter) {
                    resultsFooter.innerHTML = `
                        <div class="export-options">
                            <button class="export-btn clear-btn" onclick="clearResults()" aria-label="Clear results and start over">
                                <span class="export-icon">🔄</span>
                                <span>Clear & Start Over</span>
                            </button>
                        </div>
                    `;
                    resultsFooter.style.display = 'block';
                }
                
                showNotification('Document analysis complete - Perfect score!', 'success');
            } else {
                // Display errors with enhanced formatting
                errors.forEach((error, index) => {
                    if (!error) return;
                    
                    const parts = error.split('>');
                    const location = parts[0] ? parts[0].trim() : `Issue ${index + 1}`;
                    const description = parts.slice(1).join('>').trim() || error;
                    
                    const li = document.createElement('li');
                    li.className = 'error-item';
                    li.style.animationDelay = `${index * 0.05}s`;
                    li.innerHTML = `
                        <div class="error-number">${index + 1}</div>
                        <div class="error-content">
                            <div class="error-location">${location}</div>
                            <div class="error-description">${description}</div>
                        </div>
                        <button class="error-action" onclick="copyError('${escapeHtml(error)}')" title="Copy this correction">
                            <span class="action-icon">📋</span>
                        </button>
                    `;
                    errorList.appendChild(li);
                });
                
                const validErrors = errors.filter(e => e.trim() !== '');
                errorCount.innerHTML = `
                    <span class="count-number">${validErrors.length}</span>
                    <span class="count-label">issue${validErrors.length === 1 ? '' : 's'} found</span>
                `;
                errorCount.className = 'error-count has-errors';
                
                // Update results footer to show both copy and clear buttons
                if (resultsFooter) {
                    resultsFooter.innerHTML = `
                        <div class="export-options">
                            <button class="export-btn copy-btn" onclick="copyResults()" aria-label="Copy to clipboard">
                                <span class="export-icon">📋</span>
                                <span>Copy Results</span>
                            </button>
                            <button class="export-btn clear-btn" onclick="clearResults()" aria-label="Clear results and start over">
                                <span class="export-icon">🔄</span>
                                <span>Clear & Start Over</span>
                            </button>
                        </div>
                    `;
                    resultsFooter.style.display = 'block';
                }
                
                showNotification(`Analysis complete - ${validErrors.length} issue${validErrors.length === 1 ? '' : 's'} found`, 'info');
            }
        }
        
        // Show results section with animation
        resultsSection.classList.add('show');
        resultsSection.setAttribute('aria-hidden', 'false');
        
        // Smooth scroll to results
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    }

    function displayCombinedResults(errors) {
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    const errorCount = document.getElementById('error-count');
    const resultsFooter = document.querySelector('.results-footer');
    
    if (!resultsSection || !errorList || !errorCount) {
        console.error('Results elements not found');
        return;
    }
    
    currentResults = errors.map(e => `- ${e.location} > ${e.error} should be ${e.correction}`).join('\n');
    
    updateTimestamp();
    
    if (errors.length === 0) {
        const successTemplate = document.getElementById('success-template');
        if (successTemplate) {
            errorList.innerHTML = successTemplate.innerHTML;
        } else {
            errorList.innerHTML = `
                <div class="no-errors-message">
                    <div class="success-animation">
                        <div class="check-icon">✓</div>
                    </div>
                    <h3>Perfect Score!</h3>
                    <p>Your document meets all Hampton Golf excellence standards</p>
                </div>
            `;
        }
        
        errorCount.innerHTML = `
            <span class="count-number">0</span>
            <span class="count-label">issues found</span>
        `;
        errorCount.className = 'error-count no-errors';
        
        // Update results footer for no errors (hide copy, show clear)
        if (resultsFooter) {
            resultsFooter.innerHTML = `
                <div class="export-options">
                    <button class="export-btn clear-btn" onclick="clearResults()" aria-label="Clear results and start over">
                        <span class="export-icon">🔄</span>
                        <span>Clear & Start Over</span>
                    </button>
                </div>
            `;
            resultsFooter.style.display = 'block';
        }
        
        showNotification('Document analysis complete - Perfect score!', 'success');
    } else {
        errorList.innerHTML = '';
        
        errors.forEach((error, index) => {
            const li = document.createElement('li');
            li.className = 'error-item';
            li.style.animationDelay = `${index * 0.05}s`;
            
            // Format description based on error type
            let description;
            if (error.type === 'capitalization' || error.type === 'date' || error.type === 'style') {
                // Rules engine errors: need to add "should be"
                description = `${error.error} should be ${error.correction}`;
            } else {
                // Claude errors: already formatted with "should be"
                description = error.correction;
            }
            
            li.innerHTML = `
                <div class="error-number">${index + 1}</div>
                <div class="error-content">
                    <div class="error-location">${error.location}</div>
                    <div class="error-description">${description}</div>
                </div>
                <button class="error-action" onclick="copyError('${escapeHtml(error.error + ' → ' + error.correction)}')" title="Copy this correction">
                    <span class="action-icon">📋</span>
                </button>
            `;
            errorList.appendChild(li);
        });
        
        errorCount.innerHTML = `
            <span class="count-number">${errors.length}</span>
            <span class="count-label">issue${errors.length === 1 ? '' : 's'} found</span>
        `;
        errorCount.className = 'error-count has-errors';
        
        // Update results footer to show both copy and clear buttons
        if (resultsFooter) {
            resultsFooter.innerHTML = `
                <div class="export-options">
                    <button class="export-btn copy-btn" onclick="copyResults()" aria-label="Copy to clipboard">
                        <span class="export-icon">📋</span>
                        <span>Copy Results</span>
                    </button>
                    <button class="export-btn clear-btn" onclick="clearResults()" aria-label="Clear results and start over">
                        <span class="export-icon">🔄</span>
                        <span>Clear & Start Over</span>
                    </button>
                </div>
            `;
            resultsFooter.style.display = 'block';
        }
        
        showNotification(`Analysis complete - ${errors.length} issue${errors.length === 1 ? '' : 's'} found`, 'info');
    }
    
    resultsSection.classList.add('show');
    resultsSection.setAttribute('aria-hidden', 'false');
    
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

// Export Functions
function exportResults(format) {
    if (!currentResults) {
        showNotification('No results to export', 'error');
        return;
    }
    
    if (format === 'pdf') {
        // Simplified PDF export (in production, use a library like jsPDF)
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Hampton Golf Proofreading Results</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #006600; }
                    .error { margin: 10px 0; padding: 10px; border-left: 3px solid #00B451; }
                </style>
            </head>
            <body>
                <h1>Hampton Golf Proofreading Results</h1>
                <p>Generated: ${new Date().toLocaleString()}</p>
                <hr>
                <pre>${currentResults}</pre>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        showNotification('PDF export opened in new window', 'success');
    } else if (format === 'csv') {
        // Create CSV content
        const csvContent = createCSVFromResults(currentResults);
        downloadFile(csvContent, 'proofreading-results.csv', 'text/csv');
        showNotification('CSV file downloaded', 'success');
    }
}

function copyResults() {
    if (!currentResults) {
        showNotification('No results to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(currentResults).then(() => {
        showNotification('Results copied to clipboard', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy results', 'error');
    });
}

function copyError(errorText) {
    const decoded = decodeHtml(errorText);
    navigator.clipboard.writeText(decoded).then(() => {
        showNotification('Correction copied', 'success', 1500);
    });
}

function clearResults() {
    // Get references to elements
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    const textInput = document.getElementById('text-input');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    
    // First, animate the results section fading out
    if (resultsSection) {
        resultsSection.style.opacity = '0';
        resultsSection.style.transform = 'translateY(30px)';
        resultsSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    }
    
    // After animation completes, clear everything and scroll
    setTimeout(() => {
        // Hide results section
        if (resultsSection) {
            resultsSection.classList.remove('show');
            resultsSection.setAttribute('aria-hidden', 'true');
            resultsSection.style.opacity = '';
            resultsSection.style.transform = '';
            resultsSection.style.transition = '';
        }
        
        // Clear error list
        if (errorList) {
            errorList.innerHTML = '';
        }
        
        // Clear current results
        currentResults = null;
        
        // Clear text input
        if (textInput) {
            textInput.value = '';
            updateCharacterCount(0);
        }
        
        // Clear file input and info
        if (fileInput) {
            fileInput.value = '';
        }
        if (fileInfo) {
            fileInfo.classList.remove('show');
        }
        selectedFile = null;
        
        // Clear draft content from localStorage
        localStorage.removeItem('draft_content');
        
        // Smooth scroll to top using your preferred function
        smoothScrollTo(0, 1000);
        
        // Show notification after scroll starts
        setTimeout(() => {
            showNotification('Results cleared - Ready for new analysis', 'info');
        }, 300);
        
    }, 500); // Wait for fade out animation to complete
}

// Utility Functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    const proofreadBtn = document.getElementById('proofread-btn');
    
    if (!loading) return;
    
    if (show) {
        loading.classList.add('show');
        loading.setAttribute('aria-hidden', 'false');
        if (proofreadBtn) {
            proofreadBtn.disabled = true;
            proofreadBtn.classList.add('loading');
        }
        // Reset progress
        updateLoadingProgress(0, 'Initializing...');
    } else {
        loading.classList.remove('show');
        loading.setAttribute('aria-hidden', 'true');
        if (proofreadBtn) {
            proofreadBtn.disabled = false;
            proofreadBtn.classList.remove('loading');
        }
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    hideAllNotifications();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()" aria-label="Close notification">×</button>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Trigger reflow for animation
    notification.offsetHeight;
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-remove if duration specified
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 500); // Wait for animation to complete
        }, duration);
    }
}

// Smooth scroll function
function smoothScrollTo(targetPosition, duration) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        return;
    }

    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

function hideAllNotifications() {
    document.querySelectorAll('.notification').forEach(n => {
        n.classList.remove('show');
        setTimeout(() => {
            if (n.parentElement) {
                n.remove();
            }
        }, 500);
    });
}

function getNotificationIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'i'
    };
    return icons[type] || icons.info;
}

function shakeElement(element) {
    if (!element) return;
    element.classList.add('shake');
    setTimeout(() => {
        element.classList.remove('shake');
    }, 500);
}

function updateTimestamp() {
    const timestampElement = document.getElementById('results-timestamp');
    if (timestampElement) {
        const now = new Date();
        const options = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        timestampElement.textContent = `Analyzed on ${now.toLocaleDateString('en-US', options)}`;
    }
}

function initializeTooltips() {
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = e.target.title;
            document.body.appendChild(tooltip);
            
            const rect = e.target.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
            
            e.target.dataset.originalTitle = e.target.title;
            e.target.title = '';
            
            setTimeout(() => tooltip.classList.add('show'), 10);
        });
        
        element.addEventListener('mouseleave', (e) => {
            document.querySelectorAll('.tooltip').forEach(t => t.remove());
            if (e.target.dataset.originalTitle) {
                e.target.title = e.target.dataset.originalTitle;
            }
        });
    });
}

function createCSVFromResults(results) {
    const lines = results.split('\n').filter(line => line.trim().startsWith('-'));
    let csv = 'Issue Number,Location,Error,Correction\n';
    
    lines.forEach((line, index) => {
        const cleanLine = line.substring(1).trim();
        const parts = cleanLine.split('>');
        const location = parts[0] ? parts[0].trim() : '';
        const correction = parts.slice(1).join('>').trim() || '';
        
        csv += `${index + 1},"${location}","${correction}",""\n`;
    });
    
    return csv;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Export functions for global access
window.switchTab = switchTab;
window.saveApiKey = saveApiKey;
window.removeFile = removeFile;
window.exportResults = exportResults;
window.copyResults = copyResults;
window.copyError = copyError;
window.clearResults = clearResults;

// Performance monitoring
console.log('📊 Performance:', {
    loadTime: performance.now() + 'ms',
    memory: performance.memory ? 
        Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 
        'N/A'
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
