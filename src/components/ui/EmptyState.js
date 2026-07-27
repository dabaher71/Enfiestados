import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Button from './Button';
import Text from './Text';

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {icon && (
        <View style={[styles.iconCapsule, { backgroundColor: colors['bg.surface'] }]}>
          {icon}
        </View>
      )}
      <Text variant="h3" align="center" style={styles.title}>{title}</Text>
      {description && (
        <Text variant="body" color="text.secondary" align="center" style={styles.desc}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          variant="primary"
          size="md"
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
    paddingVertical: space[16],
    gap: space[3],
  },
  iconCapsule: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  title: { marginBottom: space[1] },
  desc:  { marginBottom: space[2] },
  action: { marginTop: space[2] },
});
