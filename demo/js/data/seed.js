// The sample rep's starting workspace, expressed relative to "today" so the demo always looks current.

import { addDays, isoDate } from '../format.js';

export const REP = {
  name: 'Taylor Brooks',
  firstName: 'Taylor',
  team: 'Cardiovascular · Manhattan North',
  // Planning distances are straight-line from this sample start point; no live location is used.
  start: { label: 'Columbus Circle', coords: [-73.9819, 40.7681] },
};

export function seedWorkspace(today) {
  const day = (offset) => isoDate(addDays(today, offset));

  const interactions = [
    { id: 'i-maya-1', targetId: 'maya', attendees: ['maya'], date: day(-12), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Reviewed her last quarter of PCI cases. She wants procedure mix against peer centres before the next cath lab meeting. Prefers a printed one-pager.' },
    { id: 'i-maya-2', targetId: 'maya', attendees: ['maya'], date: day(-41), type: 'Phone call', outcome: 'Met', author: 'You', note: 'Confirmed the cath lab in-service. Asked about stock levels for the new guide catheter.' },
    { id: 'i-jordan-1', targetId: 'jordan', attendees: ['jordan'], date: day(-25), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Walked through the AF referral pathway. Prefers email for materials and is open to a lunch-and-learn for fellows.' },
    { id: 'i-alex-1', targetId: 'alex', attendees: ['alex'], date: day(-8), type: 'Email', outcome: 'Sent', author: 'You', note: 'Sent the ablation outcomes summary. No reply yet.' },
    { id: 'i-okafor-1', targetId: 'okafor', attendees: ['okafor'], date: day(-5), type: 'In-person visit', outcome: 'Met', author: 'Jamie R. (teammate)', note: 'Heart team is evaluating TAVR sizing software and asked for clinical data.' },
    { id: 'i-sam-1', targetId: 'sam', attendees: ['sam'], date: day(-60), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Introductory meeting. Interested in structural heart volume trends across the system.' },
    { id: 'i-msw-1', targetId: 'msw', attendees: [], contacts: ['Dana Ortiz'], date: day(-15), type: 'Meeting', outcome: 'Met', author: 'You', note: 'Value analysis timing: next committee review in six weeks. They need a pricing proposal before then.' },
    { id: 'i-msh-1', targetId: 'msh', attendees: ['sam', 'okafor'], date: day(-20), type: 'Meeting', outcome: 'Met', author: 'You', note: 'Joined the structural heart team meeting. Volume planning for next year includes a second hybrid OR.' },
    { id: 'i-priya-1', targetId: 'priya', attendees: ['priya'], date: day(-95), type: 'In-person visit', outcome: 'Attempted', author: 'You', note: 'Clinic was running late. Left materials with the front desk.' },
    { id: 'i-kenji-1', targetId: 'kenji', attendees: ['kenji'], date: day(-33), type: 'Phone call', outcome: 'Met', author: 'You', note: 'Discussed heart failure referral patterns to EP and device follow-up.' },
  ];

  const followUps = [
    { id: 'f-maya-1', targetId: 'maya', text: 'Send procedure mix vs. peers report', due: day(0), done: false, interactionId: 'i-maya-1' },
    { id: 'f-alex-1', targetId: 'alex', text: 'Call about ablation referrals leaving the system', due: day(-2), done: false, interactionId: 'i-alex-1' },
    { id: 'f-sys-1', targetId: 'msh-system', text: 'Share the TAVR pathway deck with Lauren Fischer', due: day(3), done: false },
    { id: 'f-msw-1', targetId: 'msw', text: 'Draft pricing proposal for value analysis', due: day(10), done: false, interactionId: 'i-msw-1' },
    { id: 'f-jordan-1', targetId: 'jordan', text: 'Book a lunch-and-learn for fellows', due: day(-20), done: true, doneOn: day(-21), interactionId: 'i-jordan-1' },
  ];

  const today0 = day(0);
  const plans = {
    [today0]: [
      { id: 'v-maya', targetId: 'maya', siteId: 'msw', mode: 'timed', time: '10:00', duration: 30, type: 'In-person visit', goal: 'Bring the procedure mix vs. peers report.', status: 'planned' },
      { id: 'v-jordan', targetId: 'jordan', siteId: 'msm', mode: 'timed', time: '14:00', duration: 30, type: 'In-person visit', goal: 'Confirm a date for the fellows lunch-and-learn.', status: 'planned' },
      { id: 'v-alex', targetId: 'alex', siteId: 'msw', mode: 'flexible', time: null, duration: 15, type: 'Phone call', goal: 'Ask about ablation referrals leaving the system.', status: 'planned' },
    ],
  };

  return { interactions, followUps, plans };
}
