// The sample rep's starting workspace, expressed relative to "today" so the demo always looks current.

import { addDays, isoDate } from '../format';
import type { FollowUp, Interaction, PlanItem, StartPoint } from '../types';

// The sample volumes, referrals and leakage are a fixed snapshot: the twelve
// months to the end of September 2026, plus the twelve before for comparison.
// Notes, follow-ups and the plan move with today instead. Every figure says so.
export const DATA_PERIOD = 'Sample data, Oct 2025 to Sep 2026';
/** The twelve months the figures are compared with: "on last year" means these. */
export const PRIOR_PERIOD = 'Oct 2024 to Sep 2025';
/** The day after the figures end, so charts label the same quarters as DATA_PERIOD. */
export const FIGURES_END = new Date(2026, 9, 1);

export const REP = {
  name: 'Taylor Brooks',
  firstName: 'Taylor',
  team: 'Cardiovascular · Manhattan North',
};

/**
 * Sample places the day can start from, chosen on the You page (the office until
 * then). Planning distances are straight-line from the chosen one; no live location is used.
 */
export const START_POINTS: StartPoint[] = [
  { id: 'home', title: 'Home', place: 'West 96th Street', coords: [-73.9724, 40.7939] },
  { id: 'office', title: 'Office', place: 'Columbus Circle', coords: [-73.9819, 40.7681] },
];

export function seedWorkspace(today: Date) {
  const day = (offset: number) => isoDate(addDays(today, offset));
  // A visit about `offset` days ago, on the Friday before when that's a weekend, as reps don't visit then.
  const visitDay = (offset: number) => {
    let d = addDays(today, offset);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, -1);
    return isoDate(d);
  };
  // The nth working day before today, so the sample week always has visits behind it.
  const workday = (n: number) => {
    let d = today;
    for (let i = 0; i < n; ) {
      d = addDays(d, -1);
      if (d.getDay() !== 0 && d.getDay() !== 6) i++;
    }
    return isoDate(d);
  };
  // The latest given weekday (0 is Sunday) at least `atLeast` days before today, for a visit at someone's usual time.
  const weekdayAgo = (weekday: number, atLeast: number) => {
    let d = addDays(today, -atLeast);
    while (d.getDay() !== weekday) d = addDays(d, -1);
    return isoDate(d);
  };
  // Earlier tries, older than each person's last contact, for "Visits so far" on their page:
  // Tuesday mornings have worked with Dr. Patel, and Dr. Raman was met once in three tries.
  const mayaTue = weekdayAgo(2, 15);
  const mayaThu = weekdayAgo(4, 22);
  const mayaTueBefore = weekdayAgo(2, 29);
  const priyaThu = weekdayAgo(4, 110);
  const priyaTue = weekdayAgo(2, 125);

  const interactions: Interaction[] = [
    { id: 'i-maya-1', targetId: 'maya', attendees: ['maya'], date: visitDay(-12), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Reviewed her last quarter of PCI cases. She wants procedure mix against peer centres before the next cath lab meeting. Prefers a printed one-pager.' },
    { id: 'i-maya-2', targetId: 'maya', attendees: ['maya'], date: visitDay(-41), type: 'Phone call', outcome: 'Met', author: 'You', note: 'Confirmed the cath lab in-service. Asked about stock levels for the new guide catheter.' },
    { id: 'i-jordan-1', targetId: 'jordan', attendees: ['jordan'], date: visitDay(-25), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Walked through the AF referral pathway. Prefers email for materials and is open to a lunch-and-learn for fellows.' },
    { id: 'i-alex-1', targetId: 'alex', attendees: ['alex'], date: visitDay(-8), type: 'Email', outcome: 'Sent', author: 'You', note: 'Sent the ablation outcomes summary. No reply yet.' },
    { id: 'i-okafor-1', targetId: 'okafor', attendees: ['okafor'], date: visitDay(-5), type: 'In-person visit', outcome: 'Met', author: 'Jamie R. (teammate)', note: 'Heart team is evaluating TAVR sizing software and asked for clinical data.' },
    { id: 'i-sam-1', targetId: 'sam', attendees: ['sam'], date: visitDay(-60), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Introductory meeting. Interested in structural heart volume trends across the system.' },
    { id: 'i-msw-1', targetId: 'msw', attendees: [], contacts: ['Dana Ortiz'], date: visitDay(-15), type: 'Meeting', outcome: 'Met', author: 'You', note: 'Value analysis timing: next committee review in six weeks. They need a pricing proposal before then.' },
    { id: 'i-msh-1', targetId: 'msh', attendees: ['sam', 'okafor'], date: visitDay(-20), type: 'Meeting', outcome: 'Met', author: 'You', note: 'Joined the structural heart team meeting. Volume planning for next year includes a second hybrid OR.' },
    { id: 'i-priya-1', targetId: 'priya', attendees: ['priya'], date: visitDay(-95), type: 'In-person visit', outcome: 'Attempted', author: 'You', note: 'Clinic was running late. Left materials with the front desk.' },
    { id: 'i-kenji-1', targetId: 'kenji', attendees: ['kenji'], date: visitDay(-33), type: 'Phone call', outcome: 'Met', author: 'You', note: 'Discussed heart failure referral patterns to EP and device follow-up.' },
    { id: 'i-okafor-2', targetId: 'okafor', attendees: ['okafor'], date: workday(2), type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Brought the TAVR sizing data Jamie promised. He wants the heart team to see it before they choose.' },
    { id: 'i-msh-2', targetId: 'msh', attendees: [], date: workday(1), type: 'Meeting', outcome: 'Met', author: 'You', note: 'The second hybrid OR opens in spring. They asked for a training plan for the new team.' },
    { id: 'i-maya-3', targetId: 'maya', attendees: ['maya'], date: mayaTue, type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Caught her before cases. She asked how her complex PCI numbers compare.' },
    { id: 'i-maya-4', targetId: 'maya', attendees: ['maya'], date: mayaThu, type: 'In-person visit', outcome: 'Attempted', author: 'You', note: 'Called into an emergency case. Rosa offered a Tuesday instead.' },
    { id: 'i-maya-5', targetId: 'maya', attendees: ['maya'], date: mayaTueBefore, type: 'In-person visit', outcome: 'Met', author: 'You', note: 'Ten minutes before her first case. Talked through the new guide catheter.' },
    { id: 'i-priya-2', targetId: 'priya', attendees: ['priya'], date: priyaThu, type: 'In-person visit', outcome: 'Attempted', author: 'You', note: 'Clinic overran. Waited 40 minutes, then left.' },
    { id: 'i-priya-3', targetId: 'priya', attendees: ['priya'], date: priyaTue, type: 'In-person visit', outcome: 'Met', author: 'You', note: 'First visit. Keen on quicker cath referrals for her heart failure patients.' },
  ];

  const followUps: FollowUp[] = [
    { id: 'f-maya-1', targetId: 'maya', text: 'Send procedure mix vs. peers report', due: day(0), done: false, interactionId: 'i-maya-1' },
    { id: 'f-alex-1', targetId: 'alex', text: 'Call about ablation referrals leaving the system', due: day(-2), done: false, interactionId: 'i-alex-1' },
    { id: 'f-sys-1', targetId: 'msh-system', text: 'Share the TAVR pathway deck with Lauren Fischer', due: day(3), done: false },
    { id: 'f-msw-1', targetId: 'msw', text: 'Draft pricing proposal for value analysis', due: day(10), done: false, interactionId: 'i-msw-1' },
    { id: 'f-jordan-1', targetId: 'jordan', text: 'Book a lunch-and-learn for fellows', due: day(-20), done: true, doneOn: day(-21), interactionId: 'i-jordan-1' },
  ];

  const today0 = day(0);
  // Where Dr. Patel and Dr. Morgan work today (lib/data/hcps.ts), so the plan matches their days.
  const mayaSite = today.getDay() === 2 ? 'msh' : 'msw';
  const alexSite = today.getDay() === 5 ? 'msh' : 'msw';
  const plans: Record<string, PlanItem[]> = {
    [today0]: [
      { id: 'v-maya', targetId: 'maya', siteId: mayaSite, mode: 'timed', time: '10:00', duration: 30, type: 'In-person visit', goal: 'Bring the procedure mix vs. peers report.', status: 'planned', booking: 'confirmed', via: 'Rosa Diaz, scheduler' },
      { id: 'v-jordan', targetId: 'jordan', siteId: 'msm', mode: 'timed', time: '14:00', duration: 30, type: 'In-person visit', goal: 'Confirm a date for the fellows lunch-and-learn.', status: 'planned', booking: 'requested', via: 'Email' },
      { id: 'v-alex', targetId: 'alex', siteId: alexSite, mode: 'flexible', time: null, duration: 15, type: 'Phone call', goal: 'Ask about ablation referrals leaving the system.', status: 'planned' },
    ],
    // Earlier this week: one visit logged after it moved a day, one meeting logged,
    // one cancelled and one never logged, for "Summarise my week".
    [workday(1)]: [
      { id: 'v-rossi-past', targetId: 'elena', siteId: 'msm', mode: 'timed', time: '09:00', duration: 30, type: 'In-person visit', goal: 'Introduce yourself and the vascular range.', status: 'cancelled', booking: 'confirmed', via: 'Office', cancelReason: 'Can’t make it' },
      { id: 'v-msh-past', targetId: 'msh', siteId: 'msh', mode: 'timed', time: '11:00', duration: 45, type: 'Meeting', goal: 'Hear the volume plan for next year.', status: 'done', booking: 'confirmed', via: 'Office' },
    ],
    [workday(2)]: [
      { id: 'v-okafor-past', targetId: 'okafor', siteId: 'msh', mode: 'timed', time: '15:30', duration: 30, type: 'In-person visit', goal: 'Bring the TAVR sizing data.', status: 'done', booking: 'confirmed', via: 'Anne Wu, executive assistant', movedFrom: { day: workday(3), time: '15:30' } },
    ],
    [workday(3)]: [{ id: 'v-raman-past', targetId: 'priya', siteId: 'harlem', mode: 'flexible', time: null, duration: 30, type: 'In-person visit', goal: 'Try again after the missed visit.', status: 'planned' }],
    // The earlier tries noted above, each logged from the plan.
    [mayaTue]: [{ id: 'v-maya-tue', targetId: 'maya', siteId: 'msh', mode: 'timed', time: '07:30', duration: 30, type: 'In-person visit', goal: 'Show the complex PCI figures.', status: 'done', outcome: 'Met', booking: 'confirmed', via: 'Rosa Diaz, scheduler' }],
    [mayaThu]: [{ id: 'v-maya-thu', targetId: 'maya', siteId: 'msw', mode: 'timed', time: '07:30', duration: 30, type: 'In-person visit', goal: 'Follow up on the guide catheter.', status: 'done', outcome: 'Attempted', booking: 'confirmed', via: 'Rosa Diaz, scheduler' }],
    [mayaTueBefore]: [{ id: 'v-maya-tue-2', targetId: 'maya', siteId: 'msh', mode: 'timed', time: '07:45', duration: 15, type: 'In-person visit', goal: 'Introduce the new guide catheter.', status: 'done', outcome: 'Met', booking: 'confirmed', via: 'Rosa Diaz, scheduler' }],
    [priyaThu]: [{ id: 'v-priya-thu', targetId: 'priya', siteId: 'harlem', mode: 'timed', time: '12:30', duration: 30, type: 'In-person visit', goal: 'Bring the cath referral pathway.', status: 'done', outcome: 'Attempted', booking: 'requested', via: 'Office phone' }],
    [priyaTue]: [{ id: 'v-priya-tue', targetId: 'priya', siteId: 'harlem', mode: 'timed', time: '12:30', duration: 30, type: 'In-person visit', goal: 'Introduce yourself.', status: 'done', outcome: 'Met', booking: 'confirmed', via: 'Office phone' }],
  };

  return { interactions, followUps, plans };
}
