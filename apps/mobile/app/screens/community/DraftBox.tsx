// 커뮤니티에 글쓰기가 열리기 전까지, 쓰고 싶은 글을 이 기기에만 보관해 두는 곳입니다.
// 서버로 보내지 않고, 저절로 올라가지도 않습니다. 나중에 커뮤니티가 열리면 그대로 올릴 수 있습니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, SectionHeader } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { KnowledgeTopic } from '../guide/knowledge';
import {
  COMMUNITY_DRAFT_KEY,
  DRAFT_BODY_MAX,
  draftTopics,
  parseDraft,
  parseDraftList,
  withDraft,
  withoutDraft,
  type CommunityDraft,
} from './drafts';

export function DraftBox() {
  const [drafts, setDrafts] = useState<CommunityDraft[]>([]);
  const [topic, setTopic] = useState<KnowledgeTopic>('초보질문');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('아직 보관한 글이 없어요.');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(COMMUNITY_DRAFT_KEY)
      .then((raw) => {
        if (!active) return;
        const loaded = parseDraftList(raw);
        setDrafts(loaded);
        if (loaded.length > 0) setStatus(`보관 중인 글 ${loaded.length}개예요.`);
      })
      .catch(() => {
        if (active) setStatus('보관함을 불러오지 못했어요. 이번 실행 중에만 유지됩니다.');
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: CommunityDraft[]) => {
    setDrafts(next);
    try {
      await AsyncStorage.setItem(COMMUNITY_DRAFT_KEY, JSON.stringify(next));
    } catch {
      setStatus('기기에 저장하지 못했어요. 이번 실행 중에만 유지됩니다.');
    }
  }, []);

  function save() {
    const result = parseDraft(topic, body);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    const next = withDraft(drafts, {
      ...result.value,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    setBody('');
    setStatus(`보관했어요. 보관 중인 글 ${next.length}개예요.`);
    void persist(next);
  }

  function remove(draftId: string) {
    const next = withoutDraft(drafts, draftId);
    setStatus(next.length > 0 ? `보관 중인 글 ${next.length}개예요.` : '보관함을 비웠어요.');
    void persist(next);
  }

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="내 글 보관함"
        subtitle="나중에 커뮤니티가 열리면 그대로 올릴 수 있게 이 기기에만 저장해 둬요."
        compact
      />
      <Card style={styles.card} tone="muted">
        <Text style={styles.note}>
          지금은 다른 사람에게 보이지 않아요. 여기에 적어 둔 글은 내 폰 안에만 있고, 커뮤니티에
          글쓰기가 열리면 그때 하나씩 골라 올릴 수 있어요.
        </Text>
      </Card>
      <Card style={styles.card}>
        <View accessibilityLabel="글 주제 고르기" style={styles.chipRow}>
          {draftTopics.map((value) => (
            <Chip
              accessibilityLabel={`${value} 주제로 적기`}
              accessibilityRole="tab"
              key={value}
              label={value}
              onPress={() => setTopic(value)}
              selected={topic === value}
              tone="accent"
            />
          ))}
        </View>
        <TextInput
          accessibilityHint={`${topic} 주제로 이 기기에만 저장돼요. 최대 ${DRAFT_BODY_MAX}자까지 적을 수 있어요.`}
          accessibilityLabel="올리고 싶은 글 적기"
          multiline
          onChangeText={setBody}
          placeholder="예: 10K 대회를 처음 나가는데 페이스를 어떻게 잡을까요?"
          placeholderTextColor={palette.muted}
          style={styles.input}
          value={body}
        />
        <View style={styles.actionRow}>
          <Text
            accessibilityLabel={`${body.trim().length}자 입력함, 최대 ${DRAFT_BODY_MAX}자`}
            accessibilityLiveRegion="polite"
            style={styles.counter}
          >
            {body.trim().length}/{DRAFT_BODY_MAX}자
          </Text>
          <Button
            accessibilityHint="적은 내용을 이 기기 보관함에 저장해요. 서버로 보내거나 게시하지 않아요."
            accessibilityLabel={`${topic} 질문 보관하기`}
            label="보관하기"
            onPress={save}
            style={styles.saveButton}
          />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
        <Text style={styles.note}>
          보관한 글은 밖으로 보내지 않고 저절로 올라가지도 않아요. 앱을 지우면 함께 사라져요.
        </Text>
      </Card>

      {drafts.length > 0 ? (
        <View style={styles.list}>
          {drafts.map((draft) => (
            <Card
              accessibilityLabel={`${draft.topic} 주제, ${draft.createdAt.slice(0, 10)} 보관한 글`}
              key={draft.id}
              style={styles.draftCard}
            >
              <View style={styles.draftHeader}>
                <Chip accessibilityLabel={`${draft.topic} 주제`} label={draft.topic} />
                <Text
                  accessibilityLabel={`${draft.createdAt.slice(0, 10)}에 보관함`}
                  style={styles.draftDate}
                >
                  {draft.createdAt.slice(0, 10)}
                </Text>
              </View>
              <Text style={styles.draftBody}>{draft.body}</Text>
              <Button
                accessibilityHint="이 기기에서 바로 지워지고 되돌릴 수 없어요."
                accessibilityLabel={`${draft.topic} 보관 글 삭제`}
                label="삭제"
                onPress={() => remove(draft.id)}
                style={styles.deleteButton}
                tone="quiet"
              />
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: {
    minHeight: 96,
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    padding: spacing.sm,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counter: {
    flex: 1,
    minWidth: 0,
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  // 터치 대상은 48px 하한(layout.touchTarget)을 지킵니다.
  saveButton: { minWidth: 120, minHeight: layout.touchTarget },
  deleteButton: { minHeight: layout.touchTarget },
  status: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  list: { gap: spacing.xs },
  draftCard: { gap: spacing.xs },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  draftDate: {
    flex: 1,
    minWidth: 0,
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    textAlign: 'right',
  },
  draftBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
});
