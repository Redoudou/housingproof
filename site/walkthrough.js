'use strict';
const byId = (id) => document.getElementById(id);
const stages = ['load', 'prepare', 'ask'];
let timer;
function showStage(index) {
  stages.forEach((id, i) => { byId(id).hidden = i !== index; });
  document.querySelectorAll('.steps li').forEach((item, i) => {
    if (i === index) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}
function focusHeading(id) {
  const heading = byId(id).querySelector('h2');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
byId('load-button').addEventListener('click', () => {
  showStage(1);
  focusHeading('prepare');
  const labels = ['Checking required information…', 'Organizing fictional properties and reporting years…', 'Preparing illustrative source references…', 'Sample workspace ready. No real processing was performed.'];
  let step = 0;
  const advance = () => {
    byId('progress').value = (step + 1) * 25;
    byId('process-label').textContent = labels[step];
    document.querySelectorAll('.tasks li').forEach((item, i) => item.classList.toggle('done', i < step));
    if (step === 3) {
      byId('prepare-title').textContent = 'The samples are ready.';
      byId('ready').hidden = false;
      return;
    }
    step += 1;
    timer = setTimeout(advance, 950);
  };
  timer = setTimeout(advance, 450);
});
byId('continue-button').addEventListener('click', () => { showStage(2); focusHeading('ask'); });
byId('sample').addEventListener('change', () => { byId('answer').hidden = true; });
byId('ask-button').addEventListener('click', () => {
  const scenario = byId('sample').value;
  const content = {
    yes: ['YES', 'In this fictional scenario, the filing reports at least 20 rent-regulated residential units.', 'DEMO-001 · 2025'],
    no: ['NO', 'In this fictional scenario, the reported count is below 20. A NO is a valid answer to this question; it is not a failed check.', 'DEMO-002 · 2025'],
    unavailable: ['UNAVAILABLE', 'This scenario has incomplete source information. The proposed system would withhold an answer rather than treat missing information as NO.', 'DEMO-003 · 2025'],
  }[scenario];
  const answer = byId('answer');
  answer.className = `answer ${scenario}`;
  answer.innerHTML = `<span class="answer-label">ILLUSTRATIVE RESULT · NOT VERIFIED</span><h3>${content[0]}</h3><p>${content[1]}</p><dl><dt>Source context</dt><dd>${content[2]} · fictional filing</dd><dt>Underlying filing</dt><dd>Would remain inside DOF</dd><dt>Proof status</dt><dd>No proof generated or checked in this walkthrough</dd></dl><p><strong>In the target product:</strong> ${scenario === 'unavailable' ? 'the agency would see why no answer can be released.' : 'an answer would be released only after its proof passes verification. The recipient could check that proof without receiving the filing.'}</p>`;
  answer.hidden = false;
});
byId('restart').addEventListener('click', () => {
  clearTimeout(timer);
  showStage(0);
  byId('ready').hidden = true;
  byId('answer').hidden = true;
  byId('sample').value = 'yes';
  byId('progress').value = 0;
  byId('prepare-title').textContent = 'Preparing the sample workspace.';
  byId('process-label').textContent = 'Reading the fictional sample pack…';
  document.querySelectorAll('.tasks li').forEach((item) => item.classList.remove('done'));
  byId('load-button').focus();
});
