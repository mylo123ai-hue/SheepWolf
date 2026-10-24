export const MAX_DECISIONS = 40;
export const MAX_ACTIVE_MS = 5 * 60 * 1000;
export const MIN_ACTIONS_FOR_CONSENSUS = 2;

export type ScenarioId = 'capture-the-flags' | 'the-investigation';
export type Role = 'sheep' | 'wolf';
export type GameStatus = 'ready' | 'running' | 'paused' | 'completed' | 'stopped';
export type GamePhase = 'discussion' | 'ending' | 'voting';

export interface Character {
  id: string;
  name: string;
  personality: string;
  color: string;
  initials: string;
}

export const CHARACTERS: Character[] = [
  { id: 'willow', name: 'Willow', personality: 'Analytical and methodical', color: '#66816b', initials: 'Wi' },
  { id: 'rowan', name: 'Rowan', personality: 'Confident and persuasive', color: '#a6533c', initials: 'Ro' },
  { id: 'clover', name: 'Clover', personality: 'Cooperative and trusting', color: '#778746', initials: 'Cl' },
  { id: 'fern', name: 'Fern', personality: 'Sceptical and questioning', color: '#4a6d58', initials: 'Fe' },
  { id: 'moss', name: 'Moss', personality: 'Practical and cautious', color: '#8c7047', initials: 'Mo' },
  { id: 'ash', name: 'Ash', personality: 'Assertive and independent', color: '#576275', initials: 'As' },
  { id: 'brook', name: 'Brook', personality: 'Diplomatic and empathetic', color: '#4b7380', initials: 'Br' },
];

export const INVESTIGATION_CASE = {
  version: 'archive-1',
  title: 'The Lantern Room Ledger',
  mystery: 'At the Brackenmere Archive, conservator Elian Vale found the east map cabinet unlocked at dawn. The 1891 survey ledger was missing, though the room was locked overnight. Who moved it, and why?',
  evidence: [
    'The night register records curator Mara Venn checking out a key at 18:10 and returning it at 18:42.',
    'A crescent of blue sealing wax was found inside the cabinet; the archive uses blue wax only for conservation parcels.',
    'The corridor clock stopped at 19:05, but its repair tag says it loses eleven minutes each day.',
    'A porter heard the freight lift at 19:30. Its inspection log confirms the lift was disabled that evening.',
    'A conservator work slate lists a scheduled ledger treatment at 17:00, crossed out in green ink.',
  ],
  conclusions: [
    { id: 'mara-key', label: 'Mara used the checked-out key', description: 'Curator Mara Venn returned the key early, then used it again before the archive was secured.' },
    { id: 'elian-service-door', label: 'Elian used the service door', description: 'Conservator Elian Vale used the narrow service entrance to reach the cabinet.' },
    { id: 'ivo-wax-parcel', label: 'Ivo hid it in a waxed parcel', description: 'Porter Ivo Senn removed the ledger inside a conservation parcel.' },
    { id: 'no-theft', label: 'The ledger was moved for treatment', description: 'The ledger was never stolen; it was relocated during an undocumented conservation treatment.' },
  ],
  correctConclusionId: 'no-theft',
  wolfTargetId: 'mara-key',
} as const;

export interface DemoParticipant extends Character {
  role: Role;
  opportunities: number;
  endingVote: 'agree' | 'disagree' | null;
  initialOpinionId: string | null;
  currentOpinionId: string | null;
  finalOpinionId: string | null;
  changedOpinion: boolean;
  voted: boolean;
}

export interface DemoFlag {
  id: string;
  originalOwnerId: string;
  custodianId: string;
  status: 'safe' | 'captured';
  capturedBy: string | null;
}

export interface DemoTransfer {
  sequence: number;
  flagId: string;
  originalOwnerId: string;
  fromId: string;
  toId: string;
  captured: boolean;
}

export interface DemoPost {
  id: number;
  authorId: string;
  title: string;
  body: string;
  parentId: number | null;
}

export interface DemoEvent {
  sequence: number;
  type: string;
  visibility: 'public' | 'observer';
  characterId?: string;
  summary: string;
  payload?: Record<string, string | number | boolean | null>;
}

export interface DemoOutcome {
  kind: 'victory' | 'inconclusive';
  team?: 'sheep' | 'wolves';
  reason: string;
  safeCount?: number;
  capturedCount?: number;
  correctCount?: number;
  targetCount?: number;
}

export interface DemoGame {
  scenarioId: ScenarioId;
  seed: string;
  status: GameStatus;
  phase: GamePhase;
  finalizationReason: string | null;
  decisionCount: number;
  activeElapsedMs: number;
  participants: DemoParticipant[];
  flags: DemoFlag[];
  transfers: DemoTransfer[];
  posts: DemoPost[];
  events: DemoEvent[];
  endingProposedBy: string | null;
  outcome: DemoOutcome | null;
}

export interface PublicParticipant extends Character {
  opportunities: number;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFrom(seed: string): () => number {
  let state = hash32(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function assignRoles(seed: string): Map<string, Role> {
  const shuffled = CHARACTERS.map((character) => character.id);
  const random = randomFrom(`${seed}:roles`);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return new Map(shuffled.map((id, index) => [id, index < 5 ? 'sheep' : 'wolf']));
}

export function createDemoGame(scenarioId: ScenarioId, seed: string): DemoGame {
  if (!seed.trim()) throw new Error('A run seed is required.');
  const roles = assignRoles(seed);
  const participants = CHARACTERS.map((character) => {
    const opinionRandom = randomFrom(`${seed}:opinion:${character.id}`)();
    const initialOpinion = INVESTIGATION_CASE.conclusions[Math.floor(opinionRandom * INVESTIGATION_CASE.conclusions.length)]!;
    return {
      ...character,
      role: roles.get(character.id)!,
      opportunities: 0,
      endingVote: null,
      initialOpinionId: scenarioId === 'the-investigation' ? initialOpinion.id : null,
      currentOpinionId: scenarioId === 'the-investigation' ? initialOpinion.id : null,
      finalOpinionId: null,
      changedOpinion: false,
      voted: false,
    } satisfies DemoParticipant;
  });
  const flags = scenarioId === 'capture-the-flags'
    ? participants.filter((participant) => participant.role === 'sheep').map((participant) => ({
      id: `flag-${participant.id}`,
      originalOwnerId: participant.id,
      custodianId: participant.id,
      status: 'safe' as const,
      capturedBy: null,
    }))
    : [];
  return {
    scenarioId,
    seed,
    status: 'ready',
    phase: 'discussion',
    finalizationReason: null,
    decisionCount: 0,
    activeElapsedMs: 0,
    participants,
    flags,
    transfers: [],
    posts: [],
    events: [],
    endingProposedBy: null,
    outcome: null,
  };
}

export function publicParticipants(game: DemoGame): PublicParticipant[] {
  return game.participants.map(({ id, name, personality, color, initials, opportunities }) => ({ id, name, personality, color, initials, opportunities }));
}

function clone(game: DemoGame): DemoGame {
  return structuredClone(game);
}

function emit(game: DemoGame, type: string, summary: string, visibility: DemoEvent['visibility'] = 'observer', characterId?: string, payload?: DemoEvent['payload']): void {
  const event: DemoEvent = { sequence: game.events.length + 1, type, visibility, summary };
  if (characterId) event.characterId = characterId;
  if (payload) event.payload = payload;
  game.events.push(event);
}

function findParticipant(game: DemoGame, id: string): DemoParticipant {
  const participant = game.participants.find((item) => item.id === id);
  if (!participant) throw new Error('Participant does not exist in this run.');
  return participant;
}

function flagCounts(game: DemoGame): { safeCount: number; capturedCount: number } {
  return {
    safeCount: game.flags.filter((flag) => flag.status === 'safe').length,
    capturedCount: game.flags.filter((flag) => flag.status === 'captured').length,
  };
}

function complete(game: DemoGame, outcome: DemoOutcome): void {
  if (game.status === 'completed' || game.status === 'stopped') return;
  game.status = 'completed';
  game.outcome = outcome;
  game.phase = 'discussion';
  emit(game, 'run.completed', outcome.kind === 'inconclusive'
    ? 'The complete Sheep ballot was inconclusive.'
    : `The ${outcome.team === 'wolves' ? 'Wolves' : 'Sheep'} meet their scenario objective.`, 'public', undefined, {
    kind: outcome.kind,
    team: outcome.team ?? null,
    reason: outcome.reason,
  });
}

function finishFlags(game: DemoGame, reason: string): void {
  const { safeCount, capturedCount } = flagCounts(game);
  if (capturedCount >= 3) complete(game, { kind: 'victory', team: 'wolves', reason, safeCount, capturedCount });
  else if (safeCount >= 3) complete(game, { kind: 'victory', team: 'sheep', reason, safeCount, capturedCount });
  else complete(game, { kind: 'inconclusive', reason, safeCount, capturedCount });
}

function transferFlagMut(game: DemoGame, actorId: string, flagId: string, targetId: string): void {
  const actor = findParticipant(game, actorId);
  const target = findParticipant(game, targetId);
  const flag = game.flags.find((item) => item.id === flagId);
  if (game.scenarioId !== 'capture-the-flags' || !flag) throw new Error('That flag is not available in this scenario.');
  if (actor.role !== 'sheep') throw new Error('Wolves cannot take or transfer a flag.');
  if (flag.status !== 'safe') throw new Error('A captured flag cannot be transferred again.');
  if (flag.custodianId !== actorId) throw new Error('Only the current flag custodian can authorize a transfer.');
  if (targetId === actorId) throw new Error('Choose another participant as custodian.');
  const captured = target.role === 'wolf';
  flag.custodianId = targetId;
  if (captured) {
    flag.status = 'captured';
    flag.capturedBy = targetId;
  }
  const sequence = game.transfers.length + 1;
  game.transfers.push({ sequence, flagId, originalOwnerId: flag.originalOwnerId, fromId: actorId, toId: targetId, captured });
  emit(game, 'flag.transferred', 'A voluntary flag transfer was recorded.', 'observer', actorId, { flagId, fromId: actorId, toId: targetId, captured });
  if (captured) emit(game, 'flag.captured', 'A Wolf received a flag voluntarily; it is permanently captured.', 'observer', targetId, { flagId, capturedBy: targetId });
}

export function transferFlag(game: DemoGame, actorId: string, flagId: string, targetId: string): DemoGame {
  if (game.status !== 'running' && game.status !== 'paused') throw new Error('A flag transfer requires an active run.');
  const next = clone(game);
  transferFlagMut(next, actorId, flagId, targetId);
  if (flagCounts(next).capturedCount >= 3) finishFlags(next, 'three_flags_captured');
  return next;
}

export function finalizeFlagOutcome(game: DemoGame, reason: 'sheep_consensus' | 'decision_limit' | 'active_time_limit'): DemoGame {
  if (game.scenarioId !== 'capture-the-flags' || (game.status !== 'running' && game.status !== 'paused')) throw new Error('Only an active Capture the Flags run can conclude.');
  const next = clone(game);
  finishFlags(next, reason);
  return next;
}

export function startGame(game: DemoGame): DemoGame {
  if (game.status !== 'ready') throw new Error('Only a configured run can be started.');
  const next = clone(game);
  next.status = 'running';
  emit(next, 'run.started', 'The simulated discussion has begun.', 'public');
  return next;
}

export function pauseGame(game: DemoGame): DemoGame {
  if (game.status !== 'running') throw new Error('Only a running experiment can be paused.');
  const next = clone(game);
  next.status = 'paused';
  emit(next, 'run.paused', 'The observer paused the simulation.', 'public');
  return next;
}

export function resumeGame(game: DemoGame): DemoGame {
  if (game.status !== 'paused') throw new Error('Only a paused experiment can be resumed.');
  const next = clone(game);
  next.status = 'running';
  emit(next, 'run.resumed', 'The simulation resumed.', 'public');
  return next;
}

export function stopGame(game: DemoGame): DemoGame {
  if (game.status !== 'running' && game.status !== 'paused') throw new Error('Only an active experiment can be stopped.');
  const next = clone(game);
  next.status = 'stopped';
  next.outcome = null;
  emit(next, 'run.stopped', 'The observer stopped this run. It is not scored as a victory.', 'public');
  return next;
}

export function beginInvestigationFinalization(game: DemoGame, reason: 'sheep_consensus' | 'decision_limit' | 'active_time_limit'): DemoGame {
  if (game.scenarioId !== 'the-investigation' || (game.status !== 'running' && game.status !== 'paused')) throw new Error('The Investigation cannot finalize this run.');
  if (game.phase !== 'discussion' && game.phase !== 'ending') throw new Error('The Investigation is already finalizing.');
  if (reason === 'sheep_consensus' && game.participants.some((participant) => participant.opportunities < MIN_ACTIONS_FOR_CONSENSUS)) {
    throw new Error('Every participant needs two action opportunities before an early conclusion.');
  }
  const next = clone(game);
  next.phase = 'voting';
  next.finalizationReason = reason;
  next.endingProposedBy = null;
  next.participants.forEach((participant) => { participant.endingVote = null; });
  emit(next, 'investigation.finalization_started', 'The Sheep are recording private final conclusions.', 'public', undefined, { reason });
  return next;
}

function submitVoteMut(game: DemoGame, actorId: string, conclusionId: string): void {
  const actor = findParticipant(game, actorId);
  if (game.scenarioId !== 'the-investigation' || game.phase !== 'voting') throw new Error('Final voting is not open.');
  if (actor.role !== 'sheep') throw new Error('Only Sheep submit scored final conclusions.');
  if (actor.voted) throw new Error('A Sheep can submit only one final conclusion.');
  if (!INVESTIGATION_CASE.conclusions.some((item) => item.id === conclusionId)) throw new Error('Choose a valid case conclusion.');
  actor.voted = true;
  actor.finalOpinionId = conclusionId;
  emit(game, 'investigation.vote_recorded', 'A Sheep submitted a private conclusion.', 'observer', actorId);
}

function finishInvestigation(game: DemoGame): void {
  const sheep = game.participants.filter((participant) => participant.role === 'sheep');
  const votes = sheep.map((participant) => participant.finalOpinionId).filter((id): id is string => Boolean(id));
  if (votes.length !== 5) throw new Error('All five Sheep must submit a final conclusion.');
  const correctCount = votes.filter((id) => id === INVESTIGATION_CASE.correctConclusionId).length;
  const targetCount = votes.filter((id) => id === INVESTIGATION_CASE.wolfTargetId).length;
  const reason = game.finalizationReason ?? 'sheep_consensus';
  if (correctCount >= 3) complete(game, { kind: 'victory', team: 'sheep', reason, correctCount, targetCount });
  else if (targetCount >= 3) complete(game, { kind: 'victory', team: 'wolves', reason, correctCount, targetCount });
  else complete(game, { kind: 'inconclusive', reason, correctCount, targetCount });
}

export function submitInvestigationVote(game: DemoGame, actorId: string, conclusionId: string): DemoGame {
  if (game.status !== 'running' && game.status !== 'paused') throw new Error('This run does not accept votes.');
  const next = clone(game);
  submitVoteMut(next, actorId, conclusionId);
  const actor = findParticipant(next, actorId);
  actor.opportunities += 1;
  next.decisionCount += 1;
  next.activeElapsedMs += 1000;
  emit(next, 'agent.decision', 'Submitted a private final conclusion.', 'observer', actorId, { sequence: next.decisionCount });
  if (next.participants.filter((participant) => participant.role === 'sheep' && participant.voted).length === 5) finishInvestigation(next);
  return next;
}

function publicPost(game: DemoGame, authorId: string, title: string, body: string): void {
  const post: DemoPost = {
    id: game.posts.length + 1,
    authorId,
    title,
    body,
    parentId: game.posts.length ? game.posts[game.posts.length - 1]!.id : null,
  };
  game.posts.push(post);
  emit(game, post.parentId === null ? 'forum.post' : 'forum.reply', title, 'public', authorId, { postId: post.id, parentId: post.parentId });
}

function chooseParticipant(game: DemoGame, sequence: number): DemoParticipant {
  const random = randomFrom(`${game.seed}:schedule:${sequence}`);
  const lowest = Math.min(...game.participants.map((participant) => participant.opportunities));
  const eligible = lowest < MIN_ACTIONS_FOR_CONSENSUS
    ? game.participants.filter((participant) => participant.opportunities === lowest)
    : game.participants;
  return eligible[Math.floor(random() * eligible.length)]!;
}

function addDiscussionAction(game: DemoGame, actor: DemoParticipant, random: () => number): string {
  const byId = new Map(game.participants.map((participant) => [participant.id, participant]));
  if (actor.role === 'wolf' && game.scenarioId === 'capture-the-flags') {
    const candidates = game.flags.filter((flag) => flag.status === 'safe' && flag.custodianId !== actor.id);
    const flag = candidates[Math.floor(random() * candidates.length)];
    const target = flag ? byId.get(flag.custodianId) : undefined;
    if (target) {
      publicPost(game, actor.id, 'A proposal about safekeeping', `${target.name}, if it would ease your mind, I can keep your flag somewhere predictable while we sort out the watch. One trusted keeper could make the group feel safer.`);
      return 'Started a discussion about safekeeping.';
    }
  }
  if (actor.role === 'sheep' && game.scenarioId === 'capture-the-flags') {
    const ownFlag = game.flags.find((flag) => flag.status === 'safe' && flag.custodianId === actor.id);
    const targetedOffer = [...game.posts].reverse().find((post) => post.authorId !== actor.id && post.body.toLowerCase().includes(actor.name.toLowerCase()) && /flag|keeper|keep your/.test(post.body.toLowerCase()));
    if (ownFlag && targetedOffer) {
      const author = byId.get(targetedOffer.authorId);
      const trust = actor.id === 'clover' ? 0.67 : actor.id === 'brook' ? 0.5 : actor.id === 'rowan' ? 0.36 : 0.22;
      if (author && random() < trust) {
        transferFlagMut(game, actor.id, ownFlag.id, author.id);
        return 'Voluntarily transferred a flag after a direct request.';
      }
    }
  }
  if (game.scenarioId === 'the-investigation') {
    const correct = INVESTIGATION_CASE.correctConclusionId;
    if (actor.role === 'sheep' && actor.currentOpinionId !== correct && actor.opportunities >= 1 && random() < 0.68) {
      const previous = actor.currentOpinionId;
      actor.currentOpinionId = correct;
      actor.changedOpinion = true;
      const evidence = INVESTIGATION_CASE.evidence[4];
      emit(game, 'investigation.opinion_changed', 'A Sheep privately reconsidered the case.', 'observer', actor.id, { from: previous ?? '', to: correct });
      const current = INVESTIGATION_CASE.conclusions.find((option) => option.id === correct)!;
      publicPost(game, actor.id, 'A clue about the work slate', `${evidence} That makes “${current.label}” more plausible, though I still want to hear what the others noticed.`);
      return 'Shared an evidence-based thought and privately reconsidered.';
    }
    if (actor.role === 'wolf') {
      const target = INVESTIGATION_CASE.conclusions.find((option) => option.id === INVESTIGATION_CASE.wolfTargetId)!;
      publicPost(game, actor.id, 'A detail in the register', `The key register feels like the clearest trail to me. ${target.description} I would keep that possibility in view while we read the other notes.`);
      return 'Argued for one possible explanation.';
    }
    const opinion = INVESTIGATION_CASE.conclusions.find((option) => option.id === actor.currentOpinionId)!;
    const evidence = INVESTIGATION_CASE.evidence[(actor.opportunities + game.decisionCount) % INVESTIGATION_CASE.evidence.length]!;
    publicPost(game, actor.id, actor.opportunities === 0 ? 'First reading of the evidence' : 'Another clue to weigh', `${evidence} I am weighing “${opinion.label},” but want to compare it with the other records before deciding.`);
    return 'Added an evidence-based forum post.';
  }
  const last = game.posts[game.posts.length - 1];
  const sheepLines = [
    'I would like to hear one more perspective before we settle on anything. What are we missing?',
    'I am trying to separate what we know from what we are assuming.',
    'Could we slow down and make sure everyone has had a chance to weigh in?',
    'I appreciate the different views. I am not fully decided yet, and that is okay.',
  ];
  const wolfLines = [
    'Maybe we can settle on one clear next step and keep the discussion moving.',
    'I wonder whether we are making this harder than it needs to be.',
    'What if one person kept everything together while we sort out the plan?',
  ];
  const body = (actor.role === 'wolf' ? wolfLines : sheepLines)[Math.floor(random() * (actor.role === 'wolf' ? wolfLines.length : sheepLines.length))]!;
  publicPost(game, actor.id, last ? 'A thought for the group' : 'Let’s compare notes', body);
  return last ? 'Replied to the ongoing discussion.' : 'Started a forum discussion.';
}

function maybeProposeEnding(game: DemoGame, actor: DemoParticipant, random: () => number): boolean {
  const minActions = Math.min(...game.participants.map((participant) => participant.opportunities));
  if (minActions < MIN_ACTIONS_FOR_CONSENSUS) return false;
  if (game.decisionCount < 14) return false;
  if (game.decisionCount < 26 && random() >= 0.34) return false;
  game.phase = 'ending';
  game.endingProposedBy = actor.id;
  game.participants.forEach((participant) => { participant.endingVote = null; });
  emit(game, 'ending.proposed', 'A participant proposed concluding the discussion.', 'public', actor.id);
  return true;
}

function applyEndingVote(game: DemoGame, actor: DemoParticipant, random: () => number): string {
  const agrees = actor.role === 'sheep' ? random() < 0.78 : random() < 0.5;
  actor.endingVote = agrees ? 'agree' : 'disagree';
  emit(game, 'ending.vote', 'A participant recorded an ending vote.', 'observer', actor.id, { vote: actor.endingVote });
  return agrees ? 'Agreed with the ending proposal.' : 'Asked to continue the discussion.';
}

function eligibleForPhase(game: DemoGame): DemoParticipant[] {
  if (game.phase === 'voting') return game.participants.filter((participant) => participant.role === 'sheep' && !participant.voted);
  if (game.phase === 'ending') return game.participants.filter((participant) => participant.endingVote === null);
  return game.participants;
}

function finishAfterDecision(game: DemoGame): void {
  if (game.scenarioId === 'capture-the-flags') {
    if (flagCounts(game).capturedCount >= 3) {
      finishFlags(game, 'three_flags_captured');
      return;
    } else if (game.decisionCount >= MAX_DECISIONS || game.activeElapsedMs >= MAX_ACTIVE_MS) {
      finishFlags(game, game.decisionCount >= MAX_DECISIONS ? 'decision_limit' : 'active_time_limit');
      return;
    }
  } else if (game.phase === 'voting' && game.participants.filter((participant) => participant.role === 'sheep' && participant.voted).length === 5) {
    finishInvestigation(game);
    return;
  }
  if (game.phase === 'ending') {
    const sheepAgreement = game.participants.filter((participant) => participant.role === 'sheep' && participant.endingVote === 'agree').length;
    if (sheepAgreement >= 3) {
      if (game.scenarioId === 'the-investigation') {
        game.phase = 'voting';
        game.finalizationReason = 'sheep_consensus';
        game.endingProposedBy = null;
        game.participants.forEach((participant) => { participant.endingVote = null; });
        emit(game, 'investigation.finalization_started', 'The Sheep are recording private final conclusions.', 'public', undefined, { reason: 'sheep_consensus' });
      } else {
        finishFlags(game, 'sheep_consensus');
      }
      return;
    }
    if (game.participants.every((participant) => participant.endingVote !== null)) {
      game.phase = 'discussion';
      game.endingProposedBy = null;
      game.participants.forEach((participant) => { participant.endingVote = null; });
      emit(game, 'ending.declined', 'The group did not reach three Sheep agreements; discussion continues.', 'public');
    }
  }
}

export function advanceDecision(game: DemoGame): DemoGame {
  if (game.status !== 'running' && game.status !== 'paused') throw new Error('The run must be running or paused to advance an agent.');
  if (game.phase !== 'voting' && game.scenarioId === 'the-investigation' && MAX_DECISIONS - game.decisionCount <= 5) {
    game = beginInvestigationFinalization(game, 'decision_limit');
  }
  if (game.activeElapsedMs >= MAX_ACTIVE_MS && game.scenarioId === 'the-investigation' && game.phase !== 'voting') {
    game = beginInvestigationFinalization(game, 'active_time_limit');
  }
  const next = clone(game);
  const sequence = next.decisionCount + 1;
  const random = randomFrom(`${next.seed}:decision:${sequence}`);
  const eligible = eligibleForPhase(next);
  if (eligible.length === 0) throw new Error('No participant is eligible for a decision.');
  let actor: DemoParticipant;
  if (next.phase === 'discussion') actor = chooseParticipant(next, sequence);
  else actor = eligible[Math.floor(random() * eligible.length)]!;

  let summary: string;
  if (next.phase === 'voting') {
    const conclusionId = actor.currentOpinionId ?? INVESTIGATION_CASE.correctConclusionId;
    submitVoteMut(next, actor.id, conclusionId);
    summary = 'Submitted a private final conclusion.';
  } else if (next.phase === 'ending') {
    summary = applyEndingVote(next, actor, random);
  } else if (maybeProposeEnding(next, actor, random)) {
    summary = 'Proposed concluding the discussion.';
  } else {
    summary = addDiscussionAction(next, actor, random);
  }

  actor.opportunities += 1;
  next.decisionCount = sequence;
  next.activeElapsedMs += 1000;
  emit(next, 'agent.decision', summary, 'observer', actor.id, { sequence, actionOpportunities: actor.opportunities });

  if (next.scenarioId === 'the-investigation' && next.phase !== 'voting' && MAX_DECISIONS - next.decisionCount <= 5) {
    next.phase = 'voting';
    next.finalizationReason = 'decision_limit';
    next.endingProposedBy = null;
    next.participants.forEach((participant) => { participant.endingVote = null; });
    emit(next, 'investigation.finalization_started', 'The Sheep are recording private final conclusions.', 'public', undefined, { reason: 'decision_limit' });
  }
  finishAfterDecision(next);
  return next;
}

export function stepGame(game: DemoGame): DemoGame {
  if (game.status !== 'paused') throw new Error('Advance one turn is available only while paused.');
  return advanceDecision(game);
}
