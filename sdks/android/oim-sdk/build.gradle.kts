/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
plugins {
  alias(libs.plugins.android.library)
  alias(libs.plugins.kotlin.compose)
}

group = "media.oim"
version = "0.1.0"

// The spec package in this repository: the tests read its vectors in place.
val specDir = rootDir.resolve("../../packages/spec").canonicalFile

android {
  namespace = "media.oim.sdk"
  compileSdk { version = release(36) { minorApiLevel = 1 } }

  defaultConfig {
    minSdk = 24
    consumerProguardFiles("consumer-rules.pro")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }

  buildFeatures { compose = true }

  if (project.hasProperty("oimEnableNdk")) {
    externalNativeBuild {
      cmake {
        path = file("src/main/cpp/CMakeLists.txt")
        version = "3.22.1"
      }
    }
  }

  testOptions {
    unitTests {
      isIncludeAndroidResources = true
      all {
        it.systemProperty("oim.spec.dir", specDir.path)
        // OIM_PARITY=1 turns on VisualParityTest (renders, never compares).
        System.getenv("OIM_PARITY")?.let { v -> it.systemProperty("oim.parity", v) }
        it.systemProperty("oim.parity.out", layout.buildDirectory.dir("parity/android").get().asFile.path)
        it.inputs.dir(specDir.resolve("vectors"))
        it.inputs.dir(specDir.resolve("vectors-2"))
        it.inputs.file(specDir.resolve("canonical-cases.json"))
      }
    }
  }
}

dependencies {
  api(libs.okhttp)
  api(libs.kotlinx.coroutines.android)
  api(libs.kotlinx.coroutines.core)
  implementation(libs.androidx.core.ktx)

  implementation(platform(libs.androidx.compose.bom))
  api(libs.androidx.compose.ui)
  api(libs.androidx.compose.ui.graphics)
  api(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.material.icons.core)
  implementation(libs.androidx.compose.material.icons.extended)
  implementation(libs.androidx.compose.ui.tooling.preview)

  testImplementation(libs.junit)
  testImplementation(libs.androidx.junit)
  testImplementation(libs.androidx.test.core)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.robolectric)
  testImplementation(platform(libs.androidx.compose.bom))
  testImplementation(libs.androidx.compose.ui.test.junit4)
  debugImplementation(libs.androidx.compose.ui.test.manifest)
}
