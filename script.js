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

// Debounce helper for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle helper for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Haptic feedback for mobile interactions
function triggerHapticFeedback(type = 'light') {
    // Check if the device supports haptic feedback
    if (navigator.vibrate) {
        switch(type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(20);
                break;
            case 'heavy':
                navigator.vibrate(30);
                break;
            case 'success':
                navigator.vibrate([10, 50, 10]);
                break;
            case 'error':
                navigator.vibrate([30, 50, 30]);
                break;
        }
    }
}

// Global variables
let selectedFile = null;
let apiKey = null;
let isProcessing = false;
let currentResults = null;
let characterCount = 0;
let lastAnalyzedText = null;
let isReanalyzing = false;

// Calculate estimated time saved by AI proofreading based on project type
function calculateTimeSaved(textLength, errorCount, projectType) {
    let timeSaved = 0;
    
    // Get project type from the dropdown
    const projectTypeValue = projectType || document.getElementById('project-type')?.value || 'other';
    
    // Calculate time saved based on project type and character count
    switch (projectTypeValue) {
        case 'flyer':
            // Flyer: 1-3 minutes
            if (textLength <= 500) {
                timeSaved = 1;
            } else if (textLength <= 1500) {
                timeSaved = 2;
            } else {
                timeSaved = 3;
            }
            break;
            
        case 'menu':
            // Menu: 5-10 minutes
            if (textLength <= 1000) {
                timeSaved = 5;
            } else if (textLength <= 2000) {
                timeSaved = 6;
            } else if (textLength <= 3000) {
                timeSaved = 7;
            } else if (textLength <= 4000) {
                timeSaved = 8;
            } else if (textLength <= 5000) {
                timeSaved = 9;
            } else {
                timeSaved = 10;
            }
            break;
            
        case 'collateral':
            // Collateral Booklet: 10-15 minutes
            if (textLength <= 2000) {
                timeSaved = 10;
            } else if (textLength <= 4000) {
                timeSaved = 11;
            } else if (textLength <= 6000) {
                timeSaved = 12;
            } else if (textLength <= 8000) {
                timeSaved = 13;
            } else if (textLength <= 10000) {
                timeSaved = 14;
            } else {
                timeSaved = 15;
            }
            break;
            
        case 'calendar':
            // Calendar: 3-5 minutes
            if (textLength <= 1000) {
                timeSaved = 3;
            } else if (textLength <= 2500) {
                timeSaved = 4;
            } else {
                timeSaved = 5;
            }
            break;
            
        case 'newsletter':
            // Newsletter: 5-10 minutes
            if (textLength <= 1500) {
                timeSaved = 5;
            } else if (textLength <= 3000) {
                timeSaved = 6;
            } else if (textLength <= 4500) {
                timeSaved = 7;
            } else if (textLength <= 6000) {
                timeSaved = 8;
            } else if (textLength <= 7500) {
                timeSaved = 9;
            } else {
                timeSaved = 10;
            }
            break;
            
        case 'other':
        default:
            // Other: 1-5 minutes
            if (textLength <= 500) {
                timeSaved = 1;
            } else if (textLength <= 1500) {
                timeSaved = 2;
            } else if (textLength <= 3000) {
                timeSaved = 3;
            } else if (textLength <= 5000) {
                timeSaved = 4;
            } else {
                timeSaved = 5;
            }
            break;
    }
    
    // Add bonus time for errors found (30 seconds per error)
    // This represents the time saved not having to find and fix each error manually
    const errorBonus = Math.floor(errorCount * 0.5);
    timeSaved += errorBonus;
    
    // Cap the maximum based on project type to keep it realistic
    const maxTimes = {
        'flyer': 4,
        'menu': 12,
        'collateral': 18,
        'calendar': 6,
        'newsletter': 12,
        'other': 6
    };
    
    const maxTime = maxTimes[projectTypeValue] || 6;
    timeSaved = Math.min(timeSaved, maxTime);
    
    return timeSaved;
}

// Update time saved display
function updateTimeSaved(minutes) {
    const timeSavedBadge = document.getElementById('time-saved-badge');
    const timeSavedValue = document.getElementById('time-saved-value');
    const timeSavedLabel = document.querySelector('.time-label');
    
    if (timeSavedValue) {
        // Animate the number counting up
        let currentValue = 0;
        const increment = Math.ceil(minutes / 20);
        const interval = setInterval(() => {
            currentValue += increment;
            if (currentValue >= minutes) {
                currentValue = minutes;
                clearInterval(interval);
                
                // Update label with correct singular/plural
                if (timeSavedLabel) {
                    timeSavedLabel.textContent = minutes === 1 ? 'Minute Saved' : 'Minutes Saved';
                }
            }
            timeSavedValue.textContent = currentValue;
        }, 30);
    }
    
    if (timeSavedBadge) {
        setTimeout(() => {
            timeSavedBadge.style.opacity = '1';
            timeSavedBadge.style.transform = 'scale(1)';
        }, 100);
    }
}

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

const PROOFREADING_PROMPT = `You are a professional proofreader for Hampton Golf documents. Follow AP Style guidelines.

WHAT TO CHECK:
1. Spelling errors
2. Grammar errors (except in titles)
3. Punctuation following AP Style (missing periods, wrong apostrophes, comma splices, etc.)
4. Improper capitalization (common nouns incorrectly capitalized mid-sentence, missing capitals on proper nouns). Do not flag these specific words regarding capitalization: Member, Guest, Neighbor, Resident, Homeowner, Team Member (system handles this)
5. Missing accent marks certain words (ex: sautéed, rémoulade, purée, entrée, etc.)
6. Time format consistency - if the document uses multiple different time formats (e.g., "7 p.m." and "7pm" and "7:00 PM"), flag each inconsistent usage and suggest matching the dominant format used in the document

DO NOT FLAG:
- Date/day validation like "Wednesday, December 31" (system handles this)
- Stylistic preferences, word choice suggestions, or formatting in titles/headers

IMPORTANT: When in doubt, output the error. I'd rather it be incorrectly flagged than not flagged at all.

FORMAT (REQUIRED):
- [Specific location] > "[exact error]" should be "[exact correction]" | EXPLAIN: [Brief reason]

Examples:
- Page 2, Paragraph 3 > "recieve" should be "receive" | EXPLAIN: Correct spelling is "receive"
- Menu, Entrees > "Remoulade" should be "Rémoulade" | EXPLAIN: French term requires accent
- Paragraph 1 > "it's menu" should be "its menu" | EXPLAIN: Possessive form, no apostrophe
- Event listing > "7pm" should be "7 p.m." | EXPLAIN: Document uses "7 p.m." format throughout; maintain consistency

If no errors: "No errors found."

Document context provided above. Analyze this text:

`;

const PROOFREADING_PROMPT_THOROUGH = `You are conducting a SECOND, more thorough proofread of a Hampton Golf document. Be extra meticulous and catch subtle errors missed in the first pass.

Follow the same guidelines as the first review, but scrutinize every word more carefully.

Do NOT flag: member, guest, neighbor, resident, homeowner, team member capitalization, time formats, or date validation (system handles these).

FORMAT (REQUIRED):
- [Specific location] > "[exact error]" should be "[exact correction]" | EXPLAIN: [Brief reason]

If no errors: "No errors found."

Document context provided above. Re-analyze this text:

`;

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
    
    // Proofread button with haptic feedback
    const proofreadBtn = document.getElementById('proofread-btn');
    if (proofreadBtn) {
        proofreadBtn.addEventListener('click', () => {
            triggerHapticFeedback('medium');
            startProofreading();
        });
        
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
    
    // Text input with debounced character count for performance
    const textInput = document.getElementById('text-input');
    if (textInput) {
        const debouncedUpdate = debounce((e) => {
            updateCharacterCount(e.target.value.length);
        }, 200);
        
        textInput.addEventListener('input', debouncedUpdate);
        
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

// Project type change handler
const projectTypeSelect = document.getElementById('project-type');
if (projectTypeSelect) {
    projectTypeSelect.addEventListener('change', (e) => {
        const additionalContextField = document.getElementById('additional-context');
        const additionalContextLabel = additionalContextField.closest('.context-field').querySelector('.context-label');
        
        if (e.target.value === 'other') {
            // Make additional context required
            additionalContextField.setAttribute('required', 'required');
            
            // Update label to show required
            const optionalSpan = additionalContextLabel.querySelector('.label-optional');
            if (optionalSpan) {
                optionalSpan.innerHTML = '<span class="label-required">*</span>';
            }
            
            // Add red border to indicate required
            if (!additionalContextField.value.trim()) {
                additionalContextField.style.borderColor = 'rgba(220, 53, 69, 0.4)';
            }
            
            // Update placeholder
            additionalContextField.placeholder = 'Please describe the project type and any relevant information...';
        } else {
            // Make additional context optional
            additionalContextField.removeAttribute('required');
            
            // Update label to show optional
            const requiredSpan = additionalContextLabel.querySelector('.label-required');
            if (requiredSpan) {
                requiredSpan.innerHTML = '<span class="label-optional">(Optional)</span>';
            }
            
            // Reset visual styling
            additionalContextField.style.borderColor = '';
            
            // Reset placeholder
            additionalContextField.placeholder = 'Any other relevant information about this text/document (e.g., club-specific capitalization, intentional formatting choices, etc.)...';
        }
    });
}

// Additional context input handler for validation styling with debouncing
const additionalContextField = document.getElementById('additional-context');
if (additionalContextField) {
    const debouncedValidation = debounce((e) => {
        const projectType = document.getElementById('project-type').value;
        
        if (projectType === 'other') {
            if (e.target.value.trim()) {
                // Has content - turn green
                e.target.style.borderColor = 'rgba(0, 180, 81, 0.3)';
            } else {
                // No content - turn red
                e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
            }
        }
    }, 200);
    
    additionalContextField.addEventListener('input', debouncedValidation);
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

// Character counter with debouncing
const updateCharacterCount = debounce((count) => {
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
}, 150);

// Auto-save functionality with debouncing
const autoSaveContent = debounce((content) => {
    localStorage.setItem('draft_content', content);
    showNotification('Draft saved', 'success', 1500);
}, CONFIG.AUTO_SAVE_DELAY);

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

    // Clear context fields when new file is attached
    const projectTypeSelect = document.getElementById('project-type');
    const yearInput = document.getElementById('year-input');
    const additionalContext = document.getElementById('additional-context');

    if (projectTypeSelect) {
        projectTypeSelect.value = '';
    }

    if (yearInput) {
        yearInput.value = '2025'; // Keep default year instead of clearing
    }

    if (additionalContext) {
        additionalContext.value = '';
        additionalContext.removeAttribute('required');
        additionalContext.style.borderColor = '';
        
        // Reset the label back to optional
        const additionalContextLabel = additionalContext.closest('.context-field').querySelector('.context-label');
        const requiredSpan = additionalContextLabel ? additionalContextLabel.querySelector('.label-required') : null;
        if (requiredSpan) {
            requiredSpan.innerHTML = '<span class="label-optional">(Optional)</span>';
        }
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

// Debounced loading progress updates for smoother performance
const updateLoadingProgress = debounce((percent, message) => {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    
    if (progressText && message) {
        progressText.textContent = message;
    }
}, 50);

// Enhanced Rule-based error detection with better accuracy
function runRulesEngine(text) {
    const errors = [];
    
    // Capitalization rules for Hampton Golf brand terms
    const capitalizeWords = [
        { pattern: /\bmembers?\b/gi, correct: 'Member(s)', term: 'Member' },
        { pattern: /\bguests?\b/gi, correct: 'Guest(s)', term: 'Guest' },
        { pattern: /\bneighbors?\b/gi, correct: 'Neighbor(s)', term: 'Neighbor' },
        { pattern: /\bresidents?\b/gi, correct: 'Resident(s)', term: 'Resident' },
        { pattern: /\bhomeowners?\b/gi, correct: 'Homeowner(s)', term: 'Homeowner' },
        { pattern: /\bteam members?\b/gi, correct: 'Team Member(s)', term: 'Team Member' }
    ];
    
    capitalizeWords.forEach(rule => {
        const lines = text.split('\n');
        
        lines.forEach((line, lineIndex) => {
            let searchRegex = new RegExp(rule.pattern.source, rule.pattern.flags);
            let match;
            
            while ((match = searchRegex.exec(line)) !== null) {
                const found = match[0];
                const firstChar = found.charAt(0);
                
                // Only flag if it starts with lowercase
                if (firstChar !== firstChar.toUpperCase()) {
                    const correctedForm = rule.correct.replace('(s)', found.endsWith('s') || found.endsWith('S') ? 's' : '');
                    
                    errors.push({
                        location: `Line ${lineIndex + 1}`,
                        error: found,
                        correction: correctedForm,
                        type: 'capitalization',
                        explanation: `Hampton Golf brand standards require "${rule.term}" to always be capitalized.`
                    });
                }
            }
        });
    });
    
    // Enhanced date validation with multiple format support
    const dateErrors = validateDates(text);
    errors.push(...dateErrors);
    
    // Staff → Team Member check
    const staffPattern = /\bstaff\b/gi;
    const staffMatches = [...text.matchAll(staffPattern)];
    
    if (staffMatches.length > 0) {
        errors.push({
            location: 'Style check',
            error: '"staff"',
            correction: '"Team Member(s)"',
            type: 'style',
            explanation: 'Hampton Golf uses "Team Member(s)" instead of "staff" in all communications.'
        });
    }
    
    // Accent mark check for known words
    const accentErrors = checkMissingAccents(text);
    errors.push(...accentErrors);
    
    return errors;
}

// Enhanced date validation function with multiple format support
function validateDates(text) {
    const errors = [];
    const yearInput = document.getElementById('year-input')?.value?.trim() || '2025';
    
    let startYear, endYear;
    if (yearInput.includes('-')) {
        const years = yearInput.split('-').map(y => parseInt(y.trim()));
        startYear = years[0];
        endYear = years[1];
    } else {
        startYear = endYear = parseInt(yearInput);
    }
    
    // Multiple date format patterns
    const datePatterns = [
        // "Monday, December 31" or "Monday December 31"
        /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi,
        // "December 31, Monday" or "December 31 Monday"  
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
        // "Dec 31, Monday" or "Dec. 31, Monday"
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
        // "Monday, Dec 31" or "Monday Dec. 31"
        /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi
    ];
    
    // Use lowercase keys for case-insensitive matching
    const monthMap = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Process each pattern type
    datePatterns.forEach((pattern, patternIndex) => {
        const matches = [...text.matchAll(pattern)];
        
        matches.forEach(match => {
            // Skip if this is part of a date range like "Saturday & Sunday, May 16"
            // The "&" or "and" before the day name indicates it's the second day in a range
            const fullMatch = match[0];
            const matchIndex = match.index;
            const textBefore = text.substring(Math.max(0, matchIndex - 15), matchIndex);
            
            // Check if there's an "&" or "and" right before this day name
            if (/(&|and)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*$/i.test(textBefore)) {
                return; // Skip this match - it's the second day in a range
            }
            
            let dayName, month, day;
            
            // Parse based on pattern type
            if (patternIndex === 0) {
                // "Monday, December 31"
                dayName = match[1];
                month = match[2];
                day = parseInt(match[3]);
            } else if (patternIndex === 1) {
                // "December 31, Monday"
                month = match[1];
                day = parseInt(match[2]);
                dayName = match[3];
            } else if (patternIndex === 2) {
                // "Dec 31, Monday"
                month = match[1];
                day = parseInt(match[2]);
                dayName = match[3];
            } else if (patternIndex === 3) {
                // "Monday, Dec 31"
                dayName = match[1];
                month = match[2];
                day = parseInt(match[3]);
            }
            
            // Case-insensitive lookup
            const monthNum = monthMap[month.toLowerCase()];
            
            if (monthNum !== undefined && day >= 1 && day <= 31) {
                let correctYear = null;
                let actualDayName = null;
                
                // Check if the day/date combination is correct for any year in range
                for (let year = startYear; year <= endYear; year++) {
                    const date = new Date(year, monthNum, day);
                    const testDayName = dayNames[date.getDay()];
                    
                    // Case-insensitive comparison
                    if (testDayName.toLowerCase() === dayName.toLowerCase()) {
                        correctYear = year;
                        actualDayName = testDayName;
                        break;
                    }
                }
                
                // If no match found in year range, calculate correct day
                if (!correctYear) {
                    const date = new Date(startYear, monthNum, day);
                    actualDayName = dayNames[date.getDay()];
                    
                    // Get full month name for display - case-insensitive lookup
                    const fullMonthNames = {
                        'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
                        'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
                        'sep': 'September', 'sept': 'September', 'oct': 'October', 
                        'nov': 'November', 'dec': 'December',
                        'january': 'January', 'february': 'February', 'march': 'March', 
                        'april': 'April', 'june': 'June', 'july': 'July', 'august': 'August',
                        'september': 'September', 'october': 'October', 'november': 'November', 
                        'december': 'December'
                    };
                    const displayMonth = fullMonthNames[month.toLowerCase()] || month;
                    
                    // Preserve original case for error display
                    const originalDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
                    
                    // Check if this error already exists to prevent duplicates
                    const errorKey = `${originalDayName}, ${displayMonth} ${day}`;
                    const isDuplicate = errors.some(e => e.error === errorKey);
                    
                    if (!isDuplicate) {
                        errors.push({
                            location: 'Date validation',
                            error: `${originalDayName}, ${displayMonth} ${day}`,
                            correction: `${actualDayName}, ${displayMonth} ${day}`,
                            type: 'date',
                            explanation: `In ${startYear}${endYear !== startYear ? `-${endYear}` : ''}, ${displayMonth} ${day} falls on ${actualDayName}, not ${originalDayName}.`
                        });
                    }
                }
            }
        });
    });
    
    return errors;
}

// Check for missing accent marks on known words
function checkMissingAccents(text) {
    const errors = [];
    
    // Database of words that require accents
    const accentWords = {
        'resume': { correct: 'résumé', context: 'CV' },
        'cafe': { correct: 'café' },
        'saute': { correct: 'sauté' },
        'sauteed': { correct: 'sautéed' },
        'remoulade': { correct: 'rémoulade' },
        'aioli': { correct: 'aïoli' },
        'creme': { correct: 'crème' },
        'puree': { correct: 'purée' },
        'purees': { correct: 'purées' },
        'pureed': { correct: 'puréed' },
        'aperitif': { correct: 'apéritif' },
        'consomme': { correct: 'consommé' },
        'pate': { correct: 'pâté' },
        'frappe': { correct: 'frappé' },
        'rose': { correct: 'rosé', context: 'wine' },
        'fiance': { correct: 'fiancé' },
        'fiancee': { correct: 'fiancée' },
        'entree': { correct: 'entrée' },
        'entrees': { correct: 'entrées' },
        'naivete': { correct: 'naïveté' }
    };
    
    // Check each word in our database
    const wordList = Object.keys(accentWords);
    
    for (let i = 0; i < wordList.length; i++) {
        const word = wordList[i];
        const data = accentWords[word];
        
        // Create case-insensitive pattern that matches whole words
        const pattern = new RegExp('\\b' + word + '\\b', 'gi');
        const matches = [...text.matchAll(pattern)];
        
        matches.forEach(match => {
            const found = match[0];
            // Preserve original capitalization
            const isCapitalized = found.charAt(0) === found.charAt(0).toUpperCase();
            const corrected = isCapitalized 
                ? data.correct.charAt(0).toUpperCase() + data.correct.slice(1)
                : data.correct;
            
            errors.push({
                location: 'Accent check',
                error: found,
                correction: corrected,
                type: 'accent',
                explanation: data.context 
                    ? `"${data.correct}" requires accent marks (${data.context} context).`
                    : `"${data.correct}" requires accent marks.`
            });
        });
    }
    
    return errors;
}

async function startProofreading() {
    // Validate context fields first
    const projectType = document.getElementById('project-type').value;
    const yearInput = document.getElementById('year-input').value.trim();
    const additionalContext = document.getElementById('additional-context').value.trim();
    
    // Check required fields
    if (!projectType) {
        showNotification('Please select a project type', 'error');
        shakeElement(document.getElementById('project-type'));
        document.getElementById('project-type').focus();
        return;
    }
    
    if (!yearInput) {
        showNotification('Please enter the applicable year(s)', 'error');
        shakeElement(document.getElementById('year-input'));
        document.getElementById('year-input').focus();
        return;
    }
    
    // Validate year format
    const yearPattern = /^\d{4}(-\d{4})?$/;
    if (!yearPattern.test(yearInput)) {
        showNotification('Please enter a valid year (e.g., 2025) or year range (e.g., 2025-2026)', 'error');
        shakeElement(document.getElementById('year-input'));
        document.getElementById('year-input').focus();
        return;
    }

    // Validate additional context if "Other" is selected
    if (projectType === 'other' && !additionalContext) {
        showNotification('Please provide additional context for "Other" project type', 'error');
        shakeElement(document.getElementById('additional-context'));
        document.getElementById('additional-context').focus();
        return;
    }
    
    // Clear any previous results first with animation
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    if (resultsSection && resultsSection.classList.contains('show')) {
        resultsSection.style.opacity = '0';
        resultsSection.style.transform = 'translateY(30px)';
        resultsSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
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
        
        isProcessing = true;
        showLoading(true, 'text');
        localStorage.removeItem('draft_content');
        
        const loadingSection = document.getElementById('loading');
        if (loadingSection) {
            const rect = loadingSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = scrollTop + rect.top - (window.innerHeight > 900 ? 500 : 350);
            smoothScrollTo(targetPosition, 1500);
        }
        
    } else if (activeTab.id === 'file-tab') {
        if (!selectedFile) {
            showNotification('Please select a PDF file to proofread', 'error');
            shakeElement(document.getElementById('upload-area'));
            return;
        }
        
        try {
            isProcessing = true;
            showLoading(true, 'document');
            updateLoadingProgress(0, 'Starting PDF analysis...');
            
            const loadingSection = document.getElementById('loading');
            if (loadingSection) {
                const rect = loadingSection.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const targetPosition = scrollTop + rect.top - (window.innerHeight > 900 ? 500 : 350);
                smoothScrollTo(targetPosition, 1500);
            }
            
            textToProofread = await extractTextFromPDF(selectedFile);
        } catch (error) {
            showLoading(false);
            isProcessing = false;
            showNotification(`Error reading PDF: ${error.message}`, 'error');
            console.error('PDF extraction error:', error);
            return;
        }
    }
    
    // Build context string for Claude
    const contextString = `Document Type: ${projectType.charAt(0).toUpperCase() + projectType.slice(1)}
Year(s): ${yearInput}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

`;
    
    hideAllNotifications();

    // Check for potential OCR errors
    const ocrAnalysis = analyzeForOCRErrors(textToProofread);
    if (ocrAnalysis.shouldWarn) {
        showNotification(ocrAnalysis.message, 'warning', 5000);
        console.warn('OCR Analysis:', ocrAnalysis);
    }

    // Store the text for potential reanalysis
    lastAnalyzedText = textToProofread;

    updateLoadingProgress(10, 'Running style checks...');
    const ruleErrors = runRulesEngine(textToProofread);

    updateLoadingProgress(30, isReanalyzing ? 'Re-analyzing with extra scrutiny...' : 'Analyzing with Claude AI...');
    const claudeErrors = await proofreadWithClaude(contextString + textToProofread);

    const allErrors = [...ruleErrors, ...claudeErrors];

    updateLoadingProgress(100, 'Analysis complete!');
    setTimeout(() => {
        displayCombinedResults(allErrors);
        showLoading(false);
        isProcessing = false;
        isReanalyzing = false; // Reset the flag after analysis
    }, 500);
}

async function proofreadWithClaude(text) {
    // Use thorough prompt if this is a reanalysis
    const promptToUse = isReanalyzing ? PROOFREADING_PROMPT_THOROUGH : PROOFREADING_PROMPT;
    const fullPrompt = promptToUse + text;
    
    console.log(isReanalyzing ? 'Re-analyzing with extra scrutiny...' : 'Analyzing with Claude AI...');
    
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
        
        // Check for "no errors found" response
        if (resultText.toLowerCase().includes('no errors found')) {
            return [];
        }
        
        // Parse Claude's response with multiple format support
        const errors = parseClaudeErrors(resultText);
        
        return errors;
        
    } catch (error) {
        console.error('API error:', error);
        showNotification(`Error: ${error.message}`, 'error', 5000);
        return [];
    }
}

// Enhanced error parsing with support for multiple Claude response formats
function parseClaudeErrors(resultText) {
    const errors = [];
    const lines = resultText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Only process lines that start with bullet point
        if (!trimmedLine.startsWith('-')) {
            continue;
        }
        
        const content = trimmedLine.substring(1).trim();
        
        // Try multiple parsing strategies
        let parsed = null;
        
        // Strategy 1: Standard format with EXPLAIN
        // Format: [location] > "error" should be "correction" | EXPLAIN: explanation
        parsed = parseFormat1(content);
        
        // Strategy 2: Without EXPLAIN section
        // Format: [location] > "error" should be "correction"
        if (!parsed) {
            parsed = parseFormat2(content);
        }
        
        // Strategy 3: Arrow format
        // Format: [location] > "error" → "correction"
        if (!parsed) {
            parsed = parseFormat3(content);
        }
        
        // Strategy 4: Change format
        // Format: [location] > Change "error" to "correction"
        if (!parsed) {
            parsed = parseFormat4(content);
        }
        
        if (parsed) {
            errors.push({
                location: parsed.location,
                error: parsed.error,
                correction: parsed.correction,
                type: 'claude',
                explanation: parsed.explanation || ''
            });
        } else {
            // Log unparseable lines for debugging
            console.warn('Could not parse error line:', content);
        }
    }
    
    return errors;
}

// Parse format: [location] > "error" should be "correction" | EXPLAIN: explanation
function parseFormat1(content) {
    const explainSplit = content.split(' | EXPLAIN: ');
    if (explainSplit.length < 2) {
        return null;
    }
    
    const errorInfo = explainSplit[0];
    const explanation = explainSplit[1];
    
    const parts = errorInfo.split('>');
    if (parts.length < 2) {
        return null;
    }
    
    const location = parts[0].trim();
    const correctionPart = parts.slice(1).join('>').trim();
    
    // Match "X should be Y" pattern
    const match = correctionPart.match(/"([^"]+)"\s+should\s+be\s+"([^"]+)"/);
    if (!match) {
        // Try without quotes
        const match2 = correctionPart.match(/(.+?)\s+should\s+be\s+(.+)/);
        if (!match2) {
            return null;
        }
        
        return {
            location: location,
            error: match2[1].replace(/^["']|["']$/g, '').trim(),
            correction: match2[2].replace(/^["']|["']$/g, '').trim(),
            explanation: explanation.trim()
        };
    }
    
    return {
        location: location,
        error: match[1].trim(),
        correction: match[2].trim(),
        explanation: explanation.trim()
    };
}

// Parse format: [location] > "error" should be "correction" (no EXPLAIN)
function parseFormat2(content) {
    const parts = content.split('>');
    if (parts.length < 2) {
        return null;
    }
    
    const location = parts[0].trim();
    const correctionPart = parts.slice(1).join('>').trim();
    
    // Match "X should be Y" pattern
    const match = correctionPart.match(/"([^"]+)"\s+should\s+be\s+"([^"]+)"/);
    if (!match) {
        // Try without quotes
        const match2 = correctionPart.match(/(.+?)\s+should\s+be\s+(.+)/);
        if (!match2) {
            return null;
        }
        
        return {
            location: location,
            error: match2[1].replace(/^["']|["']$/g, '').trim(),
            correction: match2[2].replace(/^["']|["']$/g, '').trim(),
            explanation: ''
        };
    }
    
    return {
        location: location,
        error: match[1].trim(),
        correction: match[2].trim(),
        explanation: ''
    };
}

// Parse format: [location] > "error" → "correction"
function parseFormat3(content) {
    const parts = content.split('>');
    if (parts.length < 2) {
        return null;
    }
    
    const location = parts[0].trim();
    const correctionPart = parts.slice(1).join('>').trim();
    
    // Match arrow format
    const match = correctionPart.match(/"([^"]+)"\s*[→–-]\s*"([^"]+)"/);
    if (!match) {
        return null;
    }
    
    return {
        location: location,
        error: match[1].trim(),
        correction: match[2].trim(),
        explanation: ''
    };
}

// Parse format: [location] > Change "error" to "correction"
function parseFormat4(content) {
    const parts = content.split('>');
    if (parts.length < 2) {
        return null;
    }
    
    const location = parts[0].trim();
    const correctionPart = parts.slice(1).join('>').trim();
    
    // Match "Change X to Y" pattern
    const match = correctionPart.match(/[Cc]hange\s+"([^"]+)"\s+to\s+"([^"]+)"/);
    if (!match) {
        return null;
    }
    
    return {
        location: location,
        error: match[1].trim(),
        correction: match[2].trim(),
        explanation: ''
    };
}

// Analyze text for potential OCR errors and calculate confidence score
function analyzeForOCRErrors(text) {
    let ocrScore = 100; // Start at 100, deduct points for suspicious patterns
    const suspiciousPatterns = [];
    
    // Pattern 1: "rn" that might be "m"
    const rnPattern = /\brn\b/gi;
    const rnMatches = [...text.matchAll(rnPattern)];
    if (rnMatches.length > 0) {
        ocrScore -= Math.min(rnMatches.length * 5, 15);
        suspiciousPatterns.push(`"rn" patterns detected (${rnMatches.length})`);
    }
    
    // Pattern 2: lowercase "l" before uppercase letter (might be "I")
    const lBeforeCaps = /\bl(?=[A-Z])/g;
    const lMatches = [...text.matchAll(lBeforeCaps)];
    if (lMatches.length > 2) {
        ocrScore -= Math.min(lMatches.length * 3, 10);
        suspiciousPatterns.push(`"l" before capitals (${lMatches.length})`);
    }
    
    // Pattern 3: "0" (zero) in the middle of words
    const zeroInWord = /\b\w*0\w+\b/g;
    const zeroMatches = [...text.matchAll(zeroInWord)];
    if (zeroMatches.length > 0) {
        ocrScore -= Math.min(zeroMatches.length * 5, 15);
        suspiciousPatterns.push(`Zero in words (${zeroMatches.length})`);
    }
    
    // Pattern 4: Multiple spaces (common in OCR)
    const multiSpace = /\s{3,}/g;
    const spaceMatches = [...text.matchAll(multiSpace)];
    if (spaceMatches.length > 5) {
        ocrScore -= 10;
        suspiciousPatterns.push(`Multiple spaces (${spaceMatches.length})`);
    }
    
    // Pattern 5: Strange punctuation combinations
    const strangePunct = /[.,;]{2,}/g;
    const punctMatches = [...text.matchAll(strangePunct)];
    if (punctMatches.length > 0) {
        ocrScore -= Math.min(punctMatches.length * 5, 10);
        suspiciousPatterns.push(`Repeated punctuation (${punctMatches.length})`);
    }
    
    // Pattern 6: Very short "words" that might be OCR fragments
    const words = text.split(/\s+/);
    const singleCharWords = words.filter(w => w.length === 1 && /[a-z]/i.test(w));
    if (singleCharWords.length > 10) {
        ocrScore -= 10;
        suspiciousPatterns.push(`Many single characters (${singleCharWords.length})`);
    }
    
    // Ensure score doesn't go below 0
    ocrScore = Math.max(0, ocrScore);
    
    return {
        confidence: ocrScore,
        shouldWarn: ocrScore < 70,
        patterns: suspiciousPatterns,
        message: ocrScore < 70 
            ? `This text may contain OCR errors (confidence: ${ocrScore}%). Please verify the source document is clear.`
            : null
    };
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
                            <div class="check-icon"></div>
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
            
            // Update results footer for no errors (show reanalyze and clear)
                if (resultsFooter) {
                    resultsFooter.innerHTML = `
                        <div class="export-options">
                            <button class="export-btn reanalyze-btn" onclick="reanalyze()" aria-label="Reanalyze with more scrutiny">
                                <span class="export-icon">🔍</span>
                                <span>Reanalyze</span>
                            </button>
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
                                <div class="check-icon"></div>
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
                
                // Update results footer for no errors (show reanalyze and clear)
                if (resultsFooter) {
                    resultsFooter.innerHTML = `
                        <div class="export-options">
                            <button class="export-btn reanalyze-btn" onclick="reanalyze()" aria-label="Reanalyze with more scrutiny">
                                <span class="export-icon">🔍</span>
                                <span>Reanalyze</span>
                            </button>
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
    
    // Store results in clean format for copying
    currentResults = errors.map(e => `- ${e.location} > "${e.error}" should be "${e.correction}"`).join('\n');
    
    updateTimestamp();
    
    // Calculate and display time saved
    const textInput = document.getElementById('text-input');
    const textLength = textInput && textInput.value ? textInput.value.length : characterCount;
    const projectType = document.getElementById('project-type')?.value || 'other';
    const timeSaved = calculateTimeSaved(textLength, errors.length, projectType);
    updateTimeSaved(timeSaved);
    
    if (errors.length === 0) {
        const successTemplate = document.getElementById('success-template');
        if (successTemplate) {
            errorList.innerHTML = successTemplate.innerHTML;
        } else {
            errorList.innerHTML = `
                <div class="no-errors-message">
                    <div class="success-animation">
                        <div class="check-icon"></div>
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
        
        // Update results footer for no errors (show reanalyze and clear)
                if (resultsFooter) {
                    resultsFooter.innerHTML = `
                        <div class="export-options">
                            <button class="export-btn reanalyze-btn" onclick="reanalyze()" aria-label="Reanalyze with more scrutiny">
                                <span class="export-icon">🔍</span>
                                <span>Reanalyze</span>
                            </button>
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
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        // Sort errors by priority: date > capitalization > accent > style > claude > consistency
        const typePriority = {
            'date': 1,
            'capitalization': 2,
            'accent': 3,
            'style': 4,
            'claude': 5,
            'consistency': 6
        };
        
        errors.sort((a, b) => {
            const priorityA = typePriority[a.type] || 99;
            const priorityB = typePriority[b.type] || 99;
            return priorityA - priorityB;
        });
        
        errors.forEach((error, index) => {
            const li = document.createElement('li');
            li.className = 'error-item';
            li.style.animationDelay = `${index * 0.05}s`;
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            li.setAttribute('aria-label', `View details for error ${index + 1}`);
            
            // Format description based on error type
            let description;
            if (error.type === 'capitalization' || error.type === 'date' || error.type === 'style') {
                // Rules engine errors: format consistently
                description = `"${error.error}" should be "${error.correction}"`;
            } else {
                // Claude errors: format consistently
                description = `"${error.error}" should be "${error.correction}"`;
            }
            
            li.innerHTML = `
                <div class="error-number">${index + 1}</div>
                <div class="error-content">
                    <div class="error-location">${error.location}</div>
                    <div class="error-description">${description}</div>
                </div>
                <button class="error-action" onclick="event.stopPropagation(); copyError('${escapeHtml(error.error + ' → ' + error.correction)}')" title="Copy this correction">
                    <span class="action-icon">📋</span>
                </button>
            `;
            
            // Add click handler to open modal
            li.addEventListener('click', () => {
                openErrorModal(error, index + 1);
            });
            
            // Add keyboard support
            li.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openErrorModal(error, index + 1);
                }
            });
            
            fragment.appendChild(li);
        });
        
        // Append all at once for better performance
        errorList.appendChild(fragment);
        
        errorCount.innerHTML = `
            <span class="count-number">${errors.length}</span>
            <span class="count-label">issue${errors.length === 1 ? '' : 's'} found</span>
        `;
        errorCount.className = 'error-count has-errors';
        
        // Update results footer to show copy, reanalyze, and clear buttons
        if (resultsFooter) {
            resultsFooter.innerHTML = `
                <div class="export-options">
                    <button class="export-btn copy-btn" onclick="copyResults()" aria-label="Copy to clipboard">
                        <span class="export-icon">📋</span>
                        <span>Copy Results</span>
                    </button>
                    <button class="export-btn reanalyze-btn" onclick="reanalyze()" aria-label="Reanalyze with more scrutiny">
                        <span class="export-icon">🔍</span>
                        <span>Reanalyze</span>
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

// Smooth scroll to results after a short delay for the show animation
setTimeout(() => {
    const rect = resultsSection.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Adjust scroll position based on number of errors
    let offset;
    if (errors.length === 0) {
        // No errors - scroll normally to show success message
        offset = window.innerHeight > 900 ? 150 : 30;
    } else if (errors.length === 1) {
        // Single error - stop a bit earlier to avoid slam
        offset = window.innerHeight > 900 ? 350 : 100;
    } else if (errors.length === 2) {
        // Two errors - moderate offset
        offset = window.innerHeight > 900 ? 250 : 50;
    } else {
        // Many errors - normal scroll
        offset = window.innerHeight > 900 ? 30 : 30;
    }
    
    const targetPosition = scrollTop + rect.top - offset;
    
    // Only scroll if we actually need to
    if (Math.abs(targetPosition - scrollTop) > 100) {
        smoothScrollTo(targetPosition, 1000);
    }
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
    
    // Filter to only include lines that are actual errors (start with '- ')
    const lines = currentResults.split('\n');
    const errorLines = lines.filter(line => line.trim().startsWith('-'));
    
    // If no error lines found, currentResults might be in a different format
    if (errorLines.length === 0) {
        showNotification('No errors to copy', 'error');
        return;
    }
    
    const cleanedResults = errorLines.join('\n');
    
    navigator.clipboard.writeText(cleanedResults).then(() => {
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
    
    // Reset context fields (but keep year as 2025)
    const projectTypeSelect = document.getElementById('project-type');
    const yearInput = document.getElementById('year-input');
    const additionalContext = document.getElementById('additional-context');

    if (projectTypeSelect) {
        projectTypeSelect.value = '';
    }

    if (yearInput) {
        yearInput.value = '2025'; // Keep default year instead of clearing
    }

    if (additionalContext) {
        additionalContext.value = '';
        additionalContext.removeAttribute('required');
        additionalContext.style.borderColor = '';
        additionalContext.placeholder = 'Any other relevant information about this text/document (e.g., club-specific capitalization, intentional formatting choices, etc.)...';
        
        // Reset the label back to optional
        const additionalContextLabel = additionalContext.closest('.context-field').querySelector('.context-label');
        const requiredSpan = additionalContextLabel.querySelector('.label-required');
        if (requiredSpan) {
            requiredSpan.innerHTML = '<span class="label-optional">(Optional)</span>';
        }
    }
    
    // Check if mobile device
    const isMobile = window.innerWidth <= 768;
    
    if (resultsSection && resultsSection.classList.contains('show')) {
        if (isMobile) {
            // MOBILE: Use GPU-accelerated animation for 60fps
            resultsSection.classList.add('clearing');
            
            // Use RAF to ensure smooth animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resultsSection.classList.add('clearing-active');
                });
            });
            
            // Clean up after animation completes
            setTimeout(() => {
                resultsSection.classList.remove('show', 'clearing', 'clearing-active');
                resultsSection.setAttribute('aria-hidden', 'true');
                
                if (errorList) {
                    errorList.innerHTML = '';
                }
                
                currentResults = null;
                
                if (textInput) {
                    textInput.value = '';
                    updateCharacterCount(0);
                }
                
                if (fileInput) {
                    fileInput.value = '';
                }
                if (fileInfo) {
                    fileInfo.classList.remove('show');
                }
                selectedFile = null;
                
                localStorage.removeItem('draft_content');
                
                requestAnimationFrame(() => {
                    smoothScrollTo(0, 800);
                    
                    setTimeout(() => {
                        showNotification('Results cleared - Ready for new analysis', 'info');
                    }, 200);
                });
                
            }, 600); // Match CSS animation duration
            
        } else {
            // DESKTOP: Keep original animation (it works fine)
            const currentHeight = resultsSection.offsetHeight;
            
            resultsSection.style.height = currentHeight + 'px';
            resultsSection.style.overflow = 'hidden';
            
            // Force reflow
            resultsSection.offsetHeight;
            
            // Animate to zero height
            resultsSection.style.transition = 'height 0.8s ease-out, opacity 0.6s ease-out, transform 0.6s ease-out';
            resultsSection.style.height = '0px';
            resultsSection.style.opacity = '0';
            resultsSection.style.transform = 'translateY(30px)';
            resultsSection.style.marginBottom = '0';
            resultsSection.style.paddingTop = '0';
            resultsSection.style.paddingBottom = '0';
            
            setTimeout(() => {
                resultsSection.classList.remove('show');
                resultsSection.setAttribute('aria-hidden', 'true');
                resultsSection.style.height = '';
                resultsSection.style.opacity = '';
                resultsSection.style.transform = '';
                resultsSection.style.transition = '';
                resultsSection.style.overflow = '';
                resultsSection.style.marginBottom = '';
                resultsSection.style.paddingTop = '';
                resultsSection.style.paddingBottom = '';
                
                if (errorList) {
                    errorList.innerHTML = '';
                }
                
                currentResults = null;
                
                if (textInput) {
                    textInput.value = '';
                    updateCharacterCount(0);
                }
                
                if (fileInput) {
                    fileInput.value = '';
                }
                if (fileInfo) {
                    fileInfo.classList.remove('show');
                }
                selectedFile = null;
                
                localStorage.removeItem('draft_content');
                
                setTimeout(() => {
                    smoothScrollTo(0, 1000);
                    
                    setTimeout(() => {
                        showNotification('Results cleared - Ready for new analysis', 'info');
                    }, 300);
                }, 200);
                
            }, 800);
        }
    } else {
        // If results aren't showing, just clear everything immediately
        currentResults = null;
        if (textInput) {
            textInput.value = '';
            updateCharacterCount(0);
        }
        if (fileInput) {
            fileInput.value = '';
        }
        if (fileInfo) {
            fileInfo.classList.remove('show');
        }
        selectedFile = null;
        localStorage.removeItem('draft_content');
        showNotification('Ready for new analysis', 'info');
    }
}

// Reanalyze the last document/text with more thorough checking
async function reanalyze() {
    if (!lastAnalyzedText) {
        showNotification('No previous analysis found to reanalyze', 'error');
        return;
    }
    
    if (isProcessing) {
        showNotification('Analysis already in progress', 'warning');
        return;
    }
    
    if (!apiKey) {
        showNotification('Please enter and save your Claude API key first', 'error');
        return;
    }
    
    // Set the reanalysis flag
    isReanalyzing = true;
    
    // Get context information
    const projectType = document.getElementById('project-type').value;
    const yearInput = document.getElementById('year-input').value.trim();
    const additionalContext = document.getElementById('additional-context').value.trim();
    
    // Build context string
    const contextString = `Document Type: ${projectType.charAt(0).toUpperCase() + projectType.slice(1)}
Year(s): ${yearInput}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

`;
    
    // Clear previous results with animation
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    if (resultsSection && resultsSection.classList.contains('show')) {
        resultsSection.style.opacity = '0';
        resultsSection.style.transform = 'translateY(30px)';
        resultsSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
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
    
    isProcessing = true;
    showLoading(true, 'document');
    
    const loadingSection = document.getElementById('loading');
    if (loadingSection) {
        const rect = loadingSection.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = scrollTop + rect.top - (window.innerHeight > 900 ? 500 : 350);
        smoothScrollTo(targetPosition, 1500);
    }
    
    hideAllNotifications();
    
    updateLoadingProgress(10, 'Running enhanced style checks...');
    const ruleErrors = runRulesEngine(lastAnalyzedText);
    
    updateLoadingProgress(30, 'Re-analyzing with extra scrutiny...');
    const claudeErrors = await proofreadWithClaude(contextString + lastAnalyzedText);
    
    const allErrors = [...ruleErrors, ...claudeErrors];
    
    updateLoadingProgress(100, 'Thorough re-analysis complete!');
    setTimeout(() => {
        displayCombinedResults(allErrors);
        showLoading(false);
        isProcessing = false;
        isReanalyzing = false;
    }, 500);
}

function showLoading(show, type = 'document') {
    const loading = document.getElementById('loading');
    const proofreadBtn = document.getElementById('proofread-btn');
    const loadingText = document.querySelector('.loading-text');
    
    if (!loading) return;
    
    if (show) {
        // Update text based on type
        if (loadingText) {
            loadingText.textContent = type === 'text' ? 'Analyzing Your Text' : 'Analyzing Your Document';
        }
        
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
    // Trigger haptic feedback for mobile
    if (type === 'success') {
        triggerHapticFeedback('success');
    } else if (type === 'error') {
        triggerHapticFeedback('error');
    }
    
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

// Optimized smooth scroll function with reduced motion support
function smoothScrollTo(targetPosition, duration = 1000) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (isIOS || prefersReducedMotion) {
        window.scrollTo({
            top: targetPosition,
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
        return;
    }

    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        
        const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        window.scrollTo(0, startPosition + (distance * ease(progress)));
        
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        }
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
    // Use event delegation for better performance
    let activeTooltip = null;
    
    document.body.addEventListener('mouseover', (e) => {
        const element = e.target.closest('[title]');
        if (!element || element === activeTooltip?.element) return;
        
        // Remove any existing tooltip first
        if (activeTooltip) {
            if (activeTooltip.tooltip && activeTooltip.tooltip.parentNode) {
                activeTooltip.tooltip.remove();
            }
            if (activeTooltip.element && activeTooltip.element.dataset.originalTitle) {
                activeTooltip.element.title = activeTooltip.element.dataset.originalTitle;
                delete activeTooltip.element.dataset.originalTitle;
            }
        }
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip show';
        tooltip.textContent = element.title;
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        tooltip.style.left = rect.left + scrollLeft + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top + scrollTop - tooltip.offsetHeight - 10 + 'px';
        
        element.dataset.originalTitle = element.title;
        element.title = '';
        
        activeTooltip = { tooltip, element };
    });
    
    document.body.addEventListener('mouseout', (e) => {
        const element = e.target.closest('[title], [data-original-title]');
        if (!element || !activeTooltip || activeTooltip.element !== element) return;
        
        // Only remove if we're actually leaving the element (not entering a child)
        if (!element.contains(e.relatedTarget)) {
            if (activeTooltip.tooltip && activeTooltip.tooltip.parentNode) {
                activeTooltip.tooltip.remove();
            }
            if (element.dataset.originalTitle) {
                element.title = element.dataset.originalTitle;
                delete element.dataset.originalTitle;
            }
            activeTooltip = null;
        }
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

// Error Modal Functions
let currentModalError = null;

function openErrorModal(error, errorNumber) {
    currentModalError = error;
    const modal = document.getElementById('error-modal');
    
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    
    // Populate modal content
    document.getElementById('modal-location').textContent = error.location;
    document.getElementById('modal-error').textContent = error.error;
    document.getElementById('modal-correction').textContent = error.correction;
    document.getElementById('modal-explanation').textContent = generateExplanation(error);
    
    // Show modal
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Add click handler to overlay
    const overlay = modal.querySelector('.error-modal-overlay');
    overlay.onclick = closeErrorModal;
    
    // Add escape key handler
    document.addEventListener('keydown', handleModalEscape);
}

function closeErrorModal() {
    const modal = document.getElementById('error-modal');
    
    if (modal) {
        const content = modal.querySelector('.error-modal-content');
        
        // Add closing animation
        if (content) {
            content.classList.add('closing');
        }
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = ''; // Restore scrolling
            
            // Remove closing class for next time
            if (content) {
                content.classList.remove('closing');
            }
            
            // Remove escape key handler
            document.removeEventListener('keydown', handleModalEscape);
        }, 300); // Match animation duration
    }
    
    currentModalError = null;
}

function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeErrorModal();
    }
}

function copyCorrection() {
    if (!currentModalError) return;
    
    const correctionText = currentModalError.correction;
    navigator.clipboard.writeText(correctionText).then(() => {
        showNotification('Correction copied to clipboard', 'success', 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy correction', 'error');
    });
}

function generateExplanation(error) {
    // Generate contextual explanations based on error type
    switch (error.type) {
        case 'capitalization':
            return `Hampton Golf brand standards require that terms like "Member," "Guest," "Neighbor," "Resident," "Homeowner," and "Team Member" are always capitalized. This maintains consistency across all communications and reinforces the premium nature of our community and service.`;
        
        case 'date':
            return `The day of the week doesn't match the date provided. This error was caught by cross-referencing the stated date with the actual calendar for the year(s) you specified. Incorrect dates can cause confusion for members and guests planning their schedules.`;
        
        case 'style':
            if (error.error.toLowerCase().includes('staff')) {
                return `Hampton Golf uses "Team Member(s)" instead of "staff" in all communications. This terminology better reflects our culture of service excellence and the collaborative nature of our organization.`;
            }
            return `This doesn't align with Hampton Golf's style guidelines and brand voice. Consistent terminology helps maintain our professional image and ensures clear communication.`;
        
        case 'claude':
            // Use Claude's custom explanation if available
            if (error.explanation && error.explanation.length > 0) {
                return error.explanation;
            }
            
            // Fallback to generic explanations if Claude didn't provide one
            if (error.location.toLowerCase().includes('spelling')) {
                return `This appears to be a spelling error. Correct spelling is essential for maintaining professionalism and credibility in all Hampton Golf communications.`;
            } else if (error.location.toLowerCase().includes('grammar')) {
                return `This is a grammatical error that affects the clarity and professionalism of the document. Proper grammar ensures your message is understood correctly by all readers.`;
            } else if (error.location.toLowerCase().includes('punctuation')) {
                return `Punctuation errors can change the meaning of sentences and affect readability. Correct punctuation ensures your message is clear and professional.`;
            } else if (error.correction.toLowerCase().includes('accent')) {
                return `Proper accent marks are important for accurate spelling, especially in culinary terms and proper nouns. They show attention to detail and respect for the correct presentation of words.`;
            } else {
                return `This issue was identified by AI analysis of your document. The suggested correction will improve the accuracy, clarity, or professionalism of your content according to Hampton Golf standards.`;
            }
        
        default:
            return `This issue may affect the clarity, accuracy, or professionalism of your document. The suggested correction aligns with Hampton Golf's quality standards and best practices for communications.`;
    }
}

// Export functions for global access
window.switchTab = switchTab;
window.saveApiKey = saveApiKey;
window.removeFile = removeFile;
window.exportResults = exportResults;
window.copyResults = copyResults;
window.copyError = copyError;
window.clearResults = clearResults;
window.reanalyze = reanalyze;
window.openErrorModal = openErrorModal;
window.closeErrorModal = closeErrorModal;
window.copyCorrection = copyCorrection;

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
