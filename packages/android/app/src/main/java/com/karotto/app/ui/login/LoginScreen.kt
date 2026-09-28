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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.AppContainer
import com.karotto.app.R
import com.karotto.app.data.api.ApiException
import com.karotto.app.data.api.NetworkException
import com.karotto.app.ui.theme.Brand
import com.karotto.app.ui.theme.Gray
import kotlinx.coroutines.launch
import java.time.ZoneId

@Composable
fun LoginScreen(container: AppContainer, onSignedIn: () -> Unit) {
    var serverUrl by remember { mutableStateOf("http://10.0.2.2:3210") }
    var username by remember { mutableStateOf("") }
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
            .background(Brand.b300),
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
                LoginField(serverUrl, { serverUrl = it }, "Server URL", KeyboardType.Uri)
                LoginField(username, { username = it }, "Username", KeyboardType.Text)
                LoginField(password, { password = it }, "Password", KeyboardType.Password, password = true, onDone = ::submit)
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
                        contentColor = Gray.g50,
                        disabledContainerColor = Color.White.copy(alpha = 0.5f),
                        disabledContentColor = Gray.g50.copy(alpha = 0.6f),
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
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboard: KeyboardType,
    password: Boolean = false,
    onDone: (() -> Unit)? = null,
) {
    TextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = Brand.b600, fontSize = 18.sp) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = if (onDone != null) ImeAction.Done else ImeAction.Next, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Brand.b100,
            unfocusedContainerColor = Brand.b100,
            disabledContainerColor = Brand.b100,
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
