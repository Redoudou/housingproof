const filingSelect = document.getElementById('filingSelect');
const dofOutput = document.getElementById('dofOutput');
const agencyOutput = document.getElementById('agencyOutput');
const exportBtn = document.getElementById('exportBtn');
const loadFilingBtn = document.getElementById('loadFilingBtn');
const askBtn = document.getElementById('askBtn');

exportBtn.hidden = true;
async function jsonFetch(url, opts = {}) {
  const response = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.reason || 'Request failed.');
  return result;
}
async function loadFilings() {
  const filings = await jsonFetch('/api/filings');
  filingSelect.replaceChildren(...filings.map((filing) => {
    const option = document.createElement('option'); option.value = filing.id; option.textContent = filing.label; return option;
  }));
}
async function registerSelectedFiling() {
  dofOutput.textContent = 'Registering synthetic filing…';
  agencyOutput.textContent = '';
  try {
    const result = await jsonFetch('/api/filings/register', { method: 'POST', body: JSON.stringify({ filingId: filingSelect.value }) });
    dofOutput.textContent = `Synthetic source registered. Issuer: ${result.manifest.issuer}. Commitment: ${result.commitment}. This receipt does not verify an answer.`;
  } catch (error) { dofOutput.textContent = error.message; }
}
async function askQuestion() {
  askBtn.disabled = true;
  agencyOutput.textContent = 'Requesting proof…';
  try {
    await jsonFetch('/api/filings/answer', { method: 'POST', body: JSON.stringify({ filingId: filingSelect.value,
      question: 'Does this filing report at least 20 rent-regulated residential units?', threshold: 20 }) });
    // No success/export state exists until independent proof verification is implemented.
    agencyOutput.textContent = 'No independently verified answer is available.';
  } catch (error) { agencyOutput.textContent = error.message; }
  finally { askBtn.disabled = false; }
}
filingSelect.addEventListener('change', () => { dofOutput.textContent = ''; agencyOutput.textContent = ''; });
loadFilingBtn.addEventListener('click', registerSelectedFiling);
askBtn.addEventListener('click', askQuestion);
loadFilings().catch(() => { agencyOutput.textContent = 'The local custodian service is unavailable.'; });
