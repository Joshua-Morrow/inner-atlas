/**
 * UnblendSupportCard — shown whenever a reactive part is detected.
 * Used in Unblending, Feel Towards, Inquiry, and Meeting Space.
 */

import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface UnblendSupportCardProps {
  partName?: string;
  /** Called when user has gained some space. In unblending mode, passes the optional note text. */
  onHaveSpace: (noticeText?: string) => void;
  /** Called when user chose to continue despite part not separating.
   *  Passes any non-empty prompt notes combined into a single string. */
  onStayedBlended?: (notes?: string) => void;
  /** 'mindfulness' renders softer copy for Parts Mindfulness step. Default: 'unblending' */
  mode?: 'unblending' | 'mindfulness';
  /** Reactive feelings selected in the feel-towards step — shown as pills near the top */
  selectedFeelings?: string[];
}

export function UnblendSupportCard({ partName, onHaveSpace, onStayedBlended, mode = 'unblending', selectedFeelings }: UnblendSupportCardProps) {
  const [note, setNote] = useState('');
  const [showWontSeparate, setShowWontSeparate] = useState(false);

  // Option B expandable card state
  const [expanded1, setExpanded1] = useState(false);
  const [expanded2, setExpanded2] = useState(false);
  const [expanded3, setExpanded3] = useState(false);
  const [prompt1Text, setPrompt1Text] = useState('');
  const [prompt2Text, setPrompt2Text] = useState('');
  const [prompt3Text, setPrompt3Text] = useState('');

  function handleContinuePractice() {
    const parts: string[] = [];
    if (prompt1Text.trim()) parts.push(prompt1Text.trim());
    if (prompt2Text.trim()) parts.push(prompt2Text.trim());
    if (prompt3Text.trim()) parts.push(prompt3Text.trim());
    onStayedBlended?.(parts.length > 0 ? parts.join('\n') : undefined);
  }

  if (mode === 'mindfulness') {
    return (
      <View style={s.root}>
        <View style={s.content}>
          <Text style={s.heading}>Something arose.</Text>

          {partName ? (
            <Text style={s.body}>
              <Text style={s.partNameInline}>{partName}</Text>
              {'\n\n'}Notice it as a part — something in you, not all of you.{'\n'}
              You don't need to do anything with it.{'\n'}
              Just acknowledge it: "I see you."
            </Text>
          ) : (
            <Text style={s.body}>
              Notice it as a part — something in you, not all of you.{'\n'}
              You don't need to do anything with it.{'\n'}
              Just acknowledge it: "I see you."
            </Text>
          )}

          <View style={{ height: 80 }} />
        </View>

        <View style={s.footer}>
          <TouchableOpacity style={s.actionBtn} onPress={() => onHaveSpace()} activeOpacity={0.85}>
            <Text style={s.actionBtnText}>Noted — back to breathing</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Won't separate support screen ─────────────────────────────────────────

  if (showWontSeparate) {
    return (
      <View style={s.root}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={ws.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: wont-separate option-a heading */}
          <Text style={ws.heading}>This part has good reasons.</Text>

          {/* TEXT: wont-separate option-a body */}
          <Text style={ws.body}>
            If this part is holding on, it's because it has learned that holding on is necessary.
            Parts don't resist without reason — this one has been protecting something important.
          </Text>
          <Text style={ws.body}>
            You don't need to push it away. Instead, try turning toward it with genuine interest:
            "I see you're here. I'm not trying to get rid of you. I'm curious about what you're carrying."
          </Text>
          <Text style={ws.body}>
            When a part feels seen rather than opposed, space sometimes opens on its own.
          </Text>

          <View style={ws.divider} />

          {/* TEXT: wont-separate option-b label */}
          <Text style={ws.optionBLabel}>If you'd like more support:</Text>

          {/* TEXT: wont-separate prompt-1 */}
          <TouchableOpacity
            style={ws.cardHeader}
            onPress={() => setExpanded1((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={ws.cardHeaderText}>Acknowledge it directly</Text>
            <Text style={ws.cardChevron}>{expanded1 ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {expanded1 && (
            <View style={ws.cardBody}>
              <Text style={ws.cardBodyText}>
                Try saying inwardly to this part:{'\n'}
                "I notice you're here. I'm not asking you to leave — I just want to understand you better.
                Is there something you need me to know?"
              </Text>
              <TextInput
                style={ws.promptInput}
                value={prompt1Text}
                onChangeText={setPrompt1Text}
                placeholder="Anything this part seems to want you to know..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* TEXT: wont-separate prompt-2 */}
          <TouchableOpacity
            style={ws.cardHeader}
            onPress={() => setExpanded2((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={ws.cardHeaderText}>Notice without fighting</Text>
            <Text style={ws.cardChevron}>{expanded2 ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {expanded2 && (
            <View style={ws.cardBody}>
              <Text style={ws.cardBodyText}>
                Rather than trying to separate, just observe: Where is this part in your body right now?
                What quality does it have — heavy, tight, loud, urgent? You don't have to change anything.
                Just notice.
              </Text>
              <TextInput
                style={ws.promptInput}
                value={prompt2Text}
                onChangeText={setPrompt2Text}
                placeholder="What you're noticing about it right now..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* TEXT: wont-separate prompt-3 */}
          <TouchableOpacity
            style={ws.cardHeader}
            onPress={() => setExpanded3((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={ws.cardHeaderText}>Check for Self energy</Text>
            <Text style={ws.cardChevron}>{expanded3 ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {expanded3 && (
            <View style={ws.cardBody}>
              <Text style={ws.cardBodyText}>
                Even with this part present, is there any part of you that can observe it with some distance?
                A small sense of "I notice this" rather than "I am this"? Even a flicker of curiosity or
                compassion toward it counts.
              </Text>
              <TextInput
                style={ws.promptInput}
                value={prompt3Text}
                onChangeText={setPrompt3Text}
                placeholder="Any sense of space, even very slight..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* TEXT: wont-separate continue button */}
        <View style={s.footer}>
          <TouchableOpacity style={s.actionBtn} onPress={handleContinuePractice} activeOpacity={0.85}>
            <Text style={s.actionBtnText}>Continue the practice →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main unblending card ───────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <View style={s.content}>
        <Text style={s.heading}>A part is present.</Text>

        {selectedFeelings && selectedFeelings.length > 0 && (
          <View style={s.feelingsRow}>
            {selectedFeelings.map((feeling) => (
              <View key={feeling} style={s.feelingPill}>
                <Text style={s.feelingPillText}>{feeling}</Text>
              </View>
            ))}
          </View>
        )}

        {partName ? (
          <Text style={s.body}>
            <Text style={s.partNameInline}>{partName}</Text>
            {' '}has some feelings here. That makes sense — it's been doing this job for a long time.
          </Text>
        ) : (
          <Text style={s.body}>
            Something is here with feelings about this. That makes sense.
          </Text>
        )}

        <Text style={s.guidance}>
          See if you can turn toward it with a little curiosity.{'\n\n'}
          You don't need it to go away — just enough room to be with it without becoming it.{'\n\n'}
          Try saying inwardly: "I see you. I know you're here. You don't have to step back completely — just give me a little space."
        </Text>

        <TextInput
          style={s.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="What do you notice? (optional)"
          placeholderTextColor="rgba(255,255,255,0.25)"
          multiline
          textAlignVertical="top"
        />

        <View style={{ height: 80 }} />
      </View>

      <View style={s.footer}>
        {/* TEXT: wont-separate button label */}
        <TouchableOpacity
          style={s.wontSeparateBtn}
          onPress={() => setShowWontSeparate(true)}
          activeOpacity={0.8}
        >
          <Text style={s.wontSeparateBtnText}>The part won't separate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onHaveSpace(note.trim() || undefined)} activeOpacity={0.85}>
          <Text style={s.actionBtnText}>I have a little more space now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  partNameInline: {
    color: '#B88A00',
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    marginBottom: 20,
  },
  guidance: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 26,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  feelingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  feelingPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(194,96,10,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(194,96,10,0.4)',
  },
  feelingPillText: {
    fontSize: 12,
    color: '#E8A87C',
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: '#2A2927',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 80,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
    gap: 0,
  },
  wontSeparateBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  wontSeparateBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const ws = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 26,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  optionBLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  cardHeaderText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    flex: 1,
  },
  cardChevron: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 8,
  },
  cardBody: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardBodyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  promptInput: {
    backgroundColor: '#2A2927',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 60,
    lineHeight: 20,
  },
});
