import { Ionicons } from '@expo/vector-icons';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';

export default function SettingsScreen({ navigation }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesion',
      'Estas seguro que deseas cerrar sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar sesion', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error al cerrar sesion:', error);
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta accion es permanente y no se puede deshacer. Se eliminaran todos tus datos, eventos y mensajes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar cuenta', 
          style: 'destructive',
          onPress: () => confirmDeleteAccount()
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.prompt(
      'Confirmar eliminacion',
      'Escribe "ELIMINAR" para confirmar',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async (text) => {
            if (text === 'ELIMINAR') {
              try {
                const userId = auth.currentUser.uid;
                
                // Eliminar documento del usuario
                await deleteDoc(doc(db, 'users', userId));
                
                // Eliminar cuenta de auth
                await deleteUser(auth.currentUser);
                
                Alert.alert('Cuenta eliminada', 'Tu cuenta ha sido eliminada correctamente');
              } catch (error) {
                console.error('Error eliminando cuenta:', error);
                if (error.code === 'auth/requires-recent-login') {
                  Alert.alert(
                    'Sesion expirada', 
                    'Por seguridad, debes volver a iniciar sesion antes de eliminar tu cuenta',
                    [
                      { text: 'OK', onPress: () => signOut(auth) }
                    ]
                  );
                } else {
                  Alert.alert('Error', 'No se pudo eliminar la cuenta. Intenta de nuevo.');
                }
              }
            } else {
              Alert.alert('Error', 'Texto incorrecto. Escribe ELIMINAR para confirmar.');
            }
          }
        },
      ],
      'plain-text'
    );
  };

  const SettingItem = ({ icon, iconColor, title, subtitle, onPress, rightComponent, danger }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconColor || '#2d2d44' }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightComponent || (onPress && <Ionicons name="chevron-forward" size={20} color="#888" />)}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuracion</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionHeader title="Cuenta" />
        <View style={styles.section}>
          <SettingItem
            icon="person-outline"
            iconColor="#6c5ce7"
            title="Editar perfil"
            subtitle="Foto, nombre, biografia"
            onPress={() => navigation.navigate('EditProfile', { user: null })}
          />
          <SettingItem
            icon="lock-closed-outline"
            iconColor="#0984e3"
            title="Privacidad"
            subtitle="Permisos, bloqueos"
            onPress={() => Alert.alert('Privacidad', 'Proximamente...')}
          />
        </View>

        <SectionHeader title="Notificaciones" />
        <View style={styles.section}>
          <SettingItem
            icon="notifications-outline"
            iconColor="#00b894"
            title="Notificaciones push"
            subtitle="Recibe alertas de actividad"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#3d3d5c', true: '#6c5ce7' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <SectionHeader title="Informacion" />
        <View style={styles.section}>
          <SettingItem
            icon="document-text-outline"
            iconColor="#fdcb6e"
            title="Terminos y condiciones"
            onPress={() => Alert.alert('Terminos', 'Proximamente...')}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            iconColor="#00b894"
            title="Politica de privacidad"
            onPress={() => Alert.alert('Privacidad', 'Proximamente...')}
          />
          <SettingItem
            icon="help-circle-outline"
            iconColor="#0984e3"
            title="Ayuda y soporte"
            onPress={() => Alert.alert('Ayuda', 'Contactanos en: soporte@enfiestados.app')}
          />
          <SettingItem
            icon="information-circle-outline"
            iconColor="#888"
            title="Version de la app"
            subtitle="1.0.0 (Beta)"
          />
        </View>

        <SectionHeader title="Sesion" />
        <View style={styles.section}>
          <SettingItem
            icon="log-out-outline"
            iconColor="#e74c3c"
            title="Cerrar sesion"
            onPress={handleLogout}
            danger
          />
        </View>

        <SectionHeader title="Zona de peligro" />
        <View style={styles.section}>
          <SettingItem
            icon="trash-outline"
            iconColor="#e74c3c"
            title="Eliminar cuenta"
            subtitle="Esta accion es permanente"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hecho en Costa Rica</Text>
          <Text style={styles.footerText}>© 2025 Enfiestados</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  placeholder: { width: 34 },
  sectionHeader: { color: '#888', fontSize: 13, fontWeight: '600', paddingHorizontal: 20, paddingTop: 25, paddingBottom: 10, textTransform: 'uppercase' },
  section: { backgroundColor: '#2d2d44', marginHorizontal: 15, borderRadius: 12, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  settingIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingContent: { flex: 1 },
  settingTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  settingSubtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  dangerText: { color: '#e74c3c' },
  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { color: '#888', fontSize: 13, marginTop: 5 },
});
