// Pieces shared by the HCP and HCO profile screens, after the prototype's
// demo/js/screens/profile-parts.js.

import { Link, Stack } from 'expo-router';
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock,
  Copy,
  GitBranch,
  Info,
  Lightbulb,
  Lock,
  LogOut,
  MessageSquare,
  NotebookPen,
  Share2,
  SquareCheckBig,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, Share, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { Delta } from '@/components/charts';
import { Avatar, Tag, useProfileHref } from '@/components/entity';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { briefText, visitWhen, type Brief, type Figure, type PointKind } from '@/lib/brief';
import { formatPct, plural, relativeDayLower } from '@/lib/format';
import { isOnSite } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';
import { cn } from '@/lib/utils';

/** A label over its value, for details that may run to several lines. */
export function Detail({ label, value, children }: { label: string; value?: string | null; children?: ReactNode }) {
  return (
    <View className="gap-0.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {value !== undefined ? (
        value ? <Text selectable>{value}</Text> : <Text className="text-muted-foreground">Not recorded yet</Text>
      ) : null}
      {children}
    </View>
  );
}

/** A link to another profile, as a full-width row with a 44pt touch area. */
export function ProfileLink({ entity, children }: { entity: Pick<Entity, 'id' | 'kind'>; children: ReactNode }) {
  const profileHref = useProfileHref();
  return (
    <Link href={profileHref(entity)} asChild>
      <Pressable className="min-h-11 justify-center rounded-md active:bg-accent" accessibilityRole="link">
        {children}
      </Pressable>
    </Link>
  );
}

export function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text variant="h3">This profile isn’t in your book</Text>
      <Text className="text-muted-foreground">It may have been reassigned. Go back and pick another target.</Text>
    </Screen>
  );
}

/**
 * Avatar, kind and specialty, name, where they are, tags and when you last
 * spoke. The next visit is in the brief below, so it isn't repeated here.
 */
export function ProfileHeader({ entity, kicker, title, sub, tags }: { entity: Entity; kicker: string; title: string; sub: string; tags: ReactNode }) {
  const ctx = useWorkspace();
  const last = ctx.lastInteraction(entity.id);
  const status = last ? `Last contact ${relativeDayLower(last.date, ctx.today)} · ${last.type.toLowerCase()}` : 'No contact logged yet';

  return (
    <View className="gap-3">
      <View className="flex-row items-start gap-3">
        <Avatar entity={entity} size="lg" />
        <View className="flex-1 gap-1">
          <Text variant="kicker">{kicker}</Text>
          <Text variant="h2">{title}</Text>
          <Text className="text-muted-foreground">{sub}</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-1">{tags}</View>
      <View className="flex-row items-start gap-2">
        <Icon as={Clock} size={16} className="mt-0.5 text-muted-foreground" />
        <Text className="flex-1 text-sm text-muted-foreground">{status}</Text>
      </View>
    </View>
  );
}

export function ProfileActions({ onAddNote, onNewFollowUp, onBook }: { onAddNote: () => void; onNewFollowUp: () => void; onBook: () => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Button className="grow" onPress={onBook}>
        <Icon as={CalendarClock} size={16} />
        <Text>Book a time</Text>
      </Button>
      <Button className="grow" variant="outline" onPress={onAddNote}>
        <Icon as={NotebookPen} size={16} />
        <Text>Add note</Text>
      </Button>
      <Button className="grow" variant="outline" onPress={onNewFollowUp}>
        <Icon as={CalendarPlus} size={16} />
        <Text>New follow-up</Text>
      </Button>
    </View>
  );
}

/**
 * The open profile tab. `showTab` is for buttons inside the page (all practice
 * locations, saving a note): it switches tab and scrolls back to the tab bar, so
 * the new panel starts in view rather than wherever the old one was scrolled to.
 * Pass `scrollRef` to the Screen and `onTabsLayout` to the ProfileTabs.
 */
export function useProfileTab<T extends string>(initial: T) {
  const [tab, setTab] = useState(initial);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const tabsY = useRef(0);
  const onTabsLayout = useCallback((e: LayoutChangeEvent) => {
    tabsY.current = e.nativeEvent.layout.y;
  }, []);
  const showTab = useCallback((next: T) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: Math.max(0, tabsY.current - 8), animated: true });
  }, []);
  return { tab, setTab, showTab, scrollRef, onTabsLayout };
}

/** The profile's sections as a segmented control; the panels go in `children` as TabsContent. */
export function ProfileTabs<T extends string>({
  tabs,
  value,
  onChange,
  onLayout,
  label,
  children,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} onLayout={onLayout} className="gap-5">
      <TabsList accessibilityLabel={label}>
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}>
            <Text>{t.label}</Text>
            {t.count ? (
              <View className="min-w-5 items-center rounded-full bg-brand-soft px-1.5" aria-hidden>
                <Text className="font-mono text-2xs text-brand">{t.count}</Text>
              </View>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

/** A headline figure; with `onPress` the tile opens the detail behind it, which `hint` names. */
export interface Kpi extends Figure {
  onPress?: () => void;
  hint?: string;
}

/** Headline figures as tiles, two to a row. */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((k) => {
        const body = (
          <>
            <View className="flex-row items-start gap-1">
              <Text className="flex-1 text-xs text-muted-foreground">{k.label}</Text>
              {k.onPress ? <Icon as={ChevronRight} size={16} className="text-muted-foreground" /> : null}
            </View>
            <Text className={cn('font-serif text-2xl', k.tone === 'orange' && 'text-signal-text')}>{k.value}</Text>
            {k.delta != null ? <Delta value={k.delta} /> : null}
            {k.sub ? <Text className="text-xs text-muted-foreground">{k.sub}</Text> : null}
          </>
        );
        const tile = 'min-w-[140px] flex-1 basis-[40%] gap-1 rounded-lg border border-border bg-card p-3';
        const label = [k.label, k.value, k.delta != null ? `${formatPct(k.delta)} on last year` : '', k.sub].filter(Boolean).join(', ');
        return k.onPress ? (
          <Pressable
            key={k.label}
            onPress={k.onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={k.hint}
            className={cn(tile, 'active:bg-accent')}
          >
            {body}
          </Pressable>
        ) : (
          <View key={k.label} className={tile}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** A card that starts closed, for details that are rarely needed before a visit. */
export function Disclosure({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-lg border border-border bg-card">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-11 flex-row items-center gap-3 rounded-lg p-4 active:bg-accent"
      >
        <View className="flex-1 gap-0.5">
          <Text variant="h4">{title}</Text>
          {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
        </View>
        <Icon as={open ? ChevronUp : ChevronDown} size={18} className="text-muted-foreground" />
      </Pressable>
      {open ? <View className="gap-3 px-4 pb-4">{children}</View> : null}
    </View>
  );
}

export function Insight({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-2 rounded-md bg-brand-soft p-3">
      <Icon as={Lightbulb} size={16} className="mt-0.5 text-brand" />
      <Text className="flex-1">{children}</Text>
    </View>
  );
}

const POINT_ICONS: Record<PointKind, LucideIcon> = {
  promise: SquareCheckBig,
  lastNote: MessageSquare,
  leak: LogOut,
  up: TrendingUp,
  down: TrendingDown,
  referrer: GitBranch,
  contact: User,
};

/** A line with a small icon, as in the brief. */
function IconLine({ icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={icon} size={16} className={cn('mt-0.5 text-muted-foreground', className)} />
      <Text className="flex-1">{children}</Text>
    </View>
  );
}

/**
 * The first card on a profile: why see them now, the goal and up to three
 * talking points, and when the next visit is. Share sends the same brief as
 * text for an email or CRM note; the web build copies it instead.
 */
export function BriefCard({ entity, brief, onShowFollowUps }: { entity: Entity; brief: Brief; onShowFollowUps: () => void }) {
  const ctx = useWorkspace();
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const web = Platform.OS === 'web';
  const reach =
    entity.kind === 'hcp'
      ? [entity.contact.preferred && `Best time: ${entity.contact.preferred}`, entity.contact.assistant && `Book through ${entity.contact.assistant}`].filter(Boolean).join(' · ')
      : '';

  const share = async () => {
    const message = briefText(entity, brief, ctx.today);
    if (!web) {
      await Share.share({ message, title: `Visit brief: ${entity.name}` }).catch(() => undefined);
      return;
    }
    // Browsers can refuse clipboard access, so say whether it worked.
    const result = await navigator.clipboard.writeText(message).then(
      () => 'copied' as const,
      () => 'failed' as const,
    );
    setCopied(result);
    AccessibilityInfo.announceForAccessibility(result === 'copied' ? 'Brief copied' : 'The browser didn’t allow copying');
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <Section
      title={brief.visit ? `Before your ${isOnSite(brief.visit.item) ? 'visit' : brief.visit.item.type.toLowerCase()}` : 'Why reach out'}
      sub={brief.visit ? visitWhen(brief.visit, entity, ctx.today) : 'Sample signals from claims and your activity'}
      action={
        <Button size="sm" variant="outline" onPress={share} accessibilityLabel={web ? 'Copy brief' : 'Share brief'}>
          <Icon as={copied === 'copied' ? Check : copied === 'failed' ? CircleAlert : web ? Copy : Share2} size={16} />
          <Text>{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Can’t copy' : web ? 'Copy' : 'Share'}</Text>
        </Button>
      }
    >
      <Insight>{brief.insight}</Insight>
      {reach ? (
        <IconLine icon={Clock}>
          <Text className="text-sm text-muted-foreground">{reach}</Text>
        </IconLine>
      ) : null}
      <View className="gap-1">
        <Text variant="kicker">{brief.goalSuggested ? 'Suggested goal' : 'Goal'}</Text>
        <IconLine icon={Target} className="text-brand">
          <Text className="font-semibold">{brief.goal}</Text>
        </IconLine>
        {brief.goalDue ? <Text className="pl-6 text-sm text-muted-foreground">{`Follow-up ${brief.goalDue}`}</Text> : null}
      </View>
      {brief.points.length ? (
        <View className="gap-2">
          <Text variant="kicker">Talking points</Text>
          {brief.points.map((p) => (
            <IconLine key={p.text} icon={POINT_ICONS[p.kind]}>
              {p.text}
            </IconLine>
          ))}
        </View>
      ) : null}
      {/* The soonest follow-up is the first talking point; the rest are on the Activity tab. */}
      {brief.followUps.length > 1 ? (
        <Button size="sm" variant="ghost" className="self-start" onPress={onShowFollowUps}>
          <Icon as={SquareCheckBig} size={16} />
          <Text>{`All ${plural(brief.followUps.length, 'open follow-up')}`}</Text>
        </Button>
      ) : null}
    </Section>
  );
}

/** Sections that are on the DocNexus web platform but not in the app yet, closed until asked for. */
export function ComingLater({ title, items }: { title: string; items: string[] }) {
  return (
    <Disclosure title={title} sub={`${plural(items.length, 'section')} on the DocNexus platform, coming to the app later`}>
      {items.map((item) => (
        <View key={item} className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
          <Text>{item}</Text>
          <Tag label="Coming later" />
        </View>
      ))}
    </Disclosure>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <View className="items-center gap-2 rounded-md border border-dashed border-border px-4 py-5">
      <Icon as={icon} size={22} className="text-muted-foreground" />
      <Text className="text-center font-semibold">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted-foreground">{body}</Text> : null}
      {action}
    </View>
  );
}

/** For data this territory or code group doesn't have, rather than data that is simply empty. */
export function Unavailable({ title, body }: { title: string; body?: string }) {
  return <EmptyState icon={Lock} title={title} body={body} />;
}

export function FinePrint({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={Info} size={14} className="mt-0.5 text-muted-foreground" />
      <Text className="flex-1 text-xs text-muted-foreground">{children}</Text>
    </View>
  );
}

export const SampleNote = () => <FinePrint>Sample profile. People are fictional; facility names and locations are public records.</FinePrint>;
