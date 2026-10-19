// What the menu's Saved list holds (visit prep and reports kept from Ask), "save
// that" in a chat, and + on Targets putting someone in the day's plan.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer } from '@/lib/ask';
import { ChatProvider, TERRITORY, useChat } from '@/lib/chat';
import { getEntity } from '@/lib/data';
import { firstSentence, isoDate, startOfDay } from '@/lib/format';
import { buildPrep, docText, prepId, prepTarget, reportDoc, reportFrom } from '@/lib/saved';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Entity } from '@/lib/types';
import { addToPlan, buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const ctx = buildContext(freshWorkspace(today), today);
const entity = (id: string) => getEntity(id) as Entity;

describe('visit prep', () => {
  test('has the goal, why now and talking points, and finds its way back to the person', () => {
    const doc = buildPrep(entity('maya'), ctx);
    expect(prepTarget(doc.id)).toBe('maya');
    expect(prepTarget(prepId('msw'))).toBe('msw');
    expect(prepTarget('r-123')).toBeNull();
    expect(doc).toMatchObject({ kind: 'prep', title: 'Prep for Dr. Patel', about: 'maya' });
    expect(doc.summary).toMatch(/^Goal: Bring the procedure mix vs\. peers report/);
    expect(doc.when).toMatch(/^Today, .* · 10:00–10:30 · /);
    expect(doc.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['Why now', 'Talking points']));
    expect(doc.scope).toEqual(['Sample data']);
  });

  test('adds what the rep asked, newest first', () => {
    const doc = buildPrep(entity('maya'), ctx, [
      { question: 'Where does she refer?', answer: 'Mostly to Hudson Heart Institute.', at: 1 },
      { question: 'When is she free?', answer: 'Tuesday and Thursday mornings.', at: 2 },
    ]);
    const asked = doc.sections.find((s) => s.title === 'From your questions');
    expect(asked?.lines.map((l) => l.label)).toEqual(['You asked: When is she free?', 'You asked: Where does she refer?']);
    expect(doc.scope).toEqual(['Sample data', '2 questions you asked']);
  });

  test('someone with nothing planned gets a suggested goal', () => {
    const doc = buildPrep(entity('hannah'), ctx);
    expect(doc.when).toBe('No visit planned yet');
    expect(doc.summary).toMatch(/^Suggested goal: /);
  });
});

describe('reports', () => {
  test('a saved answer keeps its question, title and rows, and reads as plain text', () => {
    const question = 'Who is near Mount Sinai West?';
    const report = reportFrom(question, answer(question, ctx), today);
    expect(report).toMatchObject({ title: 'Who is nearby · Mount Sinai West', question, savedOn: todayIso, about: 'msw' });
    const doc = reportDoc(report, today);
    expect(doc).toMatchObject({ kind: 'report', when: 'Saved today', question });
    expect(doc.sections[0].lines.length).toBe(report.rows.length);
    const text = docText(doc, new Date(2026, 9, 19, 14, 2));
    expect(text).toContain(`Asked: ${question}`);
    expect(text).toContain(report.summary);
    const [scope, footer] = text.trim().split('\n').slice(-2);
    expect(scope).toMatch(/Sample data$/);
    expect(footer).toBe('From Field Pro, 19 Oct 2026, 14:02. For internal use: check it before it goes outside the company.');
  });
});

describe('save that', () => {
  async function renderChat() {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today}>
        <ChatProvider>{children}</ChatProvider>
      </WorkspaceProvider>
    );
    const { result } = await renderHook(() => ({ ws: useWorkspace(), chat: useChat() }), { wrapper });
    return result;
  }

  test('keeps the last answer once, and says so when asked again', async () => {
    const r = await renderChat();
    await act(async () => {
      await r.current.chat.ask(TERRITORY, 'Who is near Mount Sinai West?');
    });
    let reply = '';
    await act(async () => {
      reply = (await r.current.chat.ask(TERRITORY, 'save that')).answer?.summary ?? '';
    });
    expect(reply).toBe('Saved “Who is nearby · Mount Sinai West”. It’s in the menu under Saved.');
    expect(r.current.ws.ws.saved.map((s) => s.title)).toEqual(['Who is nearby · Mount Sinai West']);

    await act(async () => {
      reply = (await r.current.chat.ask(TERRITORY, 'Save it.')).answer?.summary ?? '';
    });
    expect(reply).toBe('That one’s already saved. It’s in the menu under Saved.');
    expect(r.current.ws.ws.saved).toHaveLength(1);
  });

  test('with nothing asked yet there is nothing to keep', async () => {
    const r = await renderChat();
    let reply = '';
    await act(async () => {
      reply = (await r.current.chat.ask(TERRITORY, 'save that')).answer?.summary ?? '';
    });
    expect(reply).toMatch(/^Ask me something first/);
    expect(r.current.ws.ws.saved).toHaveLength(0);
  });
});

describe('+ Add on Targets', () => {
  test('puts someone in the day at no fixed time, once', () => {
    const ws = freshWorkspace(today);
    const before = ws.plans[todayIso].length;
    const next = addToPlan(ws, todayIso, 'hannah');
    const added = next.plans[todayIso].filter((i) => i.targetId === 'hannah');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ status: 'planned' });
    expect(added[0].mode).not.toBe('timed');
    expect(next.plans[todayIso]).toHaveLength(before + 1);
    expect(addToPlan(next, todayIso, 'hannah').plans[todayIso]).toHaveLength(before + 1);
    expect(addToPlan(ws, todayIso, 'nobody')).toBe(ws);
  });
});

describe('firstSentence', () => {
  test('doesn’t stop at Dr. or vs.', () => {
    expect(firstSentence('Steady referrer to Dr. Alex Morgan, but volume is down. Open to a lunch.')).toBe('Steady referrer to Dr. Alex Morgan, but volume is down.');
    expect(firstSentence('Bring the mix vs. peers report. Then ask.')).toBe('Bring the mix vs. peers report.');
    expect(firstSentence('No full stop')).toBe('No full stop');
  });
});
