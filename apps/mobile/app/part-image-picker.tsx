/**
 * Part Image Picker — native crop flow
 * Route: /part-image-picker?partId=<uuid>
 *
 * Step 1 — source-select: library or camera → native 3:4 crop
 * Step 2 — review: card + circle previews, retake circle option
 * Step 3 — saving: write files + DB, navigate back
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PickerStep = 'source-select' | 'review' | 'saving';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_DIR = FileSystem.documentDirectory + 'part-images/';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeDefaultCircle(sourceUri: string): Promise<string> {
  const info = await ImageManipulator.manipulate(sourceUri).renderAsync();
  const size = Math.min(info.width, info.height);
  const originX = Math.floor((info.width - size) / 2);
  const originY = Math.floor((info.height - size) / 2);
  const result = await ImageManipulator.manipulate(sourceUri)
    .crop({ originX, originY, width: size, height: size })
    .renderAsync();
  const saved = await result.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return saved.uri;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PartImagePickerScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();

  const [step, setStep]               = useState<PickerStep>('source-select');
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [rectUri, setRectUri]         = useState<string | null>(null);
  const [circleUri, setCircleUri]     = useState<string | null>(null);

  // ── Rect crop ──────────────────────────────────────────────────────────────

  async function launchRectCrop(source: 'library' | 'camera') {
    const { status } = source === 'library'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        `Please allow ${source === 'library' ? 'photo library' : 'camera'} access in Settings.`,
      );
      return;
    }

    const result = source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.9,
        })
      : await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.9,
        });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setRectUri(asset.uri);
    setOriginalUri(asset.uri);

    try {
      const defaultCircle = await computeDefaultCircle(asset.uri);
      setCircleUri(defaultCircle);
    } catch {
      setCircleUri(asset.uri);
    }

    setStep('review');
  }

  // ── Retake circle ──────────────────────────────────────────────────────────

  async function retakeCircle() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setCircleUri(result.assets[0].uri);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!rectUri || !circleUri || !partId) return;
    setStep('saving');

    const ts    = Date.now();
    const newId = `img_${ts}_${Math.random().toString(36).slice(2, 7)}`;

    const rectPath     = `${BASE_DIR}${partId}_${ts}_rect.jpg`;
    const circlePath   = `${BASE_DIR}${partId}_${ts}_circle.jpg`;
    const originalPath = `${BASE_DIR}${partId}_${ts}_original.jpg`;

    try {
      await FileSystem.makeDirectoryAsync(BASE_DIR, { intermediates: true });

      await FileSystem.copyAsync({ from: rectUri,               to: rectPath });
      await FileSystem.copyAsync({ from: circleUri,             to: circlePath });
      await FileSystem.copyAsync({ from: originalUri ?? rectUri, to: originalPath });

      const db  = getDatabase();
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO part_images (id, part_id, rect_uri, circle_uri, original_uri, is_current, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [newId, partId, rectPath, circlePath, originalPath, now],
      );

      await db.runAsync(
        `UPDATE part_images SET is_current = 0 WHERE part_id = ? AND id != ?`,
        [partId, newId],
      );

      await db.runAsync(
        `UPDATE parts SET current_image_id = ? WHERE id = ?`,
        [newId, partId],
      );

      router.back();
    } catch (e) {
      console.error('[PartImagePicker] save error:', e);
      for (const p of [rectPath, circlePath, originalPath]) {
        try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch { /* noop */ }
      }
      setStep('review');
      Alert.alert("Couldn't save image", 'Please try again.');
    }
  }

  // ── Render: saving ─────────────────────────────────────────────────────────

  if (step === 'saving') {
    return (
      <View style={styles.savingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.savingText}>Saving…</Text>
      </View>
    );
  }

  // ── Render: main ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 'review' ? setStep('source-select') : router.back())}
          activeOpacity={0.7}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'review' ? 'Review' : 'Add Image'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.headerCancelBtn}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Source select */}
      {step === 'source-select' && (
        <View style={styles.sourceContent}>
          <Text style={styles.sourceTitle}>Choose a photo</Text>
          <Text style={styles.sourceSub}>to represent this part</Text>
          <View style={styles.sourceButtons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => launchRectCrop('library')}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => launchRectCrop('camera')}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.outlineBtnText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Review */}
      {step === 'review' && rectUri && circleUri && (
        <View style={styles.reviewContent}>
          <Text style={styles.reviewSub}>How your part will appear</Text>

          <View style={styles.previewRow}>
            {/* Card preview */}
            <View style={styles.previewItem}>
              <Image
                source={{ uri: rectUri }}
                style={styles.cardPreview}
                resizeMode="cover"
              />
              <Text style={styles.previewLabel}>Card</Text>
            </View>

            {/* Profile preview */}
            <View style={styles.previewItem}>
              <Image
                source={{ uri: circleUri }}
                style={styles.circlePreview}
                resizeMode="cover"
              />
              <Text style={styles.previewLabel}>Profile</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={retakeCircle}
            activeOpacity={0.7}
            style={styles.retakeBtn}
          >
            <Text style={styles.retakeText}>Retake Circle Crop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Save button — position absolute, outside scroll context */}
      {step === 'review' && rectUri && circleUri && (
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Save Image</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1917',
  },

  savingContainer: {
    flex: 1,
    backgroundColor: '#1A1917',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  savingText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  headerCancelBtn: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
  },

  // Source select
  sourceContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  sourceTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  sourceSub: {
    color: '#9B9A94',
    fontSize: 14,
    marginBottom: 24,
  },
  sourceButtons: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  outlineBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  // Review
  reviewContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  reviewSub: {
    color: '#9B9A94',
    fontSize: 14,
    marginBottom: 36,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
  },
  previewItem: {
    alignItems: 'center',
    gap: 8,
  },
  cardPreview: {
    width: 90,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#252422',
  },
  circlePreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#252422',
  },
  previewLabel: {
    color: '#9B9A94',
    fontSize: 11,
  },
  retakeBtn: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retakeText: {
    color: '#9B9A94',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // Save button
  saveBtn: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    height: 52,
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 999,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
