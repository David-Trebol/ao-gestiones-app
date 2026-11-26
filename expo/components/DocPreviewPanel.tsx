import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown, ChevronUp, FileText, X, ZoomIn } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type DocPreview = { fileName: string; previews: string[]; aspects: number[] };

/**
 * Documento leído (oferta, proforma, factura) que se queda a mano mientras se rellena el pedido,
 * para contrastar los datos. Solo vive en la pantalla: no se guarda en el pedido.
 */
export default function DocPreviewPanel({ doc, onRemove }: { doc: DocPreview; onRemove: () => void }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const stripH = width >= 1024 ? 460 : width >= 600 ? 380 : 300;
  const n = doc.previews.length;

  return (
    <View style={[st.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="doc-preview-panel">
      <View style={st.head}>
        <View style={[st.icon, { backgroundColor: colors.primarySoft }]}><FileText size={16} color={colors.primary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.title, { color: colors.text }]} numberOfLines={1}>{doc.fileName}</Text>
          <Text style={[st.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            Documento leído · {n} página{n === 1 ? '' : 's'} · no se guarda en el pedido
          </Text>
        </View>
        <Pressable onPress={() => setOpen(o => !o)} style={[st.btn, { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel={open ? 'Ocultar documento' : 'Ver documento'} testID="doc-preview-toggle">
          {open ? <ChevronUp size={16} color={colors.text} /> : <ChevronDown size={16} color={colors.text} />}
          {width >= 420 && <Text style={[st.btnText, { color: colors.text }]}>{open ? 'Ocultar' : 'Ver'}</Text>}
        </Pressable>
        <Pressable onPress={onRemove} style={[st.btn, { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Quitar documento" testID="doc-preview-remove">
          <X size={16} color={colors.text} />
        </Pressable>
      </View>
      {open && (
        <ScrollView horizontal style={[st.strip, { height: stripH, backgroundColor: isDark ? '#000' : '#E5E5EA' }]} contentContainerStyle={st.stripContent} testID="doc-preview-strip">
          {doc.previews.map((src, i) => (
            <Pressable key={i} onPress={() => setZoom(i)} accessibilityRole="imagebutton" accessibilityLabel={`Ampliar página ${i + 1}`} testID={`doc-preview-page-${i}`}>
              <Image source={{ uri: src }} style={[st.page, { height: stripH - 24, aspectRatio: doc.aspects[i] || 0.707 }]} resizeMode="contain" />
              <View style={st.zoomTag}><ZoomIn size={13} color="#fff" /><Text style={st.zoomText}>{i + 1}</Text></View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Modal visible={zoom !== null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <View style={st.modalBg}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 64, alignItems: 'center', gap: 16 }}>
            {doc.previews.map((src, i) => (
              <Image key={i} source={{ uri: src }} style={{ width: Math.min(width - 32, 1000), aspectRatio: doc.aspects[i] || 0.707, backgroundColor: '#fff', borderRadius: 6 }} resizeMode="contain" accessibilityLabel={`Página ${i + 1}`} />
            ))}
          </ScrollView>
          <Pressable onPress={() => setZoom(null)} style={st.close} accessibilityRole="button" accessibilityLabel="Cerrar" testID="doc-preview-close">
            <X size={20} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 12 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, minWidth: 34, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999 },
  btnText: { fontSize: 13, fontWeight: '600' },
  strip: { flexGrow: 0 },
  stripContent: { padding: 12, gap: 12, alignItems: 'center' },
  page: { backgroundColor: '#fff', borderRadius: 6 },
  zoomTag: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  close: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
