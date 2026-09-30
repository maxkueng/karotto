plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

val releaseKeystore = System.getenv("KAROTTO_KEYSTORE")?.let(::file)?.takeIf { it.exists() }

android {
    namespace = "com.karotto.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.karotto.app"
        minSdk = 26
        targetSdk = 37
        versionCode = System.getenv("KAROTTO_VERSION_CODE")?.toInt() ?: 1
        versionName = System.getenv("KAROTTO_VERSION_NAME") ?: "0.1.0-dev"
        resValue("string", "app_name", "karotto")
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("KAROTTO_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KAROTTO_KEY_ALIAS")
                keyPassword = System.getenv("KAROTTO_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            resValue("string", "app_name", "karotto dev")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.core.ktx)
    implementation(libs.core.splashscreen)
    implementation(libs.activity.compose)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.process)
    implementation(libs.navigation.compose)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.datastore.preferences)
    implementation(libs.work.runtime)
    implementation(libs.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.security.crypto)
    implementation(libs.commonmark)
    debugImplementation(libs.compose.ui.tooling)
    testImplementation(libs.junit)
}
