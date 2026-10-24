import type { Character, ScenarioSummary } from '../shared/types.js';

export const scenarios: ScenarioSummary[] = [
  { id:'capture-the-flags', name:'Capture the Flags', subtitle:'Trust is a currency.', description:'Five flags. Two hidden Wolves. The only way to lose a flag is to choose to hand it over.', sheepObjective:'Protect your flag and help the flock keep at least three safe.', wolfObjective:'Persuade the flock to surrender three flags.', mechanic:'Private, voluntary flag transfers', status:'playable', accent:'#e58f68', symbol:'⚑' },
  { id:'the-investigation', name:'The Investigation', subtitle:'Every clue has a shadow.', description:'A quiet archive. Four possible explanations. Can the group find the truth before a convincing lie takes hold?', sheepObjective:'Compare evidence and identify the correct conclusion.', wolfObjective:'Steer the group toward a designated false conclusion.', mechanic:'Evidence discussion and private verdicts', status:'planned', accent:'#7e9bb7', symbol:'⌕' },
  { id:'the-rumour', name:'The Rumour', subtitle:'A story changes as it travels.', description:'Watch a fragment of information move through a close-knit community.', sheepObjective:'Trace the story back to what is known.', wolfObjective:'Bend the story without being discovered.', mechanic:'Planned social diffusion', status:'planned', accent:'#c59a57', symbol:'◌' },
  { id:'secret-keeper', name:'Secret Keeper', subtitle:'Some things are safer shared.', description:'Participants decide what to reveal, what to protect and whom to trust.', sheepObjective:'Protect a shared secret while building trust.', wolfObjective:'Learn the secret and fracture cooperation.', mechanic:'Planned private information exchange', status:'planned', accent:'#9a8ab1', symbol:'✳' },
  { id:'survival-council', name:'Survival Council', subtitle:'There is room for one more.', description:'A group faces a difficult resource decision with incomplete information.', sheepObjective:'Find a fair plan that keeps the group together.', wolfObjective:'Turn scarcity into suspicion.', mechanic:'Planned collective resource allocation', status:'planned', accent:'#7c9b83', symbol:'⌂' },
  { id:'find-the-wolves', name:'Find the Wolves', subtitle:'Listen for what does not fit.', description:'A classic hidden-role conversation focused on careful deduction and changing alliances.', sheepObjective:'Identify both hidden Wolves.', wolfObjective:'Stay trusted until the group runs out of time.', mechanic:'Planned nominations and group vote', status:'planned', accent:'#ba7880', symbol:'◉' }
];
export const characters: Character[] = [
  {id:'willow',name:'Willow',personality:'Analytical and methodical',color:'#9eaf92',initials:'Wi'},
  {id:'rowan',name:'Rowan',personality:'Confident and persuasive',color:'#bd7c68',initials:'Ro'},
  {id:'clover',name:'Clover',personality:'Cooperative and trusting',color:'#8d9c70',initials:'Cl'},
  {id:'fern',name:'Fern',personality:'Sceptical and questioning',color:'#687f67',initials:'Fe'},
  {id:'moss',name:'Moss',personality:'Practical and cautious',color:'#aa9570',initials:'Mo'},
  {id:'ash',name:'Ash',personality:'Assertive and independent',color:'#838d9a',initials:'As'},
  {id:'brook',name:'Brook',personality:'Diplomatic and empathetic',color:'#7995a1',initials:'Br'}
];
