// 대회 카드 위의 포스터 배너입니다.
//
// 주최 측 실제 포스터가 아닙니다. 대회 정보(거리·지역·날짜·계절)로 우리가 조판한 것입니다.
// 무엇을 그릴지는 `poster.ts`의 `racePosterSpec`이 정합니다(순수 함수, 테스트가 봅니다).
import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { fontWeight, radius, spacing, typeScale } from '../../app/design-system/theme';
import { officialImage } from '../media/officialImages';
import { posterAccessibilityLabel, type RacePosterSpec } from './poster';

export type RacePosterProps = {
  spec: RacePosterSpec;
  raceName: string;
  /** 리스트에서는 96, 상세에서는 180을 씁니다. */
  height?: number;
  /**
   * 대회 id입니다. 주최 측 공식 페이지가 공개한 포스터가 있으면 그걸 씁니다.
   * 없으면(대부분) 우리가 조판한 포스터가 그대로 나갑니다.
   */
  raceId?: string;
};

export const RacePoster = memo(function RacePoster({
  height = 96,
  raceId,
  raceName,
  spec,
}: RacePosterProps) {
  const gradientId = `poster-${spec.season}`;
  const photo = raceId ? officialImage(raceId) : undefined;
  // 주최 측 포스터를 못 받아 오면(만료·차단) 조용히 우리 포스터로 되돌아갑니다.
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photo) && !failed;

  return (
    <View
      accessibilityLabel={posterAccessibilityLabel(spec, raceName)}
      accessibilityRole="image"
      style={[styles.root, { height }]}
    >
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" x2="0.4" y1="0" y2="1">
            <Stop offset="0" stopColor={spec.topColor} />
            <Stop offset="1" stopColor={spec.bottomColor} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${gradientId})`} height="100%" width="100%" />
        {/* 오른쪽 아래 사선 한 줄 — 밋밋한 사각형이 되지 않게 하는 최소한의 장치입니다. */}
        <Rect
          fill={spec.inkColor}
          height={height * 2}
          opacity={0.06}
          transform={`rotate(-28 0 0)`}
          width={height * 0.55}
          x={height * 2.4}
          y={-height}
        />
      </Svg>

      {/* 주최 측 공식 포스터가 있으면 우리 조판 위에 덮습니다. 실패하면 아래가 그대로 보입니다. */}
      {showPhoto && photo ? (
        <Image
          onError={() => setFailed(true)}
          resizeMode="cover"
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {showPhoto ? null : (
      <View style={styles.copy}>
        <Text
          style={[
            styles.headline,
            { color: spec.inkColor, fontSize: Math.round(height * 0.34 * spec.headlineScale) },
          ]}
        >
          {spec.headline}
        </Text>
        <Text numberOfLines={1} style={[styles.subline, { color: spec.inkColor }]}>
          {spec.subline}
        </Text>
      </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  copy: { paddingHorizontal: spacing.md, gap: 2 },
  headline: { fontWeight: fontWeight.heavy, letterSpacing: 1 },
  subline: { fontSize: typeScale.caption, fontWeight: fontWeight.medium, opacity: 0.9 },
});
