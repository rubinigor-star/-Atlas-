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
  rightSwipe: SwipeAction;
  leftSwipe: SwipeAction;
}>;

const ACTION_WIDTH = 104;
const TRIGGER_DISTANCE = 76;

export function SwipeOrderRow({ enabled = true, rightSwipe, leftSwipe, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  const reset = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (!enabled) return false;
      const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4;
      return horizontal && Math.abs(gesture.dx) > 7;
    },
    onPanResponderGrant: () => translateX.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      const clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, gesture.dx));
      translateX.setValue(clamped);
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx >= TRIGGER_DISTANCE) {
        Animated.timing(translateX, { toValue: ACTION_WIDTH, duration: 110, useNativeDriver: true }).start(() => {
          reset();
          rightSwipe.onPress();
        });
        return;
      }
      if (gesture.dx <= -TRIGGER_DISTANCE) {
        Animated.timing(translateX, { toValue: -ACTION_WIDTH, duration: 110, useNativeDriver: true }).start(() => {
          reset();
          leftSwipe.onPress();
        });
        return;
      }
      reset();
    },
    onPanResponderTerminate: reset,
  }), [enabled, leftSwipe, rightSwipe, translateX]);

  if (!enabled) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View style={[styles.action, styles.rightAction, { backgroundColor: rightSwipe.backgroundColor }]}>
        <Ionicons name={rightSwipe.icon} size={24} color="#fff" />
        <Text style={styles.actionText}>{rightSwipe.label}</Text>
      </View>
      <View style={[styles.action, styles.leftAction, { backgroundColor: leftSwipe.backgroundColor }]}>
        <Ionicons name={leftSwipe.icon} size={24} color="#fff" />
        <Text style={styles.actionText}>{leftSwipe.label}</Text>
      </View>
      <Animated.View {...panResponder.panHandlers} style={[styles.foreground, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", overflow: "hidden", backgroundColor: "#F5F6FA" },
  foreground: { backgroundColor: "#fff" },
  action: { ...StyleSheet.absoluteFillObject, width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 3 },
  rightAction: { right: undefined },
  leftAction: { left: undefined, right: 0 },
  actionText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },
});
