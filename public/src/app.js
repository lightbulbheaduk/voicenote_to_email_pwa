const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const statusLog = document.getElementById('statusLog');
const statusSection = document.getElementById('statusSection');
const transcriptArea = document.getElementById('transcriptArea');
const transcriptText = document.getElementById('transcriptText');
const reRecordBtn = document.getElementById('reRecord');
const useTranscriptBtn = document.getElementById('useTranscript');
const copyTranscriptBtn = document.getElementById('copyTranscript');
const emailArea = document.getElementById('emailArea');
const emailText = document.getElementById('emailText');
const copyEmailBtn = document.getElementById('copyEmail');
const tweakEmailBtn = document.getElementById('tweakEmail');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const clearKeyBtn = document.getElementById('clearKeyBtn');
const transModelEl = document.getElementById('transModel');
const textModelEl = document.getElementById('textModel');
const styleSelect = document.getElementById('styleSelect');
const settingsArea = document.getElementById('settingsArea');
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');

const COST_WHISPER = 0.006; // per minute
const COST_GPT_TRANSCRIBE = 0.003; // per minute
const COST_GPT_MINI = 0.00015; // per 1K tokens
const COST_GPT4 = 0.005; // per 1K tokens

const transCosts = {
  'whisper-1': COST_WHISPER,
  'gpt-4o-mini-transcribe': COST_GPT_TRANSCRIBE
};

const textCosts = {
  'gpt-4o-mini': COST_GPT_MINI,
  'gpt-4o': COST_GPT4
};

function addStatus(message) {
  const logEntry = document.createElement('div');
  logEntry.textContent = new Date().toLocaleTimeString() + ': ' + message;
  statusLog.appendChild(logEntry);
  statusLog.scrollTop = statusLog.scrollHeight;
  const summary = statusSection.querySelector('summary');
  summary.textContent = 'Status Log: ' + message;
}

let deferredInstallEvent;
const installButton = document.getElementById('installButton');
const instructionsSection = document.getElementById('instructions');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallEvent = e;
  installButton.style.display = 'block';
});

installButton.addEventListener('click', () => {
  if (deferredInstallEvent) {
    deferredInstallEvent.prompt();
    deferredInstallEvent = null;
    installButton.style.display = 'none';
    instructionsSection.style.display = 'none'; // Hide after install attempt
  }
});

toggleSettingsBtn.addEventListener('click', () => {
  const collapsed = settingsArea.classList.toggle('collapsed');
  toggleSettingsBtn.textContent = collapsed ? 'Show Settings' : 'Hide Settings';
});

let mediaRecorder;
let currentStream;
let recordTimeout;
let tweakRecorder;
let tweakStream;
let tweakTimeout;
let recordedChunks = [];



// Load API key from localStorage on page load
window.addEventListener('load', () => {
  const stored = localStorage.getItem('openai_api_key');
  if (stored) {
    apiKeyInput.value = stored;
    recordBtn.disabled = false;
  } else {
    recordBtn.disabled = true;
  }
  addStatus('App loaded, idle');
});

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert('Please enter an API key');
    return;
  }
  localStorage.setItem('openai_api_key', key);
  recordBtn.disabled = false;
  alert('API key saved to browser storage');
});

clearKeyBtn.addEventListener('click', () => {
  localStorage.removeItem('openai_api_key');
  apiKeyInput.value = '';
  recordBtn.disabled = true;
  alert('API key cleared');
});

function getApiKey() {
  const key = localStorage.getItem('openai_api_key');
  if (!key) {
    alert('Please enter and save your OpenAI API key first.');
    return null;
  }
  return key;
}

async function ensureMicPermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (err) {
    console.error('microphone permission denied', err);
    alert('Microphone permission is required.');
    return false;
  }
}

recordBtn.addEventListener('click', async () => {
  addStatus('Requesting microphone permission...');
  const ok = await ensureMicPermission();
  if (!ok) {
    addStatus('Microphone permission denied');
    return;
  }
  addStatus('Microphone ready, starting recording...');
  recordedChunks = [];
  currentStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // <--- store stream globally
  mediaRecorder = new MediaRecorder(currentStream);
  mediaRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });
  mediaRecorder.addEventListener('stop', onRecordingStop);
  mediaRecorder.start();
  addStatus('Recording...');
  recordBtn.disabled = true;
  stopBtn.disabled = false;

  // Auto-stop after 5 minutes (300000ms)
  recordTimeout = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  }, 300000);
});

stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
});

async function onRecordingStop() {
  clearTimeout(recordTimeout);
  addStatus('Recording stopped, processing audio...');
  recordBtn.disabled = false;
  stopBtn.disabled = true;

  if (currentStream) { // <--- stop tracks after recording is done
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  // belt and braces
  navigator.mediaDevices.getUserMedia({ audio: false });

  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  await new Promise(resolve => { audio.onloadedmetadata = resolve; });
  const durationMinutes = audio.duration / 60;
  URL.revokeObjectURL(audioUrl);
  
  // Transcribe audio using OpenAI API directly
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

    addStatus('Sending audio for transcription...');
    const form = new FormData();
    form.append('file', blob, 'voice.webm');
    form.append('model', transModelEl.value);

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });

    const j = await resp.json();
    if (resp.ok) {
      transcriptText.textContent = j.text || '';
      transcriptArea.hidden = false;
      const transCost = transCosts[transModelEl.value] * durationMinutes;
      addStatus(`Transcription complete, cost: $${transCost.toFixed(4)}`);
    } else {
      addStatus('Transcription failed');
      alert('Transcription error: ' + (j.error?.message || JSON.stringify(j)));
    }
  } catch (err) {
    console.error(err);
    addStatus('Transcription failed');
    alert('Transcription failed: ' + err.message);
  }
}

reRecordBtn.addEventListener('click', () => {
  transcriptArea.hidden = true;
  transcriptText.textContent = '';
  recordedChunks = [];
  addStatus('Reset, idle');
});

useTranscriptBtn.addEventListener('click', async () => {
  const transcript = transcriptText.textContent.trim();
  if (!transcript) return alert('No transcript present');
  addStatus('Generating email...');
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const prompt = `Style: ${styleSelect.value}\n\nNotes:\n${transcript}`;
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: textModelEl.value,
        messages: [
          { role: 'system', content: 'You are an assistant that rewrites user notes into a clean, professional email. Apply the tweak instructions to improve the previous email. Use headings, paragraphs, bullet points and a sign-off when appropriate, but pay close attention to the style specified and if marked as informal, ensure it is informal.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800
      })
    });

    const j = await resp.json();
    if (resp.ok) {
      const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      emailText.textContent = text;
      emailArea.hidden = false;
      const usage = j.usage;
      const tokens = usage.total_tokens;
      const costPer1K = textCosts[textModelEl.value];
      const textCost = (tokens / 1000) * costPer1K;
      addStatus(`Email generated, cost: $${textCost.toFixed(4)}`);
    } else {
      addStatus('Generation failed');
      alert('Generation error: ' + (j.error?.message || JSON.stringify(j)));
    }
  } catch (err) {
    console.error(err);
    addStatus('Generation failed');
    alert('Generation failed: ' + err.message);
  }
});

copyEmailBtn.addEventListener('click', async () => {
  const text = emailText.textContent.replace(/\n\s*\n/g, '\n').trim();
  try {
    await navigator.clipboard.writeText(text);
    alert('Email copied to clipboard');
  } catch (err) {
    console.error(err);
    alert('Copy failed: ' + err.message);
  }
});

copyTranscriptBtn.addEventListener('click', async () => {
  const text = transcriptText.textContent.replace(/\n\s*\n/g, '\n').trim();
  try {
    await navigator.clipboard.writeText(text);
    alert('Transcript copied to clipboard');
  } catch (err) {
    console.error(err);
    alert('Copy failed: ' + err.message);
  }
});

tweakEmailBtn.addEventListener('click', async () => {
  addStatus('Requesting microphone for tweak...');
  const ok = await ensureMicPermission();
  if (!ok) {
    addStatus('Microphone permission denied for tweak');
    return;
  }

  if (tweakRecorder && tweakRecorder.state === 'recording') {
    alert('Tweak recording already in progress.');
    return;
  }

  addStatus('Starting tweak recording...');
  recordedChunks = [];
  tweakStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  tweakRecorder = new MediaRecorder(tweakStream);
  tweakRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });

  tweakRecorder.addEventListener('stop', onTweakRecordingStop);

  tweakRecorder.start();
  addStatus('Recording tweak instructions (max 2 minutes)...');
  tweakEmailBtn.disabled = true;
  stopTweakBtn.disabled = false; // <-- enable stop button

  tweakTimeout = setTimeout(() => {
    if (tweakRecorder && tweakRecorder.state === 'recording') tweakRecorder.stop();
  }, 120000); // 2 minutes
});

stopTweakBtn.addEventListener('click', () => {
  if (tweakRecorder && tweakRecorder.state === 'recording') {
    tweakRecorder.stop();
  }
});

async function onTweakRecordingStop() {
  clearTimeout(tweakTimeout);
  addStatus('Tweak recording stopped, processing...');
  stopTweakBtn.disabled = true; // <-- disable after stopping
  tweakEmailBtn.disabled = false;

  if (tweakStream) {
    tweakStream.getTracks().forEach(track => track.stop());
    tweakStream = null;
  }

  // belt and braces
  navigator.mediaDevices.getUserMedia({ audio: false });

  addStatus('Transcribing tweak instructions...');
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  await new Promise(resolve => { audio.onloadedmetadata = resolve; });
  const durationMinutes = audio.duration / 60;
  URL.revokeObjectURL(audioUrl);
  
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const form = new FormData();
    form.append('file', blob, 'tweak.webm');
    form.append('model', transModelEl.value);
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });
    const j = await resp.json();
    if (!resp.ok) return alert('Tweak transcription error: ' + (j.error?.message || JSON.stringify(j)));

    const tweakTransCost = transCosts[transModelEl.value] * durationMinutes;
    addStatus(`Tweak transcription complete, cost: $${tweakTransCost.toFixed(4)}`);

    const tweakText = j.text || '';
    // Re-run generation with tweak instructions
    addStatus('Applying tweaks to email...');
    const origTranscript = transcriptText.textContent.trim();
    const prompt = `Style: ${styleSelect.value}\n\nOriginal Notes:\n${origTranscript}\n\nTweak Instructions:\n${tweakText}`;
    const genResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: textModelEl.value,
        messages: [
          { role: 'system', content: 'You are an assistant that rewrites user notes into a clean, professional email. Apply the tweak instructions to improve the previous email. Use headings, paragraphs, bullet points and a sign-off when appropriate, but pay close attention to the style specified and if marked as informal, ensure it is informal.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800
      })
    });
    const genJ = await genResp.json();
    if (genResp.ok) {
      const text = (genJ.choices && genJ.choices[0] && genJ.choices[0].message && genJ.choices[0].message.content) || '';
      emailText.textContent = text;
      const usage = genJ.usage;
      const tokens = usage.total_tokens;
      const costPer1K = textCosts[textModelEl.value];
      const tweakTextCost = (tokens / 1000) * costPer1K;
      addStatus(`Email updated with tweaks, cost: $${tweakTextCost.toFixed(4)}`);
    } else {
      alert('Generation error: ' + (genJ.error?.message || JSON.stringify(genJ)));
    }
  } catch (err) {
    console.error(err);
    alert('Tweak flow failed: ' + err.message);
  }
}

