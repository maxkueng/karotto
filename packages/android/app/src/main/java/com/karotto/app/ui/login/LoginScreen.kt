package com.karotto.app.ui.login

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.karotto.app.AppContainer
import com.karotto.app.R
import com.karotto.app.data.api.ApiException
import com.karotto.app.data.api.NetworkException
import com.karotto.app.ui.theme.BrandRamp
import com.karotto.app.ui.theme.KarottoTheme
import kotlinx.coroutines.launch
import java.time.ZoneId

@Composable
fun LoginScreen(container: AppContainer, onSignedIn: () -> Unit) {
    val brand = KarottoTheme.palette.brand
    val remembered by container.settings.lastLogin.collectAsStateWithLifecycle(initialValue = null)
    var serverUrl by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    LaunchedEffect(remembered) {
        val last = remembered ?: return@LaunchedEffect
        if (serverUrl.isEmpty()) serverUrl = last.serverUrl ?: "https://"
        if (username.isEmpty()) username = last.username ?: ""
    }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val canSubmit = serverUrl.isNotBlank() && username.isNotBlank() && password.isNotEmpty() && !loading

    fun submit() {
        if (!canSubmit) return
        loading = true
        error = null
        scope.launch {
            try {
                val base = serverUrl.trim().trimEnd('/')
                val device = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android" }
                val created = container.api.login(base, username.trim(), password, "karotto-android ($device)", ZoneId.systemDefault().id)
                container.settings.saveSession(base, username.trim(), created.token)
                onSignedIn()
            } catch (e: ApiException) {
                error = if (e.status == 401) "Wrong username or password" else e.message
            } catch (e: NetworkException) {
                error = "Could not reach the server"
            } catch (e: IllegalArgumentException) {
                error = "Invalid server URL"
            } finally {
                loading = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brand.nav),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(80.dp))
            Icon(
                painter = painterResource(R.drawable.ic_launcher_foreground),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(140.dp),
            )
            Text("karotto", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Spacer(Modifier.height(40.dp))
            Column(
                modifier = Modifier.widthIn(max = 480.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                LoginField(brand, serverUrl, { serverUrl = it }, "Server URL", KeyboardType.Uri)
                LoginField(brand, username, { username = it }, "Username", KeyboardType.Text)
                LoginField(brand, password, { password = it }, "Password", KeyboardType.Password, password = true, onDone = ::submit)
            }
            error?.let {
                Text(it, color = Color(0xFFFFB6B8), fontSize = 14.sp, modifier = Modifier.padding(top = 12.dp))
            }
            Spacer(Modifier.height(30.dp))
            if (loading) {
                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(48.dp))
            } else {
                Button(
                    onClick = ::submit,
                    enabled = canSubmit,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = brand.b50,
                        disabledContainerColor = Color.White.copy(alpha = 0.5f),
                        disabledContentColor = brand.b50.copy(alpha = 0.6f),
                    ),
                    modifier = Modifier.widthIn(max = 480.dp).fillMaxWidth().height(54.dp),
                ) {
                    Text("Login", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun LoginField(
    brand: BrandRamp,
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboard: KeyboardType,
    password: Boolean = false,
    onDone: (() -> Unit)? = null,
) {
    var revealed by remember { mutableStateOf(false) }
    TextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = brand.b600, fontSize = 18.sp) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        visualTransformation = if (password && !revealed) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (!password) null else {
            {
                IconButton(onClick = { revealed = !revealed }) {
                    Icon(
                        imageVector = if (revealed) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                        contentDescription = if (revealed) "Hide password" else "Show password",
                        tint = brand.b600,
                    )
                }
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = if (onDone != null) ImeAction.Done else ImeAction.Next, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = brand.navHover,
            unfocusedContainerColor = brand.navHover,
            disabledContainerColor = brand.navHover,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            cursorColor = Color.White,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
        ),
        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 18.sp, color = Color.White),
        modifier = Modifier.fillMaxWidth(),
    )
}
