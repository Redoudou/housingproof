const el = id => document.getElementById(id);
const filingSelect = el('filingSelect'), priorSelect = el('priorSelect'), questionSelect = el('questionSelect');
let bundle = null, questions = [], sources = [], busy = false;
function clearAnswer() { bundle = null; el('agencyOutput').textContent = 'No answer requested yet.'; el('agencyOutput').dataset.status = ''; el('proofStats').textContent = ''; el('exportBtn').hidden = true; el('verifyBtn').disabled = true; el('tamperBtn').disabled = true; el('verifyOutput').textContent = 'A changed answer, proof, source, or approved parameter must be rejected.'; el('verifyOutput').dataset.status = ''; }
function setBusy(value) {
  busy = value;
  for (const id of ['filingSelect', 'priorSelect', 'questionSelect', 'loadFilingBtn', 'loadPriorBtn', 'askBtn', 'bundleFile', 'keyBtn']) el(id).disabled = value;
  el('verifyBtn').disabled = value || !bundle; el('tamperBtn').disabled = value || !bundle;
}
async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' } });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.message || result.reason || 'Request failed.'); error.status = result.status; throw error; }
  return result;
}
const post = (url, body) => jsonFetch(url, { method: 'POST', body: JSON.stringify(body) });
function refreshQuestion() {
  const question = questions.find(q => q.id === questionSelect.value);
  el('questionText').textContent = question?.question || '';
  el('priorControls').hidden = questionSelect.value !== 'Q002';
  el('sourceSummary').textContent = `Current: ${filingSelect.value}${questionSelect.value === 'Q002' ? ` · Prior: ${priorSelect.value || 'not selected'}` : ''}`;
}
async function loadSources() {
  sources = await jsonFetch('/api/filings');
  for (const [select, list, selected] of [[filingSelect, sources.filter(f => f.reportingPeriod === '2025'), filingSelect.value], [priorSelect, sources.filter(f => f.reportingPeriod === '2024'), priorSelect.value]]) {
    select.replaceChildren(...list.map(f => { const option = document.createElement('option'); option.value = f.id; option.textContent = f.label + (f.registered ? ' ✓ registered' : ''); return option; }));
    if (list.some(f => f.id === selected)) select.value = selected;
  }
  refreshQuestion();
}
async function register(select) {
  clearAnswer(); setBusy(true); el('dofOutput').textContent = 'Validating and registering synthetic source…';
  try {
    const result = await post('/api/filings/register', { filingId: select.value });
    el('dofOutput').textContent = `${result.filingId} registered. Signed by ${result.manifest.issuer}. Commitment: ${result.commitment}.`;
    el('dofOutput').dataset.status = '';
    await loadSources();
  } catch (error) { el('dofOutput').textContent = error.message; el('dofOutput').dataset.status = 'rejected'; }
  finally { setBusy(false); }
}
async function ask() {
  if (busy) return;
  clearAnswer(); setBusy(true);
  el('agencyOutput').textContent = 'Generating a fresh ZK proof, then independently checking its signature, statement, and proof. This may take several seconds…';
  try {
    const q = questions.find(q => q.id === questionSelect.value);
    const result = await post('/api/filings/answer', { filingId: filingSelect.value, priorFilingId: priorSelect.value, question: q.question, threshold: q.threshold });
    if (result.verification !== 'verified' || typeof result.answer !== 'boolean' || !result.bundle) throw new Error('No verified answer available.');
    bundle = result.bundle;
    el('agencyOutput').replaceChildren();
    const status = document.createElement('span'); status.className = 'verification'; status.textContent = 'ZK PROOF VERIFIED';
    const answer = document.createElement('strong'); answer.className = 'answer'; answer.textContent = result.answer ? 'YES' : 'NO';
    const metadata = document.createElement('span'); metadata.textContent = `${q.id} · ${bundle.manifests[0].propertyId} · ${bundle.manifests.map(m => m.reportingPeriod).join(' / ')} · simulated issuer`;
    el('agencyOutput').append(status, answer, metadata); el('agencyOutput').dataset.status = 'verified';
    el('proofStats').textContent = `Fresh proof · ${(result.provingMs / 1000).toFixed(1)}s proving + self-check · ${(result.proofBytes / 1024).toFixed(1)} KiB proof. Raw filing excluded.`;
    el('exportBtn').hidden = false;
  } catch (error) { el('agencyOutput').textContent = `${error.status === 'missing_data' ? 'UNAVAILABLE' : (error.status || 'service_unavailable').replaceAll('_', ' ').toUpperCase()}: ${error.message}`; el('agencyOutput').dataset.status = 'rejected'; }
  finally { setBusy(false); }
}
async function verify(value, tampered = false) {
  if (busy) return;
  setBusy(true); el('verifyOutput').textContent = 'Verifying public bundle only…'; el('verifyOutput').dataset.status = '';
  try {
    const result = await post('/api/verify', value);
    el('verifyOutput').textContent = `${tampered ? 'Changed-answer test: ' : ''}${result.verified ? 'VERIFIED' : 'REJECTED'}. ${result.reason}`;
    el('verifyOutput').dataset.status = result.verified ? 'verified' : 'rejected';
  } catch (error) { el('verifyOutput').textContent = `${tampered ? 'Changed-answer test: ' : ''}${(error.status || 'service_unavailable').replaceAll('_', ' ').toUpperCase()}. ${error.message}`; el('verifyOutput').dataset.status = 'rejected'; }
  finally { setBusy(false); }
}
function download(text, filename, type) { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
el('loadFilingBtn').addEventListener('click', () => register(filingSelect));
el('loadPriorBtn').addEventListener('click', () => register(priorSelect));
el('askBtn').addEventListener('click', ask);
el('exportBtn').addEventListener('click', () => { if (bundle) download(JSON.stringify(bundle, null, 2), 'answer-bundle.json', 'application/json'); });
el('verifyBtn').addEventListener('click', () => { if (bundle) verify(bundle); });
el('tamperBtn').addEventListener('click', () => { if (!bundle) return; const altered = structuredClone(bundle); altered.answer = !altered.answer; altered.publicInputs[altered.publicInputs.length - 1] = `0x${(altered.answer ? '1' : '0').padStart(64, '0')}`; verify(altered, true); });
el('bundleFile').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 128000) throw new Error('Bundle is too large.'); await verify(JSON.parse(await file.text())); } catch { el('verifyOutput').textContent = 'REJECTED. Import a valid bundle JSON file under 128 KB.'; el('verifyOutput').dataset.status = 'rejected'; } event.target.value = ''; });
el('keyBtn').addEventListener('click', async () => { try { const response = await fetch('/api/trust/issuer'); if (!response.ok) throw Error(); download(await response.text(), 'trusted-issuer-public.pem', 'text/plain'); } catch { el('verifyOutput').textContent = 'Public key download unavailable.'; } });
for (const select of [filingSelect, priorSelect, questionSelect]) select.addEventListener('change', () => { clearAnswer(); refreshQuestion(); });
(async () => { try { questions = await jsonFetch('/api/questions'); await loadSources(); } catch { el('agencyOutput').textContent = 'Local custodian service unavailable. Start npm run dev.'; } })();
