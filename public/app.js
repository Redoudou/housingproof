const filingSelect = document.getElementById('filingSelect');
const dofOutput = document.getElementById('dofOutput');
const agencyOutput = document.getElementById('agencyOutput');
const exportBtn = document.getElementById('exportBtn');
const loadFilingBtn = document.getElementById('loadFilingBtn');
const askBtn = document.getElementById('askBtn');

let lastBundle = null;

async function jsonFetch(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Request failed');
  }

  return response.json();
}

async function loadFilings() {
  const filings = await jsonFetch('/api/filings');
  filingSelect.innerHTML = filings.map((filing) => `<option value="${filing.id}">${filing.label}</option>`).join('');
  return filings;
}

async function registerSelectedFiling() {
  const filingId = filingSelect.value;
  const result = await jsonFetch('/api/filings/register', {
    method: 'POST',
    body: JSON.stringify({ filingId }),
  });

  dofOutput.innerHTML = `
    <p><strong>Registered filing:</strong> ${result.filingId}</p>
    <p><strong>Commitment:</strong> ${result.commitment}</p>
    <p><strong>Manifest issuer:</strong> ${result.manifest.issuer}</p>
    <p class="muted">Issued: ${result.manifest.issuedOn}</p>
  `;
}

async function askQuestion() {
  const filingId = filingSelect.value;
  const result = await jsonFetch('/api/filings/answer', {
    method: 'POST',
    body: JSON.stringify({ filingId, question: 'Does this filing report at least 20 rent-regulated residential units?' }),
  });

  lastBundle = result.bundle;
  agencyOutput.innerHTML = `
    <p><strong>Status:</strong> <span class="status">${result.status}</span></p>
    <p><strong>Answer:</strong> <span class="answer">${result.answer === true ? 'YES' : result.answer === false ? 'NO' : 'UNAVAILABLE'}</span></p>
    <p><strong>Verification:</strong> ${result.verification}</p>
    <p class="muted">Threshold: ${result.threshold}</p>
    <p class="muted">${result.message}</p>
  `;

  exportBtn.style.display = result.bundle ? 'inline-block' : 'none';
}

exportBtn.addEventListener('click', () => {
  if (!lastBundle) return;
  const blob = new Blob([JSON.stringify(lastBundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'housingproof-bundle.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

loadFilingBtn.addEventListener('click', registerSelectedFiling);
askBtn.addEventListener('click', askQuestion);
loadFilings();
