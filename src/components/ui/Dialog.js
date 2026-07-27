import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { elev, radius, space } from '../../theme/tokens';
import Button from './Button';
import Text from './Text';

export default function Dialog({
  visible,
  title,
  message,
  confirmLabel   = 'Confirmar',
  cancelLabel    = 'Cancelar',
  onConfirm,
  onCancel,
  destructive    = false,
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors['bg.overlay'] }]}
        onPress={onCancel}
      />
      <View style={styles.center}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors['bg.raised'] },
            elev[3],
          ]}
        >
          <Text variant="h3" style={styles.title}>{title}</Text>
          {message && (
            <Text variant="body" color="text.secondary" style={styles.message}>{message}</Text>
          )}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              label={cancelLabel}
              onPress={onCancel}
              style={styles.btn}
            />
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              size="sm"
              label={confirmLabel}
              onPress={onConfirm}
              style={[styles.btn, styles.btnPrimary]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.xl,
    padding: 22,
  },
  title:   { marginBottom: space[2] },
  message: { marginBottom: space[4] },
  actions: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
  btn:         { flex: 1 },
  btnPrimary:  { flex: 1.5 },
});
