// Improving someone's Summary (called prep inside the app): Edit keeps the rep's
// own words and goal (lib/prep.ts), and Ask writes or improves the words. Used by
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
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { buildBrief, insightFor, summaryOf, type Brief } from '@/lib/brief';
import { useChat } from '@/lib/chat';
import { sentence } from '@/lib/format';
import { GOAL_MAX, goalWithoutYours, IMPROVE_PREP, isThinPrep, prepEdit, START_PREP, TEXT_MAX } from '@/lib/prep';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

/**
 * Asks a question in someone's own Ask and opens it there, with the answer on
 * its way. With `fromSummary`, "Use this summary" then goes back to where it came from.
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
  const ask = useAskAboutPrep();
  const { openEdit, sheet } = usePrepSheet();
  const thin = isThinPrep(brief ?? buildBrief(entity, ctx), prepEdit(ctx.ws, entity.id));
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

/**
 * The rep's own words in the Summary, after the facts from the data, and their
 * goal. Both empty goes back to the ones written from the data.
 */
function PrepForm({ entity, onDone }: { entity: Entity; onDone: () => void }) {
  const ctx = useWorkspace();
  const own = prepEdit(ctx.ws, entity.id);
  const [text, setText] = useState(own?.text ?? '');
  const [goal, setGoal] = useState(own?.goal ?? '');

  const save = () => {
    ctx.editPrep(entity.id, { goal, text });
    AccessibilityInfo.announceForAccessibility('Summary saved');
    onDone();
  };

  return (
    <>
      <SheetBody>
        <Field
          label="Summary"
          id="prep-summary"
          hint="It starts with the facts above, which keep themselves up to date. Write the rest as you’d tell a colleague, or leave it empty to use the words in grey. Keep patient details out."
        >
          <Text className="rounded-lg bg-muted px-3 py-2 text-sm leading-5">{summaryOf(entity, ctx)}</Text>
          <Textarea
            value={text}
            onChangeText={setText}
            maxLength={TEXT_MAX}
            numberOfLines={Platform.select({ web: 6, native: 8 })}
            className="min-h-36"
            placeholder={sentence(insightFor(entity))}
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
        <FinePrint>What you write is kept on this phone. The facts, and the rest of the full summary, keep themselves up to date.</FinePrint>
      </SheetBody>
      <Footer onCancel={onDone} onSave={save} saveLabel="Save summary" error={null} />
    </>
  );
}
