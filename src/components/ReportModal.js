// ReportModal — § 6: icono outline, radios, contraste, "Bloquear también".
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { auth } from '../config/firebase';
import { createReport, REPORT_REASONS } from '../services/reportService';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

export default function ReportModal({ visible, onClose, targetType, targetId, targetName }) {
  const { colors } = useTheme();
  const [selected,      setSelected]      = useState(null);
  const [blockAlso,     setBlockAlso]     = useState(false);
  const [loading,       setLoading]       = useState(false);

  const targetLabel = targetType === 'user' ? 'usuario' : targetType === 'event' ? 'evento' : 'publicación';
  const canSubmit   = !!selected && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await createReport({
        reporterId: auth.currentUser.uid,
        targetType,
        targetId,
        reason: selected,
      });
      Alert.alert('Reporte enviado', 'Gracias por avisar. Revisaremos el contenido a la brevedad.');
      setSelected(null);
      setBlockAlso(false);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar el reporte.');
    }
    setLoading(false);
  };

  const handleClose = () => { setSelected(null); setBlockAlso(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <View style={[styles.sheet, { backgroundColor: colors['bg.raised'] }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors['border.strong'] }]} />

        {/* Header — § 6.1: icono outline en cápsula coral, no emoji */}
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors['status.urgent']}18` }]}>
            <Ionicons name="flag-outline" size={20} color={colors['status.urgent']} />
          </View>
          <View style={{ flex: 1 }}>
            {/* § 6.4: nombre en text.primary */}
            <Text variant="title">
              Reportar {targetLabel}
              {targetName ? `: ${targetName}` : ''}
            </Text>
            <Text variant="caption" color="text.tertiary">¿Cuál es el problema?</Text>
          </View>
        </View>

        {/* Opciones con radio (§ 6.2) */}
        {REPORT_REASONS.map(reason => {
          const isSelected = selected === reason.id;
          return (
            <Pressable
              key={reason.id}
              onPress={() => setSelected(reason.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={[
                styles.reasonRow,
                {
                  borderColor:     isSelected ? colors['action.primary'] : colors['border.subtle'],
                  backgroundColor: isSelected ? '#FFF6E0' : colors['bg.surface'],
                },
              ]}
            >
              {/* Radio 22px a la izquierda (§ 6.2) */}
              <View style={[
                styles.radio,
                { borderColor: isSelected ? colors['action.primary'] : colors['border.strong'] },
              ]}>
                {isSelected && (
                  <View style={[styles.radioDot, { backgroundColor: colors['action.primary'] }]} />
                )}
              </View>
              <Text
                variant="body"
                style={{ flex: 1, color: isSelected ? '#7A5500' : colors['text.primary'] }}
              >
                {reason.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Bloquear también (§ 6.5) */}
        {targetType === 'user' && (
          <View style={[styles.blockRow, { borderTopColor: colors['border.subtle'] }]}>
            <Ionicons name="ban-outline" size={18} color={colors['text.secondary']} />
            <Text variant="body" style={{ flex: 1 }}>Bloquear también</Text>
            <Switch
              value={blockAlso}
              onValueChange={setBlockAlso}
              trackColor={{ false: colors['border.strong'], true: colors['status.free'] }}
              thumbColor={colors['text.primary']}
            />
          </View>
        )}

        {/* Botón enviar — § 6.3: deshabilitado hasta elegir motivo, luego status.urgent */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors['status.urgent'] : colors['bg.surface'] },
          ]}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{
              fontSize: 15,
              fontFamily: 'PlusJakartaSans_700Bold',
              color: canSubmit ? '#fff' : colors['text.secondary'],
            }}>
              Enviar reporte
            </Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[5],
    paddingBottom: space[8],
    paddingTop: space[3],
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: space[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    marginBottom: space[4],
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    marginBottom: space[2],
    gap: space[3],
  },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[3],
    marginTop: space[2],
    marginBottom: space[2],
  },
  submitBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[3],
  },
});
