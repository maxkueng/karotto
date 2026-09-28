package com.karotto.app.data.store

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** AES-GCM with a fresh random IV per value, key held in the Android Keystore. */
class SecureStore(context: Context) {
    private val prefs = context.getSharedPreferences("karotto.secure", Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
        (store.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    fun put(name: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val payload = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)
        prefs.edit().putString(name, payload).apply()
    }

    fun get(name: String): String? {
        val payload = prefs.getString(name, null) ?: return null
        val (iv, data) = payload.split(":", limit = 2).let { parts ->
            if (parts.size != 2) return null
            Base64.decode(parts[0], Base64.NO_WRAP) to Base64.decode(parts[1], Base64.NO_WRAP)
        }
        return runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(data), Charsets.UTF_8)
        }.getOrNull()
    }

    fun remove(name: String) {
        prefs.edit().remove(name).apply()
    }

    private companion object {
        const val PROVIDER = "AndroidKeyStore"
        const val ALIAS = "karotto-token"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
