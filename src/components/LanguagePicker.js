import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import Chip from './ui/Chip';
import { LANGUAGES, setLanguage } from '../i18n';
import { space } from '../theme/tokens';

// Selector de idioma: una fila de chips con el nombre de cada idioma en su
// propio idioma ("English", "Français"…), para que se reconozca aunque la app
// esté en uno que no se entiende. Cambia el idioma al instante y lo guarda.
// Se usa en Configuración y en el registro.
export default function LanguagePicker({ style, onChange }) {
  const { i18n } = useTranslation();
  return (
    <View style={[styles.row, style]}>
      {LANGUAGES.map(l => (
        <Chip
          key={l.code}
          label={l.label}
          selected={i18n.language === l.code}
          onPress={async () => { await setLanguage(l.code); onChange?.(l.code); }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
