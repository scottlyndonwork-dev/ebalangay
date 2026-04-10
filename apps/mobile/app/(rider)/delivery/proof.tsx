import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Camera, CheckCircle } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

export default function ProofOfDeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { accessToken } = useAuthStore()
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Please allow camera access to take proof of delivery.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (!photoUri) throw new Error('No photo')
      const formData = new FormData()
      formData.append('file', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `pod_${orderId}.jpg`,
      } as unknown as Blob)
      formData.append('orderId', orderId)
      return api.orders.submitProofOfDelivery(orderId, formData, accessToken!)
    },
    onSuccess: () => {
      Alert.alert('Delivery complete!', 'Order has been marked as delivered.', [
        { text: 'OK', onPress: () => router.replace('/(rider)') },
      ])
    },
    onError: () => Alert.alert('Upload failed', 'Please try again.'),
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Proof of delivery</Text>
        <Text style={styles.orderId}>#{orderId?.slice(-6).toUpperCase()}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Take a clear photo showing the delivered items at the customer's door or in the customer's hands.
        </Text>

        {photoUri ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            <TouchableOpacity style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeBtnText}>Retake photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBox} onPress={takePhoto} activeOpacity={0.8}>
            <Camera size={40} color="#9ca3af" />
            <Text style={styles.cameraText}>Tap to take photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!photoUri || isPending) && styles.btnDisabled]}
          onPress={() => submit()}
          disabled={!photoUri || isPending}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Confirm delivery</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  orderId: { fontSize: 13, color: '#6b7280' },
  content: { flex: 1, padding: 24, gap: 20 },
  instructions: { fontSize: 14, color: '#6b7280', lineHeight: 22, textAlign: 'center' },
  cameraBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 260,
  },
  cameraText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
  photoPreview: { flex: 1, gap: 12, minHeight: 260 },
  photo: { flex: 1, borderRadius: 14, minHeight: 220 },
  retakeBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  retakeBtnText: { color: '#374151', fontWeight: '500', fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14 },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
