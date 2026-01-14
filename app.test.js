const fs = require('fs');
const path = require('path');

// Load the app.js content
const appJsPath = path.join(__dirname, 'public', 'src', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Modify the content to make constants global for testing
appJsContent = appJsContent.replace(/const (COST_\w+|transCosts|textCosts) =/g, 'global.$1 =');

describe('VoiceNote to Email PWA', () => {
  beforeEach(() => {
    // Set up DOM similar to index.html
    document.body.innerHTML = `
      <div id="statusSection"><summary>Status Log</summary><div id="statusLog"></div></div>
      <input id="apiKey" />
      <button id="saveKeyBtn"></button>
      <button id="clearKeyBtn"></button>
      <select id="transModel"><option value="whisper-1">whisper-1</option><option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option></select>
      <select id="textModel"><option value="gpt-4o-mini">gpt-4o-mini</option><option value="gpt-4o">gpt-4o</option></select>
      <select id="styleSelect"><option value="formal">formal</option></select>
      <div id="settingsArea"></div>
      <button id="toggleSettingsBtn"></button>
      <button id="recordBtn"></button>
      <button id="stopBtn"></button>
      <div id="transcriptArea"></div>
      <pre id="transcriptText"></pre>
      <button id="reRecord"></button>
      <button id="useTranscript"></button>
      <button id="copyTranscript"></button>
      <div id="emailArea"></div>
      <pre id="emailText"></pre>
      <button id="copyEmail"></button>
      <button id="tweakEmail"></button>
      <button id="stopTweakBtn"></button>
      <button id="installButton"></button>
      <div id="instructions"></div>
    `;

    // Mock localStorage using spies
    jest.spyOn(window.localStorage, 'getItem');
    jest.spyOn(window.localStorage, 'setItem');
    jest.spyOn(window.localStorage, 'removeItem');

    // Mock navigator.clipboard
    window.navigator.clipboard = {
      writeText: jest.fn().mockResolvedValue()
    };

    // Mock navigator.serviceWorker
    window.navigator.serviceWorker = {
      register: jest.fn().mockResolvedValue({})
    };

    // Mock navigator.mediaDevices
    window.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue({})
    };

    // Mock fetch
    global.fetch = jest.fn();

    // Mock alert
    global.alert = jest.fn();

    // Mock MediaRecorder
    global.MediaRecorder = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive'
    }));

    // Mock Audio
    global.Audio = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn((event, callback) => {
        if (event === 'loadedmetadata') callback();
      }),
      duration: 60 // 1 minute
    }));

    // Mock URL
    global.URL.createObjectURL = jest.fn(() => 'blob:url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock window.addEventListener to avoid beforeinstallprompt issues
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = jest.fn((event, callback) => {
      if (event !== 'beforeinstallprompt') {
        originalAddEventListener.call(window, event, callback);
      }
    });

    // Execute the app.js in global scope
    global.eval(appJsContent);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('cost constants are defined', () => {
    expect(global.COST_WHISPER).toBe(0.006);
    expect(global.COST_GPT_TRANSCRIBE).toBe(0.003);
    expect(global.COST_GPT_MINI).toBe(0.00015);
    expect(global.COST_GPT4).toBe(0.005);
  });

  test('transCosts and textCosts objects are defined', () => {
    expect(global.transCosts).toEqual({
      'whisper-1': 0.006,
      'gpt-4o-mini-transcribe': 0.003
    });
    expect(global.textCosts).toEqual({
      'gpt-4o-mini': 0.00015,
      'gpt-4o': 0.005
    });
  });

  test('addStatus appends message to log', () => {
    global.addStatus('Test message');
    const log = document.getElementById('statusLog');
    expect(log.innerHTML).toContain('Test message');
  });

  test('getApiKey returns key from localStorage', () => {
    window.localStorage.getItem.mockReturnValue('sk-test');
    expect(global.getApiKey()).toBe('sk-test');
  });

  test('getApiKey alerts and returns null if no key', () => {
    window.localStorage.getItem.mockReturnValue(null);
    expect(global.getApiKey()).toBeNull();
    expect(global.alert).toHaveBeenCalledWith('Please enter and save your OpenAI API key first.');
  });

  test('saveKeyBtn saves API key to localStorage', () => {
    const apiKeyInput = document.getElementById('apiKey');
    apiKeyInput.value = 'sk-newkey';
    const saveBtn = document.getElementById('saveKeyBtn');
    saveBtn.click();
    expect(window.localStorage.setItem).toHaveBeenCalledWith('openai_api_key', 'sk-newkey');
    expect(global.alert).toHaveBeenCalledWith('API key saved to browser storage');
  });

  test('clearKeyBtn clears API key from localStorage', () => {
    const clearBtn = document.getElementById('clearKeyBtn');
    clearBtn.click();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('openai_api_key');
    expect(global.alert).toHaveBeenCalledWith('API key cleared');
  });

  test('copyTranscript copies transcript text to clipboard', async () => {
    const transcriptText = document.getElementById('transcriptText');
    transcriptText.textContent = 'Test transcript\nwith lines';
    const copyBtn = document.getElementById('copyTranscript');
    copyBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Test transcript\nwith lines');
    expect(global.alert).toHaveBeenCalledWith('Transcript copied to clipboard');
  });

  test('copyEmail copies email text with normalized line breaks', async () => {
    const emailText = document.getElementById('emailText');
    emailText.textContent = 'Test email\n\nwith extra lines';
    const copyBtn = document.getElementById('copyEmail');
    copyBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Test email\nwith extra lines');
    expect(global.alert).toHaveBeenCalledWith('Email copied to clipboard');
  });

  test('cost calculation for transcription', () => {
    const durationMinutes = 2;
    const cost = global.transCosts['whisper-1'] * durationMinutes;
    expect(cost).toBe(0.012);
  });

  test('cost calculation for text generation', () => {
    const tokens = 2000;
    const cost = (tokens / 1000) * global.textCosts['gpt-4o'];
    expect(cost).toBe(0.01);
  });

  // Additional tests can be added for more complex interactions
});