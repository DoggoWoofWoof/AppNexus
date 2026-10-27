// The chat used by the Ask tab and by each profile's own Ask: questions on the
// right, answers on the left, suggestions to tap and one box to type or talk in.
// An answer leads with one sentence, then the figures behind it and one next step.
// One about someone the rep could see ends by asking to add them, with "Yes, add
// to today" first among the replies to tap, which goes to Today once they're in.
// A conversation reopened from History says when it started, since its answers
// are as they were then.

import { router } from 'expo-router';
import { ArrowUp, Bookmark, BookmarkCheck, ChevronRight, Mic, Square, Volume2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Delta } from '@/components/charts';
import { useDocHref, useProfileHref } from '@/components/entity';
import { useTab } from '@/components/tab-stack';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { spoken, type Answer, type AnswerRow, type AskLink } from '@/lib/ask';
import { useChat, whenLabel, type Turn } from '@/lib/chat';
import { isCodePick } from '@/lib/codes';
import { getEntity } from '@/lib/data';
import { sentence, startOfDay } from '@/lib/format';
import { summaryText } from '@/lib/prep';
import { prepId } from '@/lib/saved';
import { readSearchLink } from '@/lib/search';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';
import { canListen, canSpeak, listen, speak, stopSpeaking, VOICE_ERRORS, type Listening } from '@/lib/voice';

/** Questions to tap, as chips, after `yes`, the reply that says yes to what the answer asked. */
export function QuestionChips({ questions, onPick, yes }: { questions: string[]; onPick: (q: string) => void; yes?: string }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {yes ? (
        <Pressable
          onPress={() => onPick(yes)}
          accessibilityRole="button"
          accessibilityHint="Adds them and opens Today"
          hitSlop={4}
          className="min-h-10 max-w-full justify-center rounded-full bg-primary px-3 py-1.5 active:opacity-80"
        >
          <Text className="text-sm font-medium text-primary-foreground">{yes}</Text>
        </Pressable>
      ) : null}
      {questions.map((q) => (
        <Pressable
          key={q}
          onPress={() => onPick(q)}
          accessibilityRole="button"
          accessibilityHint="Asks this question"
          hitSlop={4}
          className="min-h-10 max-w-full justify-center rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-sm text-brand">{q}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * A full-screen chat. `header` sits above the thread and `empty` shows until the
 * first question, with a big mic under it when the device can listen.
 * `listenOnOpen` starts the mic straight away, for the mic on a person's page.
 * `fromPrep` is a person's chat opened from their Summary, so "Use this summary" goes back there.
 */
export function ChatView({
  chatKey,
  header,
  empty,
  placeholder,
  inset = false,
  listenOnOpen = false,
  fromPrep = false,
}: {
  chatKey: string;
  header?: ReactNode;
  empty?: ReactNode;
  placeholder: string;
  inset?: boolean;
  listenOnOpen?: boolean;
  fromPrep?: boolean;
}) {
  const chat = useChat();
  const { today } = useWorkspace();
  const turns = chat.turns(chatKey);
  const { top } = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  // The question last scrolled to, so a new answer opens at its start rather than its end.
  const shown = useRef<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const { follow, openRow, sheets } = useFollow(fromPrep ? chatKey : undefined);
  const tab = useTab();

  // Stop reading when the chat closes.
  useEffect(() => () => stopSpeaking(), []);

  const read = useCallback((turn: Turn) => {
    if (!turn.answer) return;
    setReading(turn.id);
    speak(spoken(turn.answer), { onEnd: () => setReading((current) => (current === turn.id ? null : current)) });
  }, []);

  const send = async (question: string, via: Turn['via']) => {
    stopSpeaking();
    const turn = await chat.ask(chatKey, question, via);
    // Once someone is added, Today shows them in the day: back to it, or over to it from another tab.
    if (turn.answer.added) {
      if (tab === 'today') router.dismissTo('/today');
      else router.navigate('/today');
      return;
    }
    // A spoken question gets a spoken answer, for when the rep is on the move.
    if (via === 'voice') read(turn);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={inset ? 0 : 100}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6"
        contentContainerStyle={{ paddingTop: (inset ? top : 0) + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {turns.length && turns[0].at < startOfDay(today).getTime() ? (
          <Text className="text-sm text-muted-foreground">{`Started ${whenLabel(turns[0].at, today)}. Answers from before today are as they were then: figures and plans may have changed since.`}</Text>
        ) : null}
        {turns.length
          ? turns.map((turn, i) => (
              <View
                key={turn.id}
                className="gap-3"
                onLayout={(e) => {
                  if (i !== turns.length - 1 || shown.current === turn.id) return;
                  shown.current = turn.id;
                  scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 8), animated: true });
                }}
              >
                <Question turn={turn} />
                <AnswerView
                  turn={turn}
                  isLast={i === turns.length - 1}
                  reading={reading === turn.id}
                  onRead={() => {
                    if (reading !== turn.id) return read(turn);
                    stopSpeaking();
                    setReading(null);
                  }}
                  onSave={() => chat.save(chatKey, turn.id)}
                  onAsk={(q) => send(q, 'typed')}
                  onFollow={follow}
                  onOpenRow={openRow}
                />
              </View>
            ))
          : empty}
        {turns.length ? (
          <Text className="text-xs text-muted-foreground">Answers come from sample figures and your notes. Check figures before quoting them.</Text>
        ) : null}
      </ScrollView>
      <Composer key={`${tab}-${chatKey}`} placeholder={placeholder} onSend={send} listenOnOpen={listenOnOpen} big={!turns.length} />
      {sheets}
    </KeyboardAvoidingView>
  );
}

/**
 * Where an answer's next step and rows lead, opened in the tab that's showing the
 * chat. Render `sheets` for booking. `prepOf` is the person whose Summary the chat
 * was opened from, so "Use this summary" goes back there rather than opening it again.
 */
export function useFollow(prepOf?: string) {
  const ctx = useWorkspace();
  const visits = useVisitSheets();
  const profileHref = useProfileHref();
  const docHref = useDocHref();
  const follow = (link: AskLink) => {
    if (link.kind === 'tab') {
      router.navigate(`/${link.tab}`);
      return;
    }
    if (link.kind === 'saved') {
      router.push(docHref(link.id));
      return;
    }
    if (link.kind === 'targets') {
      // The territory and procedures are kept with the rep's choices, so Targets is set to them first.
      const asked = readSearchLink(link.find);
      const codes = asked?.codes;
      ctx.setPrefs({ states: asked?.states ?? [], codes: isCodePick(codes) ? codes : 'all' });
      router.navigate({ pathname: '/targets', params: { find: link.find, from: String(Date.now()) } });
      return;
    }
    if (link.kind === 'prep') {
      // An answer from before the Summary was one paragraph adds its lines after the rep's words.
      const text = link.text ?? [summaryText(ctx.ws, link.id) ?? '', ...(link.points ?? []).map(sentence)].join(' ');
      ctx.keepSummary(link.id, text);
      if (link.id === prepOf) router.back();
      else router.push(docHref(prepId(link.id)));
      return;
    }
    const entity = getEntity(link.id);
    if (!entity) return;
    if (link.kind === 'book') visits.openBook(entity);
    else router.push(profileHref(entity, link.section));
  };
  const openRow = (id: string) => {
    const e = getEntity(id);
    if (e) router.push(profileHref(e));
  };
  return { follow, openRow, sheets: visits.sheets };
}

export function Question({ turn }: { turn: Turn }) {
  return (
    <View className="max-w-[85%] flex-row items-center gap-1.5 self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2.5">
      {turn.via === 'voice' ? <Icon as={Mic} size={14} className="text-primary-foreground" /> : null}
      <Text className="shrink text-primary-foreground">{turn.question}</Text>
    </View>
  );
}

const TONE = { warn: 'text-warn' } as const;

export function AnswerView({
  turn,
  isLast,
  reading,
  onRead,
  onSave,
  onAsk,
  onFollow,
  onOpenRow,
}: {
  turn: Turn;
  isLast: boolean;
  reading: boolean;
  onRead: () => void;
  onSave: () => void;
  onAsk: (q: string) => void;
  onFollow: (link: AskLink) => void;
  onOpenRow: (id: string) => void;
}) {
  const ctx = useWorkspace();
  const a = turn.answer;
  const canSave = !!a && !a.unknown && a.intent !== 'saved';
  // Yes is there until they're in the day, from here or anywhere else.
  const yes = isLast && a?.offer && !ctx.planItemFor(a.offer.id, a.offer.day) ? a.offer.yes : undefined;
  if (!a) {
    return (
      <View className="self-start rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3" accessibilityRole="progressbar" accessibilityLabel="Working out the answer">
        <Text className="text-muted-foreground">Looking through your figures…</Text>
      </View>
    );
  }
  return (
    <>
      <View className="gap-3 rounded-2xl rounded-tl-sm border border-border bg-card p-4">
        <Text className="text-base leading-6" selectable>
          {a.summary}
        </Text>
        {a.rows.length ? (
          <View>
            {a.rows.slice(0, 6).map((row, i) => (
              <Row key={`${row.title}-${i}`} row={row} facts={!!a.facts} onOpen={onOpenRow} />
            ))}
          </View>
        ) : null}
        {a.doThis ? <NextStep step={a.doThis} onFollow={onFollow} /> : null}
        {a.offer ? <Text className="text-base font-semibold leading-6">{a.offer.question}</Text> : null}
        <View className="flex-row flex-wrap items-center gap-x-1 gap-y-1">
          <Text className="min-w-[40%] flex-1 text-2xs text-muted-foreground">{a.scope.join(' · ')}</Text>
          {canSave ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={onSave}
              disabled={!!turn.savedId}
              accessibilityLabel={turn.savedId ? 'Saved to the menu' : 'Save this answer as a report'}
            >
              <Icon as={turn.savedId ? BookmarkCheck : Bookmark} size={16} />
              <Text>{turn.savedId ? 'Saved' : 'Save'}</Text>
            </Button>
          ) : null}
          {canSpeak() ? (
            <Button size="sm" variant="ghost" onPress={onRead} accessibilityLabel={reading ? 'Stop reading' : 'Read this answer aloud'}>
              <Icon as={reading ? Square : Volume2} size={16} />
              <Text>{reading ? 'Stop' : 'Listen'}</Text>
            </Button>
          ) : null}
        </View>
      </View>
      {isLast && (yes || a.next.length) ? <QuestionChips questions={a.next} onPick={onAsk} yes={yes} /> : null}
    </>
  );
}

function Row({ row, facts, onOpen }: { row: AnswerRow; facts: boolean; onOpen: (id: string) => void }) {
  // A change on last year is the trend arrow, as everywhere: the figure when there's no other, else under the title.
  const change = row.change == null ? null : <Delta value={row.change} suffix={row.figure ? ' on last year' : ''} />;
  const body = (
    <View className="flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        {facts ? (
          <>
            <Text className="text-xs text-muted-foreground">{row.title}</Text>
            {row.sub ? <Text selectable>{row.sub}</Text> : null}
          </>
        ) : (
          <>
            <Text className={cn(row.id && 'font-semibold')}>{row.title}</Text>
            {row.sub ? <Text className="text-sm text-muted-foreground">{row.sub}</Text> : null}
          </>
        )}
        {row.figure ? change : null}
      </View>
      {row.figure ? <Text className={cn('font-mono text-sm', row.tone && TONE[row.tone])}>{row.figure}</Text> : change}
      {row.id ? <Icon as={ChevronRight} size={16} className="text-muted-foreground" /> : null}
    </View>
  );
  const id = row.id;
  return id ? (
    <Pressable onPress={() => onOpen(id)} accessibilityRole="link" className="rounded-md border-t border-border active:bg-accent">
      {body}
    </Pressable>
  ) : (
    <View className="border-t border-border">{body}</View>
  );
}

function NextStep({ step, onFollow }: { step: NonNullable<Answer['doThis']>; onFollow: (link: AskLink) => void }) {
  return (
    <Pressable
      onPress={() => onFollow(step.link)}
      accessibilityRole="link"
      accessibilityLabel={`${step.text} ${step.label}`}
      className="flex-row items-center gap-2 rounded-md bg-brand-soft px-3 py-2.5 active:opacity-70"
    >
      <Text className="flex-1 text-sm">
        {step.text} <Text className="text-sm font-semibold text-brand">{step.label}</Text>
      </Text>
      <Icon as={ChevronRight} size={16} className="text-brand" />
    </Pressable>
  );
}

/**
 * One box to type or talk in, with at most one button beside it: the mic while
 * the box is empty, Send once there is text. Before the first question (`big`)
 * the mic is a large button above the box instead, for talking on the go.
 */
function Composer({
  placeholder,
  onSend,
  listenOnOpen,
  big,
}: {
  placeholder: string;
  onSend: (q: string, via: Turn['via']) => void;
  listenOnOpen: boolean;
  big: boolean;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Listening | null>(null);
  const voice = canListen();

  const start = useCallback(() => {
    stopSpeaking();
    setError(null);
    setText('');
    setListening(true);
    session.current = listen({
      onText: setText,
      onDone: (heard) => {
        setListening(false);
        setText('');
        onSend(heard, 'voice');
      },
      onError: (e) => {
        setListening(false);
        setError(VOICE_ERRORS[e] || null);
      },
    });
  }, [onSend]);
  const stop = () => session.current?.stop();

  // Once, when opened from the mic on a person's page.
  const opened = useRef(false);
  useEffect(() => {
    if (listenOnOpen && voice && !opened.current) {
      opened.current = true;
      start();
    }
  }, [listenOnOpen, voice, start]);
  useEffect(() => () => session.current?.cancel(), []);

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    setText('');
    onSend(q, 'typed');
  };
  const side = listening ? (big ? null : 'mic') : text.trim() ? 'send' : voice && !big ? 'mic' : null;

  return (
    // Room at the bottom for the Ask button, which rises out of the tab bar below.
    <View className="gap-2 border-t border-border bg-background px-4 pb-6 pt-2">
      {big && voice ? (
        <View className="items-center gap-2 py-3">
          <Pressable
            onPress={listening ? stop : start}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Ask by voice'}
            className={cn('h-20 w-20 items-center justify-center rounded-full active:opacity-80', listening ? 'bg-destructive' : 'bg-primary')}
          >
            <Icon as={listening ? Square : Mic} size={34} className="text-white" />
          </Pressable>
          <Text className={cn('text-base', listening ? 'text-brand' : 'text-muted-foreground')}>{listening ? 'Listening… tap to stop' : 'Tap and talk'}</Text>
        </View>
      ) : null}
      {error ? <Text className="text-sm text-muted-foreground">{error}</Text> : null}
      {listening && !big ? <Text className="text-sm text-brand">Listening… tap stop when you’re done</Text> : null}
      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1 rounded-full px-4"
          value={text}
          onChangeText={setText}
          placeholder={listening ? 'Listening…' : big && voice ? 'Or type a question' : placeholder}
          onSubmitEditing={submit}
          returnKeyType="send"
          editable={!listening}
          accessibilityLabel="Ask a question"
        />
        {side === 'mic' ? (
          <Button
            size="icon"
            variant={listening ? 'destructive' : 'outline'}
            className="rounded-full"
            onPress={listening ? stop : start}
            accessibilityLabel={listening ? 'Stop listening' : 'Ask by voice'}
          >
            <Icon as={listening ? Square : Mic} size={20} className={listening ? 'text-white' : undefined} />
          </Button>
        ) : side === 'send' ? (
          <Button size="icon" className="rounded-full" onPress={submit} accessibilityLabel="Send">
            <Icon as={ArrowUp} size={20} className="text-primary-foreground" />
          </Button>
        ) : null}
      </View>
    </View>
  );
}
