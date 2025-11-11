const statusEl = document.getElementById('status');
const scanBtn = document.getElementById('manualScan');

scanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes('linkedin.com')) {
    setStatus('You are not on LinkedIn', 'error');
    return;
  }

  setStatus('Scanning...', 'pending');
  scanBtn.disabled = true;

  chrome.tabs.sendMessage(tab.id, { type: 'MANUAL_SCAN' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('Error', 'error');
    } else if (response?.blocked !== undefined && response.blocked > 0) {
      setStatus(`${response.blocked} hidden post(s)`, 'success');
    } else {
      setStatus('No promoted post found', 'success');
    }
    scanBtn.disabled = false;
    setTimeout(() => setStatus(''), 3000);
  });
});

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = type;
}