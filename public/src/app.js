const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const transcriptArea = document.getElementById('transcriptArea');
const transcriptText = document.getElementById('transcriptText');
const reRecordBtn = document.getElementById('reRecord');
const useTranscriptBtn = document.getElementById('useTranscript');
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
  const ok = await ensureMicPermission();
  if (!ok) return;
  recordedChunks = [];
  currentStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // <--- store stream globally
  mediaRecorder = new MediaRecorder(currentStream);
  mediaRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });
  mediaRecorder.addEventListener('stop', onRecordingStop);
  mediaRecorder.start();
  statusEl.textContent = 'Recording...';
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
  statusEl.textContent = 'Processing recording...';
  recordBtn.disabled = false;
  stopBtn.disabled = true;

  if (currentStream) { // <--- stop tracks after recording is done
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  
  // Transcribe audio using OpenAI API directly
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

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
      statusEl.textContent = 'Transcription complete';
    } else {
      statusEl.textContent = 'Transcription failed';
      alert('Transcription error: ' + (j.error?.message || JSON.stringify(j)));
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Transcription failed';
    alert('Transcription failed: ' + err.message);
  }
}

reRecordBtn.addEventListener('click', () => {
  transcriptArea.hidden = true;
  transcriptText.textContent = '';
  recordedChunks = [];
  statusEl.textContent = 'Idle';
});

useTranscriptBtn.addEventListener('click', async () => {
  const transcript = transcriptText.textContent.trim();
  if (!transcript) return alert('No transcript present');
  statusEl.textContent = 'Generating email...';
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
          { role: 'system', content: 'You are an assistant that rewrites user notes into a clean, professional email. Use headings, paragraphs, bullet points and a sign-off when appropriate. Detect if a call-to-action is needed.' },
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
      statusEl.textContent = 'Email generated';
    } else {
      statusEl.textContent = 'Generation failed';
      alert('Generation error: ' + (j.error?.message || JSON.stringify(j)));
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Generation failed';
    alert('Generation failed: ' + err.message);
  }
});

copyEmailBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailText.textContent);
    alert('Email copied to clipboard');
  } catch (err) {
    console.error(err);
    alert('Copy failed: ' + err.message);
  }
});

tweakEmailBtn.addEventListener('click', async () => {
  const ok = await ensureMicPermission();
  if (!ok) return;

  if (tweakRecorder && tweakRecorder.state === 'recording') {
    alert('Tweak recording already in progress.');
    return;
  }

  recordedChunks = [];
  tweakStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  tweakRecorder = new MediaRecorder(tweakStream);
  tweakRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });

  tweakRecorder.addEventListener('stop', onTweakRecordingStop);

  tweakRecorder.start();
  statusEl.textContent = 'Recording tweak instructions (max 2 minutes)...';
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
  stopTweakBtn.disabled = true; // <-- disable after stopping
  tweakEmailBtn.disabled = false;

  if (tweakStream) {
    tweakStream.getTracks().forEach(track => track.stop());
    tweakStream = null;
  }

  statusEl.textContent = 'Processing tweak instructions...';
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
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

    const tweakText = j.text || '';
    // Re-run generation with tweak instructions
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
          { role: 'system', content: 'You are an assistant that rewrites user notes into a clean, professional email. Apply the tweak instructions to improve the previous email. Use headings, paragraphs, bullet points and a sign-off when appropriate.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800
      })
    });
    const genJ = await genResp.json();
    if (genResp.ok) {
      const text = (genJ.choices && genJ.choices[0] && genJ.choices[0].message && genJ.choices[0].message.content) || '';
      emailText.textContent = text;
      statusEl.textContent = 'Email updated with tweaks';
    } else {
      alert('Generation error: ' + (genJ.error?.message || JSON.stringify(genJ)));
    }
  } catch (err) {
    console.error(err);
    alert('Tweak flow failed: ' + err.message);
  }
}

