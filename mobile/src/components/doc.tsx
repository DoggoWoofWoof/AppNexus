// How visit prep and saved reports read on screen: titled sections of short
// lines, plus Listen and Share. Used by a person's page and the Saved screens.

import { Check, CircleAlert, Copy, Share2, Square, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Share, View } from 'react-native';

import { Delta } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { docSpeech, docText, type Doc, type DocLine } from '@/lib/saved';
import { cn } from '@/lib/utils';
import { canSpeak, speak, stopSpeaking } from '@/lib/voice';

/** The sections of a prep or report. Lines that name someone open them. */
export function DocSections({ doc, onOpen }: { doc: Doc; onOpen?: (id: string) => void }) {
  return (
    <View className="gap-5">
      {doc.sections.map((section) => (
        <View key={section.title} className="gap-2">
          <Text variant="kicker">{section.title}</Text>
          {section.lines.map((line, i) => (
            <Line key={`${line.text}-${i}`} line={line} onOpen={onOpen} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Line({ line, onOpen }: { line: DocLine; onOpen?: (id: string) => void }) {
  // A change on last year is the trend arrow, as in the answer: the figure when there's no other, else under the text.
  const change = line.change == null ? null : <Delta value={line.change} suffix={line.figure ? ' on last year' : ''} />;
  const body = (
    <View className="flex-row items-start gap-3">
      <View className="flex-1 gap-0.5">
        {line.label ? <Text className="text-sm text-muted-foreground">{line.label}</Text> : null}
        {line.text ? (
          <Text className={cn('text-base leading-6', line.id && onOpen && 'font-semibold')} selectable={!line.id}>
            {line.text}
          </Text>
        ) : null}
        {line.sub ? <Text className="text-sm text-muted-foreground">{line.sub}</Text> : null}
        {line.figure ? change : null}
      </View>
      {line.figure ? <Text className="font-mono text-sm">{line.figure}</Text> : change}
    </View>
  );
  const id = line.id;
  return id && onOpen ? (
    <Pressable onPress={() => onOpen(id)} accessibilityRole="link" className="rounded-md py-1 active:bg-accent">
      {body}
    </Pressable>
  ) : (
    <View className="py-1">{body}</View>
  );
}

/** Reads the prep or report aloud; tap again to stop. */
export function ListenButton({ doc, variant = 'outline', className }: { doc: Doc; variant?: 'default' | 'outline' | 'ghost'; className?: string }) {
  const [reading, setReading] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!canSpeak()) return null;
  const toggle = () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    speak(docSpeech(doc), { onEnd: () => setReading(false) });
  };
  return (
    <Button variant={variant} onPress={toggle} className={className} accessibilityLabel={reading ? 'Stop reading' : `Read ${doc.title} aloud`}>
      <Icon as={reading ? Square : Volume2} size={18} className={variant === 'default' ? 'text-primary-foreground' : undefined} />
      <Text>{reading ? 'Stop' : 'Listen'}</Text>
    </Button>
  );
}

/** Shares the text for an email or CRM note; the web build copies it instead. */
export function ShareButton({ doc, className }: { doc: Doc; className?: string }) {
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const web = Platform.OS === 'web';
  const share = async () => {
    const message = docText(doc);
    if (!web) {
      await Share.share({ message, title: doc.title }).catch(() => undefined);
      return;
    }
    // Browsers can refuse clipboard access, so say whether it worked.
    const result = await navigator.clipboard.writeText(message).then(
      () => 'copied' as const,
      () => 'failed' as const,
    );
    setCopied(result);
    AccessibilityInfo.announceForAccessibility(result === 'copied' ? 'Copied' : 'The browser didn’t allow copying');
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <Button variant="outline" onPress={share} className={className} accessibilityLabel={web ? `Copy ${doc.title}` : `Share ${doc.title}`}>
      <Icon as={copied === 'copied' ? Check : copied === 'failed' ? CircleAlert : web ? Copy : Share2} size={18} />
      <Text>{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Can’t copy' : web ? 'Copy' : 'Share'}</Text>
    </Button>
  );
}
