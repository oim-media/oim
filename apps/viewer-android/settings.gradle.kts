/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
pluginManagement {
  repositories {
    google {
      content {
        includeGroupByRegex("com\\.android.*")
        includeGroupByRegex("com\\.google.*")
        includeGroupByRegex("androidx.*")
      }
    }
    mavenCentral()
    gradlePluginPortal()
  }
}

plugins { id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0" }

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
  // One version catalog for the SDK and the app.
  versionCatalogs { create("libs") { from(files("../../sdks/android/gradle/libs.versions.toml")) } }
}

rootProject.name = "oim-viewer-android"

// The SDK is built from source: media.oim:oim-sdk resolves to sdks/android.
includeBuild("../../sdks/android")
include(":app")
