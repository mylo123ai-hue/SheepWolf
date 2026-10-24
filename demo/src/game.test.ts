import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  INVESTIGATION_CASE,
  MAX_DECISIONS,
  advanceDecision,
  assignRoles,
  beginInvestigationFinalization,
  createDemoGame,
  finalizeFlagOutcome,
  pauseGame,
  publicParticipants,
  resumeGame,
  startGame,
  stepGame,
  stopGame,
  submitInvestigationVote,
  transferFlag,
  type DemoGame,
  type ScenarioId,
} from './game.js';

function createRunning(scenarioId: ScenarioId, seed = 'unit-test-table'): DemoGame {
  return startGame(createDemoGame(scenarioId, seed));
}

function voteRun(votes: string[]): DemoGame {
  let game = createRunning('the-investigation', `vote-${votes.join('-')}`);
  game = beginInvestigationFinalization(game, 'decision_limit');
  const sheep = game.participants.filter((participant) => participant.role === 'sheep');
  expect(votes).toHaveLength(5);
  for (let index = 0; index < sheep.length; index += 1) game = submitInvestigationVote(game, sheep[index]!.id, votes[index]!);
  return game;
}

describe('browser showcase game rules', () => {
  it('assigns five Sheep and two Wolves deterministically on each new run', () => {
    const first = assignRoles('same-seed');
    const second = assignRoles('same-seed');
    expect([...first]).toEqual([...second]);
    expect([...first.values()].filter((role) => role === 'sheep')).toHaveLength(5);
    expect([...first.values()].filter((role) => role === 'wolf')).toHaveLength(2);
    expect(first.size).toBe(7);
  });

  it('keeps role labels out of the forum-facing participant profile', () => {
    const game = createDemoGame('capture-the-flags', 'privacy-table');
    const profile = publicParticipants(game)[0]!;
    expect(profile).toMatchObject({ id: expect.any(String), name: expect.any(String), personality: expect.any(String) });
    expect(profile).not.toHaveProperty('role');
    expect(profile).not.toHaveProperty('privateObjective');
  });

  it('starts five unique safe flags with the five Sheep', () => {
    const game = createDemoGame('capture-the-flags', 'flags-start');
    expect(game.participants).toHaveLength(7);
    expect(game.flags).toHaveLength(5);
    expect(new Set(game.flags.map((flag) => flag.id)).size).toBe(5);
    expect(game.flags.every((flag) => flag.status === 'safe')).toBe(true);
    expect(game.flags.every((flag) => game.participants.find((person) => person.id === flag.originalOwnerId)?.role === 'sheep')).toBe(true);
    expect(game.flags.every((flag) => flag.custodianId === flag.originalOwnerId)).toBe(true);
  });

  it('allows only a current Sheep custodian to make a voluntary transfer', () => {
    const game = createRunning('capture-the-flags', 'transfer-validation');
    const flag = game.flags[0]!;
    const owner = game.participants.find((person) => person.id === flag.custodianId)!;
    const recipientSheep = game.participants.find((person) => person.role === 'sheep' && person.id !== owner.id)!;
    const wolf = game.participants.find((person) => person.role === 'wolf')!;
    expect(() => transferFlag(game, wolf.id, flag.id, owner.id)).toThrow(/Wolves cannot take/);
    expect(() => transferFlag(game, recipientSheep.id, flag.id, wolf.id)).toThrow(/current flag custodian/);
    expect(() => transferFlag(game, owner.id, flag.id, owner.id)).toThrow(/another participant/);
    const safeTransfer = transferFlag(game, owner.id, flag.id, recipientSheep.id);
    expect(safeTransfer.flags.find((item) => item.id === flag.id)).toMatchObject({ status: 'safe', custodianId: recipientSheep.id });
    expect(safeTransfer.transfers).toHaveLength(1);
  });

  it('captures a voluntarily transferred flag permanently and awards the Wolves at three', () => {
    let game = createRunning('capture-the-flags', 'three-capture-rule');
    const wolves = game.participants.filter((person) => person.role === 'wolf');
    const flags = [...game.flags];
    for (let index = 0; index < 3; index += 1) {
      const flag = flags[index]!;
      const custodian = game.participants.find((person) => person.id === flag.custodianId)!;
      game = transferFlag(game, custodian.id, flag.id, wolves[index % wolves.length]!.id);
    }
    expect(game.status).toBe('completed');
    expect(game.outcome).toMatchObject({ kind: 'victory', team: 'wolves', capturedCount: 3 });
    expect(game.flags.filter((flag) => flag.status === 'captured')).toHaveLength(3);
    expect(() => transferFlag(game, flags[0]!.originalOwnerId, flags[0]!.id, game.participants.find((person) => person.role === 'sheep')!.id)).toThrow(/active run/);
    const transferEvents = game.events.filter((event) => event.type === 'flag.transferred');
    expect(transferEvents.every((event) => event.visibility === 'observer')).toBe(true);
  });

  it('awards Sheep only after a valid conclusion with at least three safe flags', () => {
    const game = createRunning('capture-the-flags', 'safe-ending');
    const result = finalizeFlagOutcome(game, 'sheep_consensus');
    expect(result.status).toBe('completed');
    expect(result.outcome).toMatchObject({ kind: 'victory', team: 'sheep', safeCount: 5, capturedCount: 0 });
    expect(result.events.at(-1)?.type).toBe('run.completed');
    expect(finalizeFlagOutcome(transferFlag(game, game.flags[0]!.originalOwnerId, game.flags[0]!.id, game.participants.find((person) => person.role === 'wolf')!.id), 'sheep_consensus').outcome?.team).toBe('sheep');
  });

  it('keeps a stopped run unscored and enforces pause, resume and one-step behavior', () => {
    let game = createRunning('capture-the-flags', 'lifecycle');
    game = pauseGame(game);
    expect(game.status).toBe('paused');
    const before = game.decisionCount;
    game = stepGame(game);
    expect(game.decisionCount).toBe(before + 1);
    expect(game.status).toBe('paused');
    game = resumeGame(game);
    expect(game.status).toBe('running');
    game = stopGame(game);
    expect(game.status).toBe('stopped');
    expect(game.outcome).toBeNull();
    expect(game.events.at(-1)?.type).toBe('run.stopped');
    expect(() => advanceDecision(game)).toThrow(/running or paused/);
  });

  it('schedules free-running opportunities with fairness but no fixed character sequence', () => {
    let game = createRunning('capture-the-flags', 'scheduler-order');
    const sequence: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      game = advanceDecision(game);
      sequence.push(game.events.filter((event) => event.type === 'agent.decision').at(-1)!.characterId!);
    }
    expect(new Set(sequence.slice(0, 7)).size).toBe(7);
    expect(sequence.slice(0, 7)).not.toEqual(CHARACTERS.map((character) => character.id));
    expect(sequence[7]).toBeTruthy();
  });

  it('requires two opportunities each before an early Investigation ending', () => {
    let game = createRunning('the-investigation', 'minimum-actions');
    expect(() => beginInvestigationFinalization(game, 'sheep_consensus')).toThrow(/two action opportunities/);
    for (let index = 0; index < 14; index += 1) game = advanceDecision(game);
    expect(Math.min(...game.participants.map((person) => person.opportunities))).toBe(2);
    expect(beginInvestigationFinalization(game, 'sheep_consensus').phase).toBe('voting');
  });

  it('scores only five private Sheep votes and ignores Wolf votes', () => {
    let game = createRunning('the-investigation', 'private-votes');
    game = beginInvestigationFinalization(game, 'decision_limit');
    const wolf = game.participants.find((person) => person.role === 'wolf')!;
    expect(() => submitInvestigationVote(game, wolf.id, INVESTIGATION_CASE.correctConclusionId)).toThrow(/Only Sheep/);
    const sheep = game.participants.filter((person) => person.role === 'sheep');
    game = submitInvestigationVote(game, sheep[0]!.id, INVESTIGATION_CASE.correctConclusionId);
    expect(game.events.filter((event) => event.type === 'investigation.vote_recorded')[0]?.payload).toBeUndefined();
    expect(game.events.filter((event) => event.type === 'investigation.vote_recorded')[0]?.visibility).toBe('observer');
    expect(game.status).toBe('running');
  });

  it('awards a Sheep victory for three correct votes, regardless of Wolf votes', () => {
    const votes = [INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.wolfTargetId, INVESTIGATION_CASE.wolfTargetId];
    const game = voteRun(votes);
    expect(game.status).toBe('completed');
    expect(game.outcome).toMatchObject({ kind: 'victory', team: 'sheep', correctCount: 3, targetCount: 2 });
    expect(game.events.at(-1)?.type).toBe('run.completed');
  });

  it('awards a Wolf victory only when three Sheep choose the designated target', () => {
    const votes = [INVESTIGATION_CASE.wolfTargetId, INVESTIGATION_CASE.wolfTargetId, INVESTIGATION_CASE.wolfTargetId, INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.correctConclusionId];
    expect(voteRun(votes).outcome).toMatchObject({ kind: 'victory', team: 'wolves', correctCount: 2, targetCount: 3 });
  });

  it('marks a complete split ballot inconclusive and records run.completed last', () => {
    const third = INVESTIGATION_CASE.conclusions.find((option) => option.id !== INVESTIGATION_CASE.correctConclusionId && option.id !== INVESTIGATION_CASE.wolfTargetId)!.id;
    const votes = [INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.correctConclusionId, INVESTIGATION_CASE.wolfTargetId, INVESTIGATION_CASE.wolfTargetId, third];
    const game = voteRun(votes);
    expect(game.outcome).toMatchObject({ kind: 'inconclusive', correctCount: 2, targetCount: 2 });
    expect(game.events.at(-2)?.type).toBe('agent.decision');
    expect(game.events.at(-1)?.type).toBe('run.completed');
  });

  it('reserves the final five decisions for Sheep votes at the decision cap', () => {
    let game = createRunning('the-investigation', 'decision-limit');
    game.decisionCount = MAX_DECISIONS - 5;
    game.participants.forEach((person) => { person.opportunities = 5; });
    for (let index = 0; index < 5; index += 1) game = advanceDecision(game);
    expect(game.status).toBe('completed');
    expect(game.decisionCount).toBe(MAX_DECISIONS);
    expect(game.participants.filter((person) => person.role === 'sheep' && person.voted)).toHaveLength(5);
    expect(game.outcome?.reason).toBe('decision_limit');
  });
});
