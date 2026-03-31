import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { createReport, REPORT_REASONS } from '../services/reportService';

export default function ReportModal({ visible, onClose, targetType, targetId }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Selecciona una razón', 'Debes elegir el motivo del reporte.');
      return;
    }
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
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo enviar el reporte.');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Ionicons name="flag" size={20} color="#e74c3c" />
          <Text style={styles.title}>Reportar {targetType === 'user' ? 'usuario' : targetType === 'event' ? 'evento' : 'publicación'}</Text>
        </View>
        <Text style={styles.subtitle}>¿Cuál es el problema?</Text>
        {REPORT_REASONS.map(reason => (
          <TouchableOpacity
            key={reason.id}
            style={[styles.reasonRow, selected === reason.id && styles.reasonSelected]}
            onPress={() => setSelected(reason.id)}
          >
            <Text style={[styles.reasonText, selected === reason.id && styles.reasonTextSelected]}>
              {reason.label}
            </Text>
            {selected === reason.id && (
              <Ionicons name="checkmark-circle" size={20} color="#6c5ce7" />
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.submitBtn, !selected && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || !selected}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Enviar reporte</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: '#3d3d54', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 16 },
  reasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, backgroundColor: '#2d2d44', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  reasonSelected: { borderColor: '#6c5ce7', backgroundColor: '#2d2d55' },
  reasonText: { color: '#ccc', fontSize: 14 },
  reasonTextSelected: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#e74c3c', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
