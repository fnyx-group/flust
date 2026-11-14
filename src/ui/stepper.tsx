import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MinusIcon } from '@/ui/icons/minus-icon';
import { PlusIcon } from '@/ui/icons/plus-icon';
import { colors, radii, sizes, typography } from '@/ui/theme';

type StepperProps = {
  label: string;
  value: string;
  decrementLabel: string;
  incrementLabel: string;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
};

// Screen readers see a single adjustable element and change it by swiping up or down. The
// buttons inside are for touch only: iOS hides them behind the accessible parent, and Android is
// told to hide them too, since TalkBack would otherwise focus them without a role.
export function Stepper({
  label,
  value,
  decrementLabel,
  incrementLabel,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
}: StepperProps) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment' && canIncrement) onIncrement();
        if (nativeEvent.actionName === 'decrement' && canDecrement) onDecrement();
      }}
      style={styles.stepper}
    >
      <Text style={styles.label}>{label}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.controls}
      >
        <StepButton
          label={decrementLabel}
          disabled={!canDecrement}
          onPress={onDecrement}
          icon="minus"
        />
        <Text style={styles.value}>{value}</Text>
        <StepButton
          label={incrementLabel}
          disabled={!canIncrement}
          onPress={onIncrement}
          icon="plus"
        />
      </View>
    </View>
  );
}

type StepButtonProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
  icon: 'minus' | 'plus';
};

function StepButton({ label, disabled, onPress, icon }: StepButtonProps) {
  const color = disabled ? colors.locked : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {icon === 'minus' ? <MinusIcon color={color} /> : <PlusIcon color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexGrow: 1,
    flexBasis: 140,
    gap: 8,
    padding: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.label,
    textAlign: 'center',
  },
  // With large text the value wraps below the buttons instead of overflowing.
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    aspectRatio: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.separator,
  },
  pressed: {
    opacity: 0.8,
  },
  value: {
    ...typography.stepperValue,
    flexShrink: 1,
    textAlign: 'center',
    color: colors.text,
  },
});
