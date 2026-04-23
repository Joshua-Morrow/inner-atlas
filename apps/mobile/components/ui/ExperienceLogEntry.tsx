/**
 * ExperienceLogEntry — a single entry card in the experience log.
 * Used in Parts Mindfulness and Unblending technique steps.
 *
 * Tap  → expand to add "sit with" notes
 * Long → reveal delete button
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ExperienceEntry {
  id: string;
  category: string;
  description?: string;
  timestamp: string;
  unblended?: boolean;
  noticeText?: string;                    // text written in UnblendSupportCard note input
  additionalNotes?: string[];             // "sit with" notes added via card expansion
  linkedPartId?: string;                  // part linked in part-linking phase
  linkedPartName?: string;               // display name of linked part
  sitWithNotes?: Record<number, string>; // prompt responses from sit-with-part phase
  stayedBlended?: boolean;              // true if part wouldn't separate during unblend
}

interface ExperienceLogEntryProps {
  entry: ExperienceEntry;
  onDelete: () => void;
  onAddNote?: (note: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Thought':           '#3B5BA5',
  'Feeling':           '#7C3D9B',
  'Body sensation':    '#C2600A',
  'Impulse':           '#C2600A',
  'Memory':            '#7C3D9B',
  'Visual / image':    '#3B5BA5',
  'External stimulus': '#6B6860',
};

export function ExperienceLogEntry({ entry, onDelete, onAddNote }: ExperienceLogEntryProps) {
  const [expanded, setExpanded]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [noteInput, setNoteInput]  = useState('');

  const categoryColor = CATEGORY_COLORS[entry.category] ?? '#6B6860';

  function handleSaveNote() {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    onAddNote?.(trimmed);
    setNoteInput('');
  }

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => {
        setExpanded((v) => !v);
        setShowDelete(false);
      }}
      onLongPress={() => setShowDelete((v) => !v)}
      activeOpacity={0.85}
    >
      {/* Top row — badge + icons + timestamp */}
      <View style={s.row}>
        <View style={[s.badge, { backgroundColor: categoryColor }]}>
          <Text style={s.badgeText}>{entry.category}</Text>
        </View>
        {entry.unblended && !entry.stayedBlended && (
          <Ionicons name="shield-checkmark-outline" size={14} color="#B88A00" style={s.icon} />
        )}
        {entry.stayedBlended && (
          <View style={s.stayedPill}>
            <Text style={s.stayedPillText}>stayed with</Text>
          </View>
        )}
        {entry.linkedPartName ? (
          <Ionicons name="person-circle-outline" size={14} color="#3B5BA5" style={s.icon} />
        ) : null}
        <Text style={s.timestamp}>{entry.timestamp}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color="rgba(255,255,255,0.3)"
        />
      </View>

      {/* Description */}
      {entry.description ? (
        <Text style={s.description}>{entry.description}</Text>
      ) : null}

      {/* Notice text from UnblendSupportCard */}
      {entry.noticeText ? (
        <View style={s.noticeRow}>
          <Ionicons name="git-branch-outline" size={12} color="#B88A00" />
          <Text style={s.noticeText}>{entry.noticeText}</Text>
        </View>
      ) : null}

      {/* Linked part */}
      {entry.linkedPartName ? (
        <View style={s.linkedRow}>
          <Ionicons name="person-outline" size={12} color="#3B5BA5" />
          <Text style={s.linkedName}>{entry.linkedPartName}</Text>
        </View>
      ) : null}

      {/* Additional "sit with" notes */}
      {entry.additionalNotes?.map((note, i) => (
        <View key={i} style={s.additionalNoteRow}>
          <View style={s.additionalNoteDot} />
          <Text style={s.additionalNote}>{note}</Text>
        </View>
      ))}

      {/* Sit-with-part prompt answers (shown in expanded state) */}
      {expanded && entry.sitWithNotes && Object.keys(entry.sitWithNotes).length > 0 && (
        <View style={s.sitWithSection}>
          <Text style={s.sitWithSectionLabel}>What you noticed</Text>
          {([
            [0, 'Body'],
            [1, 'Visual'],
            [2, 'Emotion'],
            [3, 'Voice'],
            [4, 'Memory'],
          ] as [number, string][]).map(([idx, label]) => {
            const val = entry.sitWithNotes![idx];
            if (!val) return null;
            return (
              <View key={idx} style={s.sitWithRow}>
                <Text style={s.sitWithLabel}>{label}:</Text>
                <Text style={s.sitWithValue}>{val}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Expanded section — "sit with" input */}
      {expanded && (
        <View style={s.expandedSection}>
          <Text style={s.expandedLabel}>SIT WITH</Text>
          <View style={s.noteInputRow}>
            <TextInput
              style={s.noteInput}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="What do you notice as you stay with this?"
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.saveNoteBtn, !noteInput.trim() && s.saveNoteBtnDisabled]}
              onPress={handleSaveNote}
              disabled={!noteInput.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Delete — only when not expanded */}
      {showDelete && (
        <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
          <Text style={s.deleteBtnText}>Remove</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  icon: {
    marginLeft: 2,
  },
  stayedPill: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stayedPillText: {
    fontSize: 10,
    color: '#C2600A',
    fontWeight: '600',
  },
  timestamp: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#B88A00',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkedName: {
    fontSize: 13,
    color: '#6B8FD9',
    fontWeight: '500',
  },
  additionalNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 2,
  },
  additionalNoteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 7,
    flexShrink: 0,
  },
  additionalNote: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
  },
  sitWithSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
    marginTop: 4,
    gap: 4,
  },
  sitWithSectionLabel: {
    fontSize: 11,
    color: '#9B9A94',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  sitWithRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 2,
  },
  sitWithLabel: {
    fontSize: 13,
    color: '#9B9A94',
    fontWeight: '600',
    flexShrink: 0,
  },
  sitWithValue: {
    flex: 1,
    fontSize: 13,
    color: '#9B9A94',
    lineHeight: 19,
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    marginTop: 4,
    gap: 8,
  },
  expandedLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
  noteInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#2A2927',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 52,
    lineHeight: 20,
  },
  saveNoteBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3B5BA5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  saveNoteBtnDisabled: {
    opacity: 0.35,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#C2600A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
