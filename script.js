// Hampton Golf AI Proofreader - Complete JavaScript

// Configuration
const CONFIG = {
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    CLAUDE_MODEL: 'claude-3-haiku-20240307',
    MAX_TOKENS: 4000,
    API_VERSION: '2023-06-01'
};

// Global variables
let selectedFile = null;
let apiKey = null;

// Hampton Golf Proofreading Guidelines (formatted for Claude)
const PROOFREADING_PROMPT = `You are a proofreader for Hampton Golf. You MUST find and report ALL errors in the text below.

STEP 1 - CHECK THESE WORDS WHEREVER THEY APPEAR:
Find EVERY instance of these words and verify capitalization:
- "member" → MUST be "Member" (capital M)
- "membership" → MUST be "Membership" (except in email addresses)
- "guest" → MUST be "Guest" (capital G)
- "neighbor" → MUST be "Neighbor" (capital N)
- "homeowner" → MUST be "Homeowner" (capital H)
- "team" → MUST be "Team" (capital T)
- "team member" → MUST be "Team Member" (both capitals)
- "staff" → MUST be replaced with "Team Member(s)"
- "club" → Only capitalize if part of club name (e.g., "Palencia Club" = yes, "the club" = no)

STEP 2 - CHECK SPELLING OF EVERY WORD:
Look for ANY misspelled words including but not limited to:
- State names (California not Califonia)
- Wine terms (Cabernet not Carbet)
- Common typos

STEP 3 - CHECK FOREIGN WORDS:
ANY French, Spanish, or Italian words MUST have proper accents:
- Rose → Rosé
- Aime → Aimé  
- Remoulade → Rémoulade
- Cafe → Café
- Resume → Résumé

STEP 4 - CHECK COMPOUND WORDS:
- "blackcurrant" = one word (the fruit)
- "black currant" = WRONG if referring to the fruit flavor
- Compound adjectives need hyphens: "pear-drop aromas" not "pear drop aromas"

STEP 5 - CHECK CONSISTENCY:
- If "7AM" appears anywhere, ALL times must be "7AM" (no space)
- If "7 AM" appears anywhere, ALL times must be "7 AM" (with space)
- State abbreviations must be consistent

INSTRUCTIONS:
1. Read EVERY SINGLE WORD in the document
2. You MUST report errors even if document seems professional
3. Check the ENTIRE document - do not stop early
4. Even well-formatted documents have errors - find them

Report EACH error like this:
- [Location] > [Error description with correction]

Example outputs:
- Line 3 > "member" should be "Member"
- Wine list, Red wines section > "Califonia" should be "California"
- Page 2 > "Rose" should be "Rosé" (add accent)
- Paragraph 4 > "staff" should be replaced with "Team Members"

START CHECKING HERE:
`;

function initializeApp() {
    // Load saved API key
    loadApiKey();
    
    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // File upload
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            // Prevent triggering when clicking on the file input itself
            if (e.target.id !== 'file-input') {
                fileInput.click();
            }
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
    }
    
    // Proofread button
    const proofreadBtn = document.getElementById('proofread-btn');
    if (proofreadBtn) {
        proofreadBtn.addEventListener('click', startProofreading);
    }
}

// API Key Management
function saveApiKey() {
    const input = document.getElementById('api-key');
    const key = input.value.trim();
    
    if (!key) {
        showError('Please enter a valid API key');
        return;
    }
    
    // Store in localStorage (in production, consider more secure storage)
    localStorage.setItem('claude_api_key', key);
    apiKey = key;
    
    // Visual feedback
    input.style.borderColor = 'var(--hg-success-green)';
    setTimeout(() => {
        input.style.borderColor = '';
    }, 2000);
    
    alert('API key saved successfully!');
}

function loadApiKey() {
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey) {
        apiKey = savedKey;
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.value = savedKey;
        }
    }
}

// Tab Management
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(t => t.classList.remove('active'));
    buttons.forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(`${tab}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Find and activate the clicked button
    const clickedBtn = Array.from(buttons).find(btn => 
        btn.textContent.toLowerCase().includes(tab.toLowerCase())
    );
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
}

// File Handling
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
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    processFile(file);
}

function processFile(file) {
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        showError('Please select a valid PDF file');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB');
        return;
    }
    
    selectedFile = file;
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-info').classList.add('show');
}

// PDF Processing
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // Check if pdfjsLib is loaded
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF.js library not loaded. Please refresh the page.');
                }
                
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
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
                
                if (!fullText.trim()) {
                    throw new Error('No text content found in PDF. The PDF might be scanned or image-based.');
                }
                
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Main Proofreading Function
async function startProofreading() {
    // Check API key
    if (!apiKey) {
        showError('Please enter and save your Claude API key first');
        return;
    }
    
    // Get content to proofread
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) {
        showError('Please select an input method');
        return;
    }
    
    let textToProofread = '';
    
    if (activeTab.id === 'text-tab') {
        const textInput = document.getElementById('text-input');
        textToProofread = textInput ? textInput.value.trim() : '';
        
        if (!textToProofread) {
            showError('Please enter text to proofread');
            return;
        }
    } else if (activeTab.id === 'file-tab') {
        if (!selectedFile) {
            showError('Please select a PDF file to proofread');
            return;
        }
        
        try {
            showLoading(true);
            textToProofread = await extractTextFromPDF(selectedFile);
        } catch (error) {
            showLoading(false);
            showError(`Error reading PDF: ${error.message}`);
            console.error('PDF extraction error:', error);
            return;
        }
    }
    
    // Call Claude API
    proofreadWithClaude(textToProofread);
}

async function proofreadWithClaude(text) {
    showLoading(true);
    hideError();
    
    const fullPrompt = PROOFREADING_PROMPT + text;
    
    // TEMPORARY: Let's see exactly what text Claude receives
    console.log('=== EXACT TEXT BEING SENT TO CLAUDE ===');
    console.log(fullPrompt);
    console.log('=== END OF EXACT TEXT ===');
    
    // Also create a simple test
    const testText = "This document mentions a member and a guest at the club.";
    console.log('TEST: If Claude was checking correctly, in this text:');
    console.log(testText);
    console.log('It should find: "member" should be "Member", "guest" should be "Guest"');
    
    try {
        // Call Netlify function instead of Claude API directly
        const response = await fetch('/.netlify/functions/proofread', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                text: fullPrompt,
                apiKey: apiKey
            })
        });
        
        const data = await response.json();
        
        console.log('=== RESPONSE FROM NETLIFY FUNCTION ===');
        console.log('Response status:', response.status);
        console.log('Response data:', data);
        
        if (!response.ok) {
            console.error('Response not OK:', data);
            let errorMessage = data.error || 'API request failed';
            if (data.details) {
                console.error('Error details:', data.details);
            }
            throw new Error(errorMessage);
        }
        
        // Check if we have the expected response structure
        if (!data.content || !data.content[0] || !data.content[0].text) {
            console.error('Unexpected response structure:', data);
            console.log('data.content exists?', !!data.content);
            console.log('data.content[0] exists?', !!(data.content && data.content[0]));
            console.log('data.content[0].text exists?', !!(data.content && data.content[0] && data.content[0].text));
            throw new Error('Invalid response format from API. Check console for details.');
        }
        
        const proofreadingResults = data.content[0].text;
        console.log('=== CLAUDE RESULTS ===');
        console.log('Results text length:', proofreadingResults.length);
        console.log('Full results:', proofreadingResults);
        
        displayResults(proofreadingResults);
        
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('API error:', error);
    } finally {
        showLoading(false);
    }
}

// Results Display
function displayResults(resultText) {
    const resultsSection = document.getElementById('results');
    const errorList = document.getElementById('error-list');
    const errorCount = document.getElementById('error-count');
    
    if (!resultsSection || !errorList || !errorCount) {
        console.error('Results elements not found');
        return;
    }
    
    // Parse results (each line starting with "-" is an error)
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
        // No errors found
        errorList.innerHTML = `
            <div class="no-errors-message">
                <div class="check-icon">✓</div>
                <h3>Document looks great!</h3>
                <p>No errors were found according to Hampton Golf style guidelines.</p>
            </div>
        `;
        errorCount.textContent = 'No issues found';
        errorCount.className = 'error-count no-errors';
    } else {
        // Display errors
        errors.forEach((error, index) => {
            if (!error) return; // Skip empty lines
            
            // Try to parse location and description
            const parts = error.split('>');
            const location = parts[0] ? parts[0].trim() : `Error ${index + 1}`;
            const description = parts.slice(1).join('>').trim() || error;
            
            const li = document.createElement('li');
            li.className = 'error-item';
            li.innerHTML = `
                <div class="error-location">${location}</div>
                <div class="error-description">${description}</div>
            `;
            errorList.appendChild(li);
        });
        
        const validErrors = errors.filter(e => e.trim() !== '');
        errorCount.textContent = `${validErrors.length} issue${validErrors.length === 1 ? '' : 's'} found`;
        errorCount.className = 'error-count has-errors';
    }
    
    // Show results section
    resultsSection.classList.add('show');
    
    // Scroll to results smoothly
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// UI Helper Functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (!loading) return;
    
    if (show) {
        loading.classList.add('show');
        // Disable proofread button while loading
        const proofreadBtn = document.getElementById('proofread-btn');
        if (proofreadBtn) {
            proofreadBtn.disabled = true;
        }
    } else {
        loading.classList.remove('show');
        // Re-enable proofread button
        const proofreadBtn = document.getElementById('proofread-btn');
        if (proofreadBtn) {
            proofreadBtn.disabled = false;
        }
    }
}

function showError(message) {
    // Remove existing error if present
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message show';
    errorDiv.textContent = message;
    
    // Find where to insert the error
    const inputSection = document.querySelector('.input-section');
    if (inputSection) {
        inputSection.appendChild(errorDiv);
    } else {
        // Fallback: add to body if input section not found
        document.body.appendChild(errorDiv);
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 300);
    }, 5000);
}

function hideError() {
    const errorMessage = document.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.classList.remove('show');
        setTimeout(() => {
            if (errorMessage.parentNode) {
                errorMessage.remove();
            }
        }, 300);
    }
}

// Utility function to format date
function getCurrentDate() {
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    return now.toLocaleDateString('en-US', options);
}

// Export functions for global access
window.switchTab = switchTab;
window.saveApiKey = saveApiKey;

// Add console log for debugging
console.log('Hampton Golf Proofreader loaded successfully');

console.log('Current date for reference:', getCurrentDate());










