// Improving someone's Summary (called prep inside the app): Edit keeps the rep's
// own summary and goal (lib/prep.ts), and Ask helps write or improve it. Used by
// the Summary card on someone's page (components/summary-card.tsx) and the full
// Summary (screens/saved-doc.tsx).

import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useChatHref } from '@/components/entity';
import { Field, Footer, SheetBody, SheetContent } from '@/components/note-sheet';
import { FinePrint } from '@/components/profile';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildBrief, summaryOf, type Brief } from '@/lib/brief';
import { useChat } from '@/lib/chat';
import { GOAL_MAX, goalWithoutYours, IMPROVE_PREP, isThinPrep, MAX_POINTS, POINT_MAX, prepEdit, START_PREP } from '@/lib/prep';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

/**
 * Asks a question in someone's own Ask and opens it there, with the answer on
 * its way. With `fromSummary`, "Add to summary" then goes back to where it came from.
 */
export function useAskAboutPrep() {
  const chat = useChat();
  const chatHref = useChatHref();
  return (entity: Entity, question: string, fromSummary = false) => {
    void chat.ask(entity.id, question);
    router.push(chatHref(entity, false, fromSummary));
  };
}

/**
 * The Summary's two buttons. Improve with Ask, or Write a summary with Ask when
 * there's nothing much to go on yet (isThinPrep in lib/prep.ts), and Edit.
 * Render `sheet` for Edit.
 */
export function useSummaryActions(entity: Entity, brief?: Brief) {
  const ctx = useWorkspace();
  const chat = useChat();
  const ask = useAskAboutPrep();
  const { openEdit, sheet } = usePrepSheet();
  const thin = isThinPrep(brief ?? buildBrief(entity, ctx), prepEdit(ctx.ws, entity.id), chat.asked(entity.id));
  return {
    thin,
    improveLabel: thin ? 'Write a summary with Ask' : 'Improve with Ask',
    improve: () => ask(entity, thin ? START_PREP : IMPROVE_PREP, true),
    edit: () => openEdit(entity),
    sheet,
  };
}

/** The Edit summary sheet. Render `sheet`, then `openEdit(person)`. */
export function usePrepSheet() {
  const [who, setWho] = useState<Entity | null>(null);
  const close = () => setWho(null);
  return {
    openEdit: (entity: Entity) => setWho(entity),
    sheet: (
      <Dialog open={!!who} onOpenChange={(open) => !open && close()}>
        {who ? (
          <SheetContent title="Edit summary" target={who}>
            <PrepForm entity={who} onDone={close} />
          </SheetContent>
        ) : null}
      </Dialog>
    ),
  };
}

/** The rep's own summary, one point to a line, and goal. Both empty goes back to the ones written from the data. */
function PrepForm({ entity, onDone }: { entity: Entity; onDone: () => void }) {
  const ctx = useWorkspace();
  const own = prepEdit(ctx.ws, entity.id);
  const [summary, setSummary] = useState(own?.points.join('\n') ?? '');
  const [goal, setGoal] = useState(own?.goal ?? '');

  const save = () => {
    ctx.editPrep(entity.id, { goal, points: summary.split('\n') });
    AccessibilityInfo.announceForAccessibility('Summary saved');
    onDone();
  };

  return (
    <>
      <SheetBody>
        <Field label="Summary" id="prep-summary" hint="One point on each line. Leave it empty to use the one in grey. Keep patient details out.">
          <Textarea
            value={summary}
            onChangeText={setSummary}
            maxLength={MAX_POINTS * POINT_MAX}
            numberOfLines={Platform.select({ web: 6, native: 8 })}
            className="min-h-36"
            placeholder={summaryOf(entity, ctx)}
            accessibilityLabel="Summary"
            aria-labelledby="prep-summary"
          />
        </Field>
        <Field label="Your goal" id="prep-goal" hint="Leave it empty to use the one in grey.">
          <Input
            value={goal}
            onChangeText={setGoal}
            maxLength={GOAL_MAX}
            placeholder={goalWithoutYours(entity, ctx)}
            accessibilityLabel="Your goal"
            aria-labelledby="prep-goal"
          />
        </Field>
        <FinePrint>Kept on this phone. The rest of the full summary is written from the data and keeps itself up to date.</FinePrint>
      </SheetBody>
      <Footer onCancel={onDone} onSave={save} saveLabel="Save summary" error={null} />
    </>
  );
}
