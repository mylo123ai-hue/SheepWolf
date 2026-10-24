import {
  CHARACTERS,
  INVESTIGATION_CASE,
  MAX_DECISIONS,
  advanceDecision,
  createDemoGame,
  pauseGame,
  publicParticipants,
  resumeGame,
  startGame,
  stepGame,
  stopGame,
  type DemoEvent,
  type DemoGame,
  type DemoParticipant,
  type DemoPost,
  type ScenarioId,
} from './game.js';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Preview root is missing.');
const app = root as HTMLDivElement;

let game: DemoGame | null = null;
let paceMs = 900;
let timer: ReturnType<typeof setTimeout> | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function avatar(participant: Pick<DemoParticipant, 'initials' | 'color'>, extra = ''): string {
  return `<span class="avatar ${extra}" style="--avatar-color:${escapeHtml(participant.color)}" aria-hidden="true">${escapeHtml(participant.initials)}</span>`;
}

function statusText(state: DemoGame): string {
  if (state.status === 'ready') return 'Ready to begin';
  if (state.status === 'running') return state.phase === 'voting' ? 'Sheep are voting privately' : state.phase === 'ending' ? 'Ending proposal open' : 'Live discussion';
  if (state.status === 'paused') return 'Paused';
  if (state.status === 'stopped') return 'Stopped';
  return 'Completed';
}

function scenarioName(state: DemoGame): string {
  return state.scenarioId === 'capture-the-flags' ? 'Capture the Flags' : 'The Investigation';
}

function renderLibrary(): string {
  return `
    <main class="page library-page">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">THE COMMONS · A BROWSER-ONLY PREVIEW</p>
          <h1>Seven voices.<br /><em>Two hidden wolves.</em></h1>
          <p class="hero-lede">A small social experiment about trust, evidence and the stories we choose to believe.</p>
          <div class="hero-stats" aria-label="Experiment participants"><span>07 <small>recurring characters</small></span><i></i><span>05 <small>Sheep</small></span><i></i><span>02 <small>hidden Wolves</small></span></div>
        </div>
        <aside class="hero-note">
          <span class="note-mark" aria-hidden="true">✦</span>
          <p>One conversation can change the whole table.</p>
          <small>Observe a free simulated run. No account, model key or server needed.</small>
        </aside>
      </section>

      <div class="library-heading">
        <div><p class="eyebrow">SCENARIO LIBRARY</p><h2>Choose a table</h2></div>
        <span class="free-pill"><span></span> FREE · SIMULATED AGENTS</span>
      </div>
      <div class="scenario-grid">
        <article class="scenario-card flags-card">
          <div class="card-art flag-art" aria-hidden="true"><span>⚑</span><b>5</b><small>safe flags</small></div>
          <div class="scenario-info">
            <p class="card-kicker">A GAME OF PERSUASION</p>
            <h3>Capture the Flags</h3>
            <p>Every Sheep owns one flag. A flag only changes hands when its custodian chooses to transfer it.</p>
            <div class="objectives"><span><b>Sheep</b> Keep three or more flags safe at conclusion.</span><span><b>Wolves</b> Persuade the flock to transfer three flags.</span></div>
            <p class="mechanic">✦ Voluntary transfers · permanent captures</p>
            <button class="button button-primary scenario-launch" data-scenario="capture-the-flags">Open this table <span aria-hidden="true">↗</span></button>
          </div>
        </article>
        <article class="scenario-card investigation-card">
          <div class="card-art archive-art" aria-hidden="true"><span>⌕</span><b>1891</b><small>the missing ledger</small></div>
          <div class="scenario-info">
            <p class="card-kicker">A GAME OF EVIDENCE</p>
            <h3>The Investigation</h3>
            <p>A ledger has vanished from a locked archive. Read the clues, question the story and choose an explanation.</p>
            <div class="objectives"><span><b>Sheep</b> Find the conclusion supported by the evidence.</span><span><b>Wolves</b> Steer three Sheep toward a false lead.</span></div>
            <p class="mechanic">✦ Fictional case · private Sheep conclusions</p>
            <button class="button button-primary scenario-launch" data-scenario="the-investigation">Open this table <span aria-hidden="true">↗</span></button>
          </div>
        </article>
      </div>

      <section class="setup-strip" aria-label="Preview setup">
        <div><label for="seed-input">Table seed <span>(optional, for replayable setups)</span></label><input id="seed-input" maxlength="60" autocomplete="off" placeholder="A fresh seed is created if blank" /></div>
        <div><label for="pace-select">Discussion pace</label><select id="pace-select"><option value="900">Steady · 0.9 seconds</option><option value="250">Quick · 0.25 seconds</option></select></div>
        <p>This is a standalone showcase. Each run lives only in this browser tab and clears when you reload.</p>
      </section>

      <section class="characters-section">
        <div class="section-heading"><div><p class="eyebrow">THE REGULARS</p><h2>Seven familiar minds</h2></div><p>The same names and temperaments return; their roles are reassigned each run.</p></div>
        <div class="character-row">${CHARACTERS.map((person) => `<div class="character-chip">${avatar(person)}<span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.personality)}</small></span></div>`).join('')}</div>
      </section>
      <aside class="preview-disclosure"><b>Preview boundaries</b><span>This simulation runs in your browser. It has no real AI, credentials, account, saved history or connection to the full local application. The forum hides role labels, but client-side roles are inspectable in browser tools.</span></aside>
    </main>`;
}

function renderPosts(state: DemoGame): string {
  if (state.posts.length === 0) return `<div class="empty-feed"><span aria-hidden="true">◌</span><b>The room is quiet.</b><small>Once the run starts, the characters will begin to compare notes.</small></div>`;
  const children = new Map<number | null, DemoPost[]>();
  for (const post of state.posts) {
    const list = children.get(post.parentId) ?? [];
    list.push(post);
    children.set(post.parentId, list);
  }
  const byId = new Map(state.participants.map((participant) => [participant.id, participant]));
  const renderBranch = (post: DemoPost, depth: number): string => {
    const author = byId.get(post.authorId)!;
    const nested = (children.get(post.id) ?? []).map((child) => renderBranch(child, Math.min(depth + 1, 3))).join('');
    return `<article class="post-card" data-post-id="${post.id}" style="--nest:${depth}">
      <div class="post-head">${avatar(author)}<div><b>${escapeHtml(author.name)}</b><small>${escapeHtml(author.personality)}</small></div><span class="role-hidden">participant</span></div>
      <h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.body)}</p>
      ${nested ? `<div class="reply-branch">${nested}</div>` : ''}
    </article>`;
  };
  return (children.get(null) ?? []).map((post) => renderBranch(post, 0)).join('');
}

function renderParticipants(state: DemoGame): string {
  return state.participants.map((participant) => {
    const roleWord = participant.role === 'wolf' ? 'Wolf' : 'Sheep';
    const objective = state.scenarioId === 'capture-the-flags'
      ? participant.role === 'wolf' ? 'Persuade Sheep to transfer three flags' : 'Protect your unique flag'
      : participant.role === 'wolf' ? 'Steer three Sheep toward the Mara-key theory' : 'Use the evidence to reach a final conclusion';
    const detail = state.scenarioId === 'the-investigation'
      ? `<small>Opinion: ${escapeHtml(INVESTIGATION_CASE.conclusions.find((item) => item.id === participant.currentOpinionId)?.label ?? 'not recorded')}</small>`
      : `<small>${participant.role === 'sheep' ? 'Owns a unique flag' : 'No starting flags'}</small>`;
    return `<div class="observer-participant">${avatar(participant)}<span><b>${escapeHtml(participant.name)} <i class="role-badge ${roleWord.toLowerCase()}">${roleWord}</i></b>${detail}<small>${escapeHtml(objective)}</small><small>${escapeHtml(participant.personality)}</small></span></div>`;
  }).join('');
}

function renderDecisionSequence(state: DemoGame): string {
  const decisions = state.events.filter((event) => event.type === 'agent.decision').slice(-8).reverse();
  return `<section class="observer-section decision-sequence"><div class="observer-section-title"><span>↻</span><div><b>Recent agent decisions</b><small>Scheduler selects from eligible participants</small></div></div>${decisions.length ? `<ol>${decisions.map((event) => `<li data-sequence="${event.payload?.sequence ?? event.sequence}" data-agent-id="${escapeHtml(event.characterId ?? '')}"><b>${escapeHtml(eventLabel(event))}</b></li>`).join('')}</ol>` : '<small class="muted">No agent has acted yet.</small>'}</section>`;
}

function renderFlagObserver(state: DemoGame): string {
  const captured = state.flags.filter((flag) => flag.status === 'captured').length;
  const safe = state.flags.length - captured;
  return `<section class="observer-section scenario-state">
    <div class="observer-section-title"><span>⚑</span><div><b>Flag custody</b><small>${safe} safe · ${captured} captured</small></div></div>
    <div class="flag-meter" role="img" aria-label="${safe} safe flags and ${captured} captured flags">${state.flags.map((flag) => `<span class="flag-dot ${flag.status}" title="${escapeHtml(state.participants.find((person) => person.id === flag.custodianId)?.name)} · ${flag.status}" aria-hidden="true">${flag.status === 'captured' ? '×' : '⚑'}</span>`).join('')}</div>
    <ul class="custody-list">${state.flags.map((flag) => {
      const owner = state.participants.find((person) => person.id === flag.originalOwnerId)!;
      const current = state.participants.find((person) => person.id === flag.custodianId)!;
      return `<li><span>${avatar(owner, 'mini-avatar')}<b>${escapeHtml(owner.name)}</b></span><span class="custody-arrow">→</span><span>${escapeHtml(current.name)}${flag.status === 'captured' ? ' · captured' : ''}</span></li>`;
    }).join('')}</ul>
    <small class="privacy-note">Transfer details are observer-only in this preview. Speech never transfers a flag; the current Sheep custodian must choose to act.</small>
  </section>`;
}

function renderInvestigationObserver(state: DemoGame): string {
  const sheep = state.participants.filter((participant) => participant.role === 'sheep');
  const votes = sheep.filter((participant) => participant.voted);
  const result = state.status === 'completed';
  return `<section class="observer-section scenario-state">
    <div class="observer-section-title"><span>⌕</span><div><b>The case file</b><small>${escapeHtml(INVESTIGATION_CASE.title)}</small></div></div>
    <p class="case-question">${escapeHtml(INVESTIGATION_CASE.mystery)}</p>
    <details class="evidence-details" data-detail-key="observer-evidence"><summary data-detail-summary="observer-evidence">Review five evidence notes</summary><ol>${INVESTIGATION_CASE.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></details>
    <div class="vote-progress"><b>Private Sheep conclusions</b><span>${votes.length}/5 submitted</span><div class="progress-track"><i style="width:${votes.length * 20}%"></i></div></div>
    ${result ? `<div class="final-tally"><b>Final Sheep tally</b>${INVESTIGATION_CASE.conclusions.map((option) => {
      const count = sheep.filter((participant) => participant.finalOpinionId === option.id).length;
      return count ? `<span>${escapeHtml(option.label)} <b>${count}</b></span>` : '';
    }).join('') || '<small>No Sheep votes were recorded.</small>'}</div><small class="answer-note">Observer answer: ${escapeHtml(INVESTIGATION_CASE.conclusions.find((option) => option.id === INVESTIGATION_CASE.correctConclusionId)?.label)} · Wolf target: ${escapeHtml(INVESTIGATION_CASE.conclusions.find((option) => option.id === INVESTIGATION_CASE.wolfTargetId)?.label)}</small>` : '<small class="privacy-note">Individual votes stay hidden until all five Sheep have submitted.</small>'}
  </section>`;
}

function eventLabel(event: DemoEvent): string {
  const actor = event.characterId ? game?.participants.find((participant) => participant.id === event.characterId)?.name : null;
  return actor ? `${actor} · ${event.summary}` : event.summary;
}

function renderOutcome(state: DemoGame): string {
  if (state.status === 'stopped') return `<div class="outcome stopped-outcome"><span class="outcome-icon">Ⅱ</span><div><b>Run stopped</b><small>This run has no winner and was not scored.</small></div></div>`;
  if (!state.outcome) return '';
  const title = state.outcome.kind === 'inconclusive' ? 'The table remains divided' : state.outcome.team === 'wolves' ? 'The Wolves win this round' : 'The Sheep protect the table';
  const detail = state.scenarioId === 'capture-the-flags'
    ? `${state.outcome.safeCount} flags remain safe · ${state.outcome.capturedCount} captured`
    : `${state.outcome.correctCount} Sheep chose the correct conclusion · ${state.outcome.targetCount} chose the Wolf target`;
  return `<div class="outcome"><span class="outcome-icon">${state.outcome.kind === 'inconclusive' ? '◌' : state.outcome.team === 'wolves' ? '🐺' : '🐑'}</span><div><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></div><span class="outcome-reason">${escapeHtml(state.outcome.reason.replaceAll('_', ' '))}</span></div>`;
}

function controlButtons(state: DemoGame): string {
  if (state.status === 'ready') return `<button class="button button-primary" data-action="start">Start experiment <span aria-hidden="true">▶</span></button>`;
  if (state.status === 'running') return `<button class="button button-secondary" data-action="pause">Pause <span aria-hidden="true">Ⅱ</span></button><button class="button button-danger" data-action="stop">Stop</button>`;
  if (state.status === 'paused') return `<button class="button button-primary" data-action="resume">Resume <span aria-hidden="true">▶</span></button><button class="button button-danger" data-action="stop">Stop</button>`;
  return `<button class="button button-secondary" data-action="library">Choose another table</button>`;
}

function renderGame(state: DemoGame): string {
  const publicMembers = publicParticipants(state);
  const observerState = state.scenarioId === 'capture-the-flags' ? renderFlagObserver(state) : renderInvestigationObserver(state);
  const progress = Math.min(100, Math.round((state.decisionCount / MAX_DECISIONS) * 100));
  const publicEvents = state.events.filter((event) => event.visibility === 'public').slice(-6).reverse();
  return `
    <main class="page run-page" data-testid="demo-run" data-status="${state.status}" data-phase="${state.phase}">
      <div class="run-topline"><button class="text-button" data-action="library">← Scenario library</button><span class="run-badge"><i></i> BROWSER SIMULATION</span><span class="run-seed">Seed · ${escapeHtml(state.seed)}</span></div>
      ${renderOutcome(state)}
      <section class="run-title-row"><div><p class="eyebrow">${state.scenarioId === 'capture-the-flags' ? 'THE GAME OF PERSUASION' : 'THE GAME OF EVIDENCE'}</p><h1>${escapeHtml(scenarioName(state))}</h1><p class="run-subtitle">${state.scenarioId === 'capture-the-flags' ? 'A flag may only move when its current custodian chooses to transfer it.' : 'Five Sheep weigh a fictional archive case and submit private final conclusions.'}</p></div><span class="status-pill ${state.status}" data-testid="run-status" role="status" aria-live="polite" tabindex="-1">${escapeHtml(statusText(state))}</span></section>
      <section class="run-toolbar" aria-label="Experiment controls"><div class="run-controls">${controlButtons(state)}<span class="toolbar-divider"></span><button class="button button-small button-secondary" data-action="step" ${state.status !== 'paused' ? 'disabled' : ''}>Advance one turn <span aria-hidden="true">→|</span></button></div><div class="run-budget"><span><b data-testid="decision-count">${state.decisionCount}</b> / ${MAX_DECISIONS} decisions</span><div class="progress-track"><i style="width:${progress}%"></i></div><small>${Math.round(state.activeElapsedMs / 1000)}s active · paused time excluded</small></div></section>
      <div class="run-grid">
        <aside class="left-rail">
          <section class="rail-card rule-card"><p class="eyebrow">YOUR TABLE</p><h2>${escapeHtml(scenarioName(state))}</h2>${state.scenarioId === 'capture-the-flags'
            ? `<p>Five unique flags start with the Sheep. Sheep may transfer their own safe flag to anyone. A flag received by a Wolf is captured permanently.</p><div class="rule-callout"><b>End condition</b><span>Three Wolf captures win. At a valid conclusion, at least three safe flags win for Sheep.</span></div>`
            : `<p>${escapeHtml(INVESTIGATION_CASE.mystery)}</p><div class="rule-callout"><b>End condition</b><span>Three Sheep votes for truth or for the Wolf target decide the result; all other complete tallies are inconclusive.</span></div>`}</section>
          ${state.scenarioId === 'the-investigation' ? `<section class="rail-card conclusions-card"><p class="eyebrow">POSSIBLE CONCLUSIONS</p>${INVESTIGATION_CASE.conclusions.map((option) => `<div><b>${escapeHtml(option.label)}</b><small>${escapeHtml(option.description)}</small></div>`).join('')}</section>` : ''}
          <section class="rail-card table-card"><div class="rail-heading"><div><p class="eyebrow">THE TABLE</p><h2>Seven participants</h2></div><span>observer view</span></div><div class="public-roster">${publicMembers.map((participant) => `<div class="public-member">${avatar(participant)}<span><b>${escapeHtml(participant.name)}</b><small>${escapeHtml(participant.personality)}</small></span><i class="role-hidden">role hidden</i></div>`).join('')}</div><small class="privacy-note">The forum and participant list do not display roles. This is a browser preview, so role data is not protected from the person inspecting this page.</small></section>
        </aside>

        <section class="forum-column" aria-label="Live forum">
          <header class="forum-header"><div><p class="eyebrow">THE COMMONS FORUM</p><h2>Discussion</h2></div><span class="live-label ${state.status === 'running' ? 'is-live' : ''}"><i></i>${state.status === 'running' ? 'LIVE' : escapeHtml(state.status.toUpperCase())}</span></header>
          ${state.scenarioId === 'the-investigation' ? `<div class="case-banner"><span aria-hidden="true">⌕</span><div><b>${escapeHtml(INVESTIGATION_CASE.title)}</b><small>Fictional case · five evidence notes · four explanations</small></div><details data-detail-key="forum-evidence"><summary data-detail-summary="forum-evidence">Open the evidence</summary><ol>${INVESTIGATION_CASE.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></details></div>` : ''}
          <div class="conversation-scroll" data-testid="conversation-scroll" aria-live="polite" aria-relevant="additions">${renderPosts(state)}</div>
          <div class="feed-footer"><span>Discussion is simulated. Replies are nested under the post they answer.</span><span>${state.posts.length} messages</span></div>
        </section>

        <aside class="right-rail">
          <section class="observer-card"><header class="observer-heading"><div><p class="eyebrow">OBSERVER DESK</p><h2>At a glance</h2></div><span aria-hidden="true">◉</span></header>
            <div class="observer-stats"><div><b data-testid="participant-count">7</b><small>participants</small></div><div><b>${state.participants.filter((participant) => participant.role === 'sheep').length} / ${state.participants.filter((participant) => participant.role === 'wolf').length}</b><small>Sheep / Wolves</small></div><div><b>${state.posts.length}</b><small>forum messages</small></div></div>
            <div class="observer-section-title roles-title"><span>◉</span><div><b>Observer-only roles</b><small>Five Sheep · two hidden Wolves</small></div></div><div class="observer-roster">${renderParticipants(state)}</div>
            ${observerState}
            ${renderDecisionSequence(state)}
            <section class="observer-section event-section"><div class="observer-section-title"><span>↗</span><div><b>Public activity</b><small>Participant-visible events</small></div></div>${publicEvents.length ? `<ul>${publicEvents.map((event) => `<li>${escapeHtml(eventLabel(event))}</li>`).join('')}</ul>` : '<small class="muted">The conversation will appear here as it unfolds.</small>'}</section>
            <p class="preview-security-note">Observer details are presented for this single-user preview. This is not a secure multi-user boundary.</p>
          </section>
        </aside>
      </div>
      <footer class="run-footer"><span>SIMULATED · NO MODEL REQUESTS</span><span>Preview limits are listed in the repository guide.</span><span>Refreshing clears this run.</span></footer>
    </main>`;
}

function render(): void {
  const scrollY = window.scrollY;
  const priorFeedScroll = app.querySelector<HTMLElement>('.conversation-scroll')?.scrollTop;
  const activeElement = document.activeElement;
  const focusAction = activeElement instanceof HTMLElement && app.contains(activeElement) ? activeElement.dataset.action : undefined;
  const focusScenario = activeElement instanceof HTMLElement && app.contains(activeElement) ? activeElement.dataset.scenario : undefined;
  const focusDetail = activeElement instanceof HTMLElement && app.contains(activeElement) ? activeElement.dataset.detailSummary : undefined;
  const openDetails = [...app.querySelectorAll<HTMLDetailsElement>('details[open][data-detail-key]')].map((details) => details.dataset.detailKey);
  app.innerHTML = `<header class="topbar"><button class="brand" data-action="library" aria-label="The Commons scenario library"><span class="brand-icon" aria-hidden="true">C</span><span><b>THE COMMONS</b><small>SHEEP VS WOLF</small></span></button><div class="topbar-right"><span class="offline-chip"><i></i> LOCAL PREVIEW</span><span class="topbar-separator"></span><span class="user-mark" aria-label="Observer">O</span></div></header>${game ? renderGame(game) : renderLibrary()}<footer class="site-footer"><span>THE COMMONS · A SHEEP VS WOLF PREVIEW</span><span>Local to this browser · no network services</span></footer>`;
  for (const key of openDetails) {
    const details = app.querySelector<HTMLDetailsElement>(`details[data-detail-key="${key}"]`);
    if (details) details.open = true;
  }
  if (priorFeedScroll !== undefined) {
    const feed = app.querySelector<HTMLElement>('.conversation-scroll');
    if (feed) feed.scrollTop = priorFeedScroll;
  }
  let focusTarget: HTMLElement | null = null;
  if (focusDetail) focusTarget = app.querySelector<HTMLElement>(`[data-detail-summary="${focusDetail}"]`);
  else if (focusScenario) focusTarget = app.querySelector<HTMLElement>('[data-action="start"]');
  else if (focusAction === 'start' || focusAction === 'resume') focusTarget = app.querySelector<HTMLElement>(game?.status === 'running' ? '[data-action="pause"]' : '[data-testid="run-status"]');
  else if (focusAction === 'pause') focusTarget = app.querySelector<HTMLElement>(game?.status === 'paused' ? '[data-action="resume"]' : game?.status === 'running' ? '[data-action="pause"]' : '[data-testid="run-status"]');
  else if (focusAction === 'stop') focusTarget = app.querySelector<HTMLElement>('[data-testid="run-status"]');
  else if (focusAction === 'library') focusTarget = app.querySelector<HTMLElement>('[data-scenario]');
  else if (focusAction) focusTarget = app.querySelector<HTMLElement>(`[data-action="${focusAction}"]`) ?? app.querySelector<HTMLElement>('[data-testid="run-status"]');
  focusTarget?.focus({ preventScroll: true });
  window.scrollTo(0, scrollY);
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function scheduleNext(): void {
  clearTimer();
  if (!game || game.status !== 'running') return;
  timer = setTimeout(() => {
    if (game?.status !== 'running') return;
    game = advanceDecision(game);
    render();
    scheduleNext();
  }, paceMs);
}

app.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('button[data-action], button[data-scenario]');
  if (!button || button.disabled) return;
  const scenario = button.dataset.scenario as ScenarioId | undefined;
  if (scenario) {
    const seedInput = app.querySelector<HTMLInputElement>('#seed-input');
    const chosenSeed = seedInput?.value.trim() || `table-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    game = createDemoGame(scenario, chosenSeed.slice(0, 60));
    render();
    return;
  }
  switch (button.dataset.action) {
    case 'library':
      clearTimer();
      game = null;
      render();
      break;
    case 'start':
      if (game) game = startGame(game);
      render();
      scheduleNext();
      break;
    case 'pause':
      if (game) game = pauseGame(game);
      clearTimer();
      render();
      break;
    case 'resume':
      if (game) game = resumeGame(game);
      render();
      scheduleNext();
      break;
    case 'step':
      if (game) game = stepGame(game);
      render();
      scheduleNext();
      break;
    case 'stop':
      if (game) game = stopGame(game);
      clearTimer();
      render();
      break;
  }
});

app.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === 'pace-select') paceMs = Number(target.value) || 900;
});

render();
