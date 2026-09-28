package com.karotto.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.karotto.app.ui.KarottoNavHost
import com.karotto.app.ui.LoginRoute
import com.karotto.app.ui.theme.KarottoTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val container = (application as KarottoApp).container
        var ready = false
        splash.setKeepOnScreenCondition { !ready }
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )
        lifecycleScope.launch {
            val session = container.settings.session.first()
            val themeMode = container.settings.themeMode.first()
            setContent {
                val mode by container.settings.themeMode.collectAsStateWithLifecycle(initialValue = themeMode)
                val currentSession by container.session.collectAsStateWithLifecycle()
                val navController = rememberNavController()
                KarottoTheme(mode) {
                    KarottoNavHost(container, navController, signedIn = session != null)
                }
                LaunchedEffect(currentSession == null) {
                    if (currentSession == null && session != null) {
                        navController.navigate(LoginRoute) { popUpTo(0) { inclusive = true } }
                    }
                }
                LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
                    lifecycleScope.launch { container.rescheduleReminders() }
                }
                LifecycleEventEffect(Lifecycle.Event.ON_START) { container.live.start() }
                LifecycleEventEffect(Lifecycle.Event.ON_STOP) { container.live.stop() }
            }
            ready = true
        }
    }
}
