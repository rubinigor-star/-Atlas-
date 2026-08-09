import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

type Props = PropsWithChildren<{
  enabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
}>;

const ACTION_WIDTH = 104;
const TRIGGER_DISTANCE = 76;

export function SwipeOrderRow({ enabled = true, onApprove, onReject, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);

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
    onPanResponderGrant: () => {
      dragging.current = true;
      translateX.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      const clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, gesture.dx));
      translateX.setValue(clamped);
    },
    onPanResponderRelease: (_, gesture) => {
      dragging.current = false;
      if (gesture.dx >= TRIGGER_DISTANCE) {
        Animated.timing(translateX, { toValue: ACTION_WIDTH, duration: 110, useNativeDriver: true }).start(() => {
          reset();
          onApprove();
        });
        return;
      }
      if (gesture.dx <= -TRIGGER_DISTANCE) {
        Animated.timing(translateX, { toValue: -ACTION_WIDTH, duration: 110, useNativeDriver: true }).start(() => {
          reset();
          onReject();
        });
        return;
      }
      reset();
    },
    onPanResponderTerminate: () => {
      dragging.current = false;
      reset();
    },
  }), [enabled, onApprove, onReject, translateX]);

  if (!enabled) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View style={[styles.action, styles.approveAction]}>
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
        <Text style={styles.actionText}>Подтвердить</Text>
      </View>
      <View style={[styles.action, styles.rejectAction]}>
        <Ionicons name="close-circle" size={24} color="#fff" />
        <Text style={styles.actionText}>Отклонить</Text>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.foreground, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", overflow: "hidden", backgroundColor: "#F5F6FA" },
  foreground: { backgroundColor: "#fff" },
  action: { ...StyleSheet.absoluteFillObject, width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 3 },
  approveAction: { right: undefined, backgroundColor: "#168044" },
  rejectAction: { left: undefined, right: 0, backgroundColor: "#B42318" },
  actionText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },
});
