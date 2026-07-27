// 공식 이미지가 있으면 그것을, 없으면 우리가 그린 그림을 보여 주는 자리입니다.
//
// 핵심 규칙 하나: **빈 상자가 절대 보이지 않습니다.**
//   벡터 그림이 항상 먼저 깔려 있고, 사진은 그 위에 얹힙니다.
//   그래서 이미지가 없어도 / 아직 안 왔어도 / 주소가 깨졌어도 화면이 무너지지 않습니다.
//   목록에서 카드 하나가 회색 네모로 남아 있는 것만큼 앱이 싸구려로 보이는 게 없습니다.
import { memo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '../../app/design-system/theme';
import { officialImage } from './officialImages';

export type ArtImageProps = {
  /** 카탈로그 id입니다. 이 id로 공식 이미지를 찾습니다. */
  id: string;
  /** 이미지가 없을 때(그리고 오는 동안) 보여 줄 우리 그림입니다. */
  fallback: ReactNode;
  width: number;
  height: number;
  accessibilityLabel?: string;
  /** 사진을 어떻게 채울지입니다. 신발은 contain, 포스터는 cover가 맞습니다. */
  resizeMode?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
};

export const ArtImage = memo(function ArtImage({
  accessibilityLabel,
  fallback,
  height,
  id,
  resizeMode = 'contain',
  style,
  width,
}: ArtImageProps) {
  const image = officialImage(id);
  // 주소가 있어도 실제로 못 받아 올 수 있습니다(만료·차단·오프라인).
  // 그때는 조용히 우리 그림으로 되돌아갑니다. 오류 화면을 띄우지 않습니다.
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(image) && !failed;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[styles.root, { width, height }, style]}
    >
      {/* 아래 칸: 우리 그림. 언제나 여기 있습니다. */}
      <View style={styles.layer}>{fallback}</View>

      {/* 위 칸: 공식 사진. 있을 때만, 그리고 잘 받아졌을 때만 덮습니다. */}
      {showPhoto && image ? (
        <Image
          onError={() => setFailed(true)}
          resizeMode={resizeMode}
          source={{ uri: image.url }}
          style={[StyleSheet.absoluteFill, styles.photo]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', borderRadius: radius.sm },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
});
