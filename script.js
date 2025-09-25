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
const PROOFREADING_PROMPT = `You are a professional proofreader for Hampton Golf. Review the text below and identify ALL errors according to these guidelines:

CAPITALIZATION RULES - CHECK EVERY INSTANCE:
1. ALWAYS capitalize: "Member", "Membership" (except in email addresses), "Guest", "Neighbor", "Homeowner", "Team", "Team Member"
2. Replace ALL instances of "staff" with "Team Member(s)"
3. "Club" - capitalize ONLY when part of actual club name (e.g., "Northland Country Club" = capitalize, "the club" = lowercase)
4. Job titles - capitalize ONLY for specific named person (e.g., "Joe Williams, Superintendent" = capitalize, "all superintendents" = lowercase)
5. "Golf Course" - capitalize ONLY with specific course name
6. Room names - capitalize ONLY when specific/unique (e.g., "Fireside Dining Room" = capitalize, "dining room" = lowercase)
7. "Company" - capitalize ONLY when part of specific company name
8. Department names - capitalize ONLY when before program name
9. NEVER capitalize these unless proper nouns: golf course, golf shop, clubhouse, tournament formats (scramble, best ball), caddie, pool, courts, driving range, practice facility, community, passholder, swim center

COMPREHENSIVE STYLE RULES:
1. Verify ALL dates (if text says "Wednesday, March 5", confirm March 5 is actually Wednesday using 2024/2025 calendar)
2. Check spacing consistency throughout document (if "7AM" appears, ALL times should be "7AM" not "8 AM")
3. Hyphenation: compound adjectives before nouns need hyphens (e.g., "18-hole course" but "course is 18 holes")
4. Remove hyphens from: "18-holes" or "9-holes" when used as standalone nouns
5. Check ALL accent marks on foreign words (café, résumé, née, fiancé, résumé, Rémoulade, rosé, etc.)
6. Verify spelling of ALL words - watch for common errors and typos
7. Apply AP Style for punctuation and grammar
8. Check brand names for exact spelling and punctuation
9. Verify state names and abbreviations are consistent
10. Check that compound words vs separate words are correct (e.g., "email" not "e-mail", specific to context)

THOROUGH CHECKING INSTRUCTIONS:
- Examine EVERY occurrence of the capitalization trigger words listed above
- Do NOT assume any word is correct - verify each one
- Check headers but only flag spelling/punctuation errors in headers
- Look for inconsistent formatting patterns
- Verify proper nouns are capitalized correctly
- Check for missing or incorrect punctuation
- Identify grammatical errors
- Flag any word that appears misspelled
- Ensure consistency in style choices throughout

CRITICAL: You must check the ENTIRE document word by word. Do not skip any sections. Every instance of the words in the capitalization rules MUST be checked.

OUTPUT FORMAT - Use ONLY this format:
- [Location] > [Specific correction]

Examples:
- Page 2, Paragraph 3 > Capitalize "member" → "Member"  
- Hours Section > Remove hyphen from "18-holes" → "18 holes"
- Wine List > Add accent: "Rose" → "Rosé"
- Third paragraph > Spelling: "Carbet" → "Cabernet"

TEXT TO PROOFREAD:
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
            if (e.target === uploadArea || uploadArea.contains(e.target)) {
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
    
    // Add timestamp to make each request unique
    const timestamp = new Date().toISOString();
    const fullPrompt = PROOFREADING_PROMPT + text + `\n\n=== END OF DOCUMENT (Timestamp: ${timestamp}) ===`;
    
    console.log('=== SENDING TO CLAUDE ===');
    console.log('Timestamp:', timestamp);
    console.log('Document text preview:', text.substring(0, 500));
    
    try {
        const response = await fetch('/.netlify/functions/proofread', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',  // Prevent caching
            },
            body: JSON.stringify({
                text: fullPrompt,
                apiKey: apiKey
            })
        });
        
        // Rest of the function remains the same...
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Response not OK:', data);
            let errorMessage = data.error || 'API request failed';
            if (data.details) {
                console.error('Error details:', data.details);
            }
            throw new Error(errorMessage);
        }
        
        if (!data.content || !data.content[0] || !data.content[0].text) {
            console.error('Unexpected response structure:', data);
            throw new Error('Invalid response format from API.');
        }
        
        const proofreadingResults = data.content[0].text;
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







