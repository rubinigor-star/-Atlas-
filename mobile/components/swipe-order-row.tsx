import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type SwipeAction = {
  label: string;
  icon: IconName;
  backgroundColor: string;
  onPress: () => void;
};

type Props = PropsWithChildren<{
  enabled?: boolean;
  rightSwipe?: SwipeAction | null;
  leftSwipe?: SwipeAction | null;
}>;

const ACTION_WIDTH = 92;
const TRIGGER_DISTANCE = 64;
const DIRECTION_LOCK_DISTANCE = 8;

export function SwipeOrderRow({ enabled = true, rightSwipe = null, leftSwipe = null, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);

  const reset = () => {
    dragging.current = false;
    Animated.timing(translateX, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (!enabled) return false;
      const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6;
      if (!horizontal || Math.abs(gesture.dx) < DIRECTION_LOCK_DISTANCE) return false;
      if (gesture.dx > 0 && !rightSwipe) return false;
      if (gesture.dx < 0 && !leftSwipe) return false;
      return true;
    },
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      dragging.current = true;
      translateX.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      if (!dragging.current) return;
      const min = leftSwipe ? -ACTION_WIDTH : 0;
      const max = rightSwipe ? ACTION_WIDTH : 0;
      const next = Math.max(min, Math.min(max, gesture.dx));
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      dragging.current = false;
      if (gesture.dx >= TRIGGER_DISTANCE && rightSwipe) {
        Animated.timing(translateX, { toValue: ACTION_WIDTH, duration: 90, useNativeDriver: true }).start(() => {
          translateX.setValue(0);
          rightSwipe.onPress();
        });
        return;
      }
      if (gesture.dx <= -TRIGGER_DISTANCE && leftSwipe) {
        Animated.timing(translateX, { toValue: -ACTION_WIDTH, duration: 90, useNativeDriver: true }).start(() => {
          translateX.setValue(0);
          leftSwipe.onPress();
        });
        return;
      }
      reset();
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: reset,
  }), [enabled, leftSwipe, rightSwipe, translateX]);

  if (!enabled || (!rightSwipe && !leftSwipe)) return <>{children}</>;

  return (
    <View style={styles.root}>
      {rightSwipe && <View style={[styles.action, styles.rightAction, { backgroundColor: rightSwipe.backgroundColor }]}>
        <Ionicons name={rightSwipe.icon} size={22} color="#fff" />
        <Text style={styles.actionText}>{rightSwipe.label}</Text>
      </View>}
      {leftSwipe && <View style={[styles.action, styles.leftAction, { backgroundColor: leftSwipe.backgroundColor }]}>
        <Ionicons name={leftSwipe.icon} size={22} color="#fff" />
        <Text style={styles.actionText}>{leftSwipe.label}</Text>
      </View>}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.foreground, { transform: [{ translateX }] }]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", overflow: "hidden", borderRadius: 18, backgroundColor: "#F5F6FA" },
  foreground: { backgroundColor: "#fff" },
  action: { ...StyleSheet.absoluteFillObject, width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 3 },
  rightAction: { right: undefined },
  leftAction: { left: undefined, right: 0 },
  actionText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
