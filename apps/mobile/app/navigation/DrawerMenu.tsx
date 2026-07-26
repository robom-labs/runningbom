// 새 네이티브 의존성 없이 Modal·Animated·Pressable로 만든 좌측 슬라이드 메뉴입니다.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '../design-system/components';
import {
  fontWeight,
  layout,
  lineHeight,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from '../design-system/theme';
import { menuGroups } from './routes';
import type { RouteKey } from './types';

type Props = {
  visible: boolean;
  activeRoute: RouteKey;
  nickname: string;
  summary: string;
  tier: string;
  onSelect: (route: RouteKey) => void;
  onClose: () => void;
};

export function DrawerMenu({
  visible,
  activeRoute,
  nickname,
  summary,
  tier,
  onSelect,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.max(268, width * 0.82));
  const translate = useRef(new Animated.Value(-panelWidth)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, {
        toValue: visible ? 0 : -panelWidth,
        duration: visible ? motion.slow : motion.fast,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: visible ? motion.base : motion.fast,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, panelWidth, translate, visible]);

  // 패널을 왼쪽으로 밀면 닫힙니다. 새 제스처 라이브러리 없이 기본 PanResponder만 씁니다.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderMove: (_event, gesture) => {
        translate.setValue(Math.min(0, gesture.dx));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx < -60 || gesture.vx < -0.6) {
          onCloseRef.current();
          return;
        }
        Animated.timing(translate, {
          toValue: 0,
          duration: motion.fast,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: fade }]} />
        <Pressable
          accessibilityLabel="메뉴 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.panel,
            { width: panelWidth, transform: [{ translateX: translate }] },
          ]}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.panelSafe}>
            <Pressable
              accessibilityHint="프로필을 편집해요"
              accessibilityLabel={`${nickname} 프로필. ${summary}. 등급 ${tier}`}
              accessibilityRole="button"
              onPress={() => onSelect('profile')}
              style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
              testID="drawer-profile"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{nickname.slice(0, 1) || '러'}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.nickname}>
                  {nickname}
                </Text>
                <Text numberOfLines={2} style={styles.summary}>
                  {summary}
                </Text>
              </View>
              <View style={styles.tier}>
                <Text style={styles.tierText}>{tier}</Text>
              </View>
            </Pressable>

            <ScrollView contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>
              {menuGroups.map((group) => (
                <View key={group.id} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map((item) => {
                    const active = item.key === activeRoute;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={item.key}
                        onPress={() => onSelect(item.key)}
                        style={({ pressed }) => [
                          styles.item,
                          active && styles.itemActive,
                          pressed && styles.pressed,
                        ]}
                        testID={`drawer-item-${item.key}`}
                      >
                        <Ionicons
                          color={active ? palette.accentDark : palette.inkSoft}
                          name={item.icon as keyof typeof Ionicons.glyphMap}
                          size={20}
                        />
                        <View style={styles.itemCopy}>
                          <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
                            {item.label}
                          </Text>
                          <Text style={styles.itemHint}>{item.hint}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <View style={styles.footer}>
                <Wordmark compact />
                <Text style={styles.footerText}>
                  기록은 이 기기에 저장돼요. 외부 계정 연결은 선택입니다.
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.scrim,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.surface,
    borderRightColor: palette.line,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  panelSafe: { flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarText: {
    color: palette.accentDark,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  profileCopy: { flex: 1, minWidth: 0 },
  nickname: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  summary: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs / 2,
  },
  tier: {
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  tierText: {
    color: palette.inkSoft,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
  },
  menu: { paddingBottom: spacing.xl },
  group: { paddingTop: spacing.md },
  groupTitle: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  itemActive: { backgroundColor: palette.surfaceWarm },
  itemCopy: { flex: 1, minWidth: 0 },
  itemLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  itemLabelActive: { color: palette.accentDark },
  itemHint: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    marginTop: spacing.xxs / 4,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  pressed: { opacity: 0.7 },
});
