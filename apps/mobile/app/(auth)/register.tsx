import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [phone, setPhone] = useState('')
  const [userId, setUserId] = useState('')

  const { control, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', password: '' },
  })

  const onRegister = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await api.auth.register({ name: data.name, phone: data.phone, password: data.password, role: 'CUSTOMER' })
      setUserId(res.userId)
      setPhone(data.phone)
      setOtpSent(true)
    } catch {
      Alert.alert('Registration failed', 'Phone number may already be in use.')
    } finally {
      setLoading(false)
    }
  }

  const onVerify = async () => {
    if (otp.length < 4) {
      Alert.alert('Enter OTP', 'Please enter the verification code sent to your phone.')
      return
    }
    setLoading(true)
    try {
      const res = await api.auth.verifyOtp({ userId, otp })
      await setAuth(res.user, res.accessToken, res.refreshToken)
      router.replace('/(customer)')
    } catch {
      Alert.alert('Verification failed', 'Invalid or expired OTP.')
    } finally {
      setLoading(false)
    }
  }

  if (otpSent) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.logo}>eBalangay</Text>
          <Text style={styles.tagline}>Enter the 6-digit code sent to {phone}</Text>

          <TextInput
            style={styles.input}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={onVerify}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & continue</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>eBalangay</Text>
        <Text style={styles.tagline}>Create your account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full name</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Juan dela Cruz"
                autoComplete="name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

          <Text style={[styles.label, { marginTop: 16 }]}>Phone number</Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+63 9XX XXX XXXX"
                keyboardType="phone-pad"
                autoComplete="tel"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="••••••••"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit(onRegister)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send verification code</Text>}
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: 'bold', color: '#15803d', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 40 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputError: { borderColor: '#ef4444' },
  error: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  btn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 14, color: '#6b7280' },
  linkBold: { color: '#16a34a', fontWeight: '600' },
})
