// 챌린지(도전) 화면입니다. 라우팅은 부모가 하고, 이 화면은 onBack만 받습니다.
//
// 러닝봄에는 서버가 없어서 "몇 명이 참가 중"인지 알 수 없습니다. 그래서 참가자 수를 아예
// 보여 주지 않고, 이 기기에 쌓인 기록으로 계산할 수 있는 "나의 도전"만 다룹니다.
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  SectionHeader,
  SkeletonCard,
  screenStyles,
} from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import type { GoalRaceSeed } from '../../../domains/challenges/catalog';
import { useChallenges } from '../../../domains/challenges/useChallenges';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeForm } from './ChallengeForm';

export type ChallengesScreenProps = {
  /** 부모가 이전 화면으로 돌려보낼 때 씁니다. 없으면 돌아가기 버튼을 감춥니다. */
  onBack?: () => void;
};

const noParticipantCountNote =
  '러닝봄은 참가자 수를 보여 주지 않아요. 서버 없이 이 기기의 기록만으로 세기 때문이에요.';

export function ChallengesScreen({ onBack }: ChallengesScreenProps) {
  const { activities, ready: activitiesReady } = useAppState();
  const { goalRace } = useGoalRace();
  const [dismissedCelebration, setDismissedCelebration] = useState(false);

  const goalRaceSeed = useMemo<GoalRaceSeed | undefined>(
    () =>
      goalRace
        ? {
            raceId: goalRace.raceId,
            name: goalRace.name,
            raceDate: goalRace.raceDate,
            savedAt: goalRace.savedAt,
          }
        : undefined,
    [goalRace],
  );

  const challenges = useChallenges({
    activities,
    ...(goalRaceSeed ? { goalRace: goalRaceSeed } : {}),
  });
  const { mine, available, past, recommended, celebration, celebrate, join, leave, addCustom } =
    challenges;

  const loading = !activitiesReady || !challenges.ready;

  const onJoin = useCallback(
    (id: string) => {
      void join(id);
    },
    [join],
  );
  const onLeave = useCallback(
    (id: string) => {
      void leave(id);
    },
    [leave],
  );
  const closeCelebration = useCallback(() => {
    if (celebration) void celebrate(celebration.challenge.id);
    setDismissedCelebration(true);
  }, [celebrate, celebration]);

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        subtitle="기간을 정해 두고 목표를 채워 가요. 진행률은 내 기록으로 자동 계산돼요."
        title="챌린지"
        {...(onBack ? { action: <Button label="닫기" onPress={onBack} tone="quiet" /> } : {})}
      />

      {loading ? <SkeletonCard accessibilityLabel="도전을 불러오는 중이에요" lines={3} /> : null}

      {!loading && celebration && !dismissedCelebration ? (
        <Card accessibilityLabel="도전을 다 채웠어요" style={styles.celebration} tone="warm">
          <Text accessibilityRole="header" style={styles.celebrationTitle}>
            해냈어요!
          </Text>
          <Text style={styles.celebrationBody}>
            {`"${celebration.challenge.title}" 목표를 다 채웠어요. ${celebration.amountLabel}까지 왔어요.`}
          </Text>
          <Button label="고마워요" onPress={closeCelebration} />
        </Card>
      ) : null}

      {!loading ? (
        <>
          <SectionHeader
            compact
            subtitle={
              mine.length > 0
                ? '기간이 끝나기 전에 채우면 돼요.'
                : '아직 참가한 도전이 없어요.'
            }
            title="진행 중인 내 도전"
          />
          {mine.length > 0 ? (
            mine.map((progress, index) => (
              <ChallengeCard
                featured={index === 0}
                joined
                key={progress.challenge.id}
                onLeave={onLeave}
                progress={progress}
              />
            ))
          ) : recommended ? (
            <>
              <EmptyState
                body="하나만 골라서 시작해 보세요. 아래 도전이 지금 가장 가까워요."
                hint="언제든 그만둘 수 있어요. 기록은 그대로 남아요."
                title="아직 참가한 도전이 없어요"
              />
              <ChallengeCard featured joined={false} onJoin={onJoin} progress={recommended} />
            </>
          ) : (
            <EmptyState
              body="이번 기간에 열린 도전이 없어요. 아래에서 직접 만들 수 있어요."
              title="아직 참가한 도전이 없어요"
            />
          )}

          {available.length > 0 ? (
            <>
              <SectionHeader
                compact
                subtitle="마음에 드는 걸 골라 참가하세요."
                title="참가할 수 있는 도전"
              />
              {available
                .filter((progress) => progress.challenge.id !== recommended?.challenge.id)
                .map((progress) => (
                  <ChallengeCard
                    joined={false}
                    key={progress.challenge.id}
                    onJoin={onJoin}
                    progress={progress}
                  />
                ))}
            </>
          ) : null}

          <SectionHeader compact subtitle="기간과 목표를 직접 정해요." title="직접 만들기" />
          <ChallengeForm onCreate={addCustom} />

          {past.length > 0 ? (
            <>
              <SectionHeader compact subtitle="기간이 끝난 도전이에요." title="지난 도전" />
              {past.map((progress) => (
                <ChallengeCard joined key={progress.challenge.id} progress={progress} />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <View style={styles.footNote}>
        <Text style={styles.footNoteText}>{noParticipantCountNote}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  celebration: {
    gap: spacing.sm,
  },
  celebrationTitle: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  celebrationBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  footNote: {
    paddingTop: spacing.lg,
  },
  footNoteText: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
