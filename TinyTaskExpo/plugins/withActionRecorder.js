const {
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── 1. Accessibility Service Config XML + Kotlin source files ──────────────
const withNativeFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = path.join(
        config.modRequest.projectRoot,
        'android/app/src/main'
      );

      // res/xml/accessibility_service_config.xml
      const xmlDir = path.join(androidRoot, 'res/xml');
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'accessibility_service_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeViewClicked|typeViewFocused|typeViewScrolled|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagIncludeNotImportantViews|flagReportViewIds|flagRequestFilterKeyEvents"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_service_description" />`
      );

      // Kotlin source package directory
      const pkgDir = path.join(
        androidRoot,
        'java/com/tinytaskmobile'
      );
      if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });

      // ActionRecorderService.kt
      fs.writeFileSync(
        path.join(pkgDir, 'ActionRecorderService.kt'),
        `package com.tinytaskmobile

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.view.accessibility.AccessibilityEvent
import android.util.Log

class ActionRecorderService : AccessibilityService() {

    companion object {
        private const val TAG = "ActionRecorderService"
        var instance: ActionRecorderService? = null
        var isRecording = false
        val recordedActions = mutableListOf<RecordedAction>()
    }

    data class RecordedAction(
        val type: String,
        val x: Float,
        val y: Float,
        val timestamp: Long
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isRecording || event == null) return
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            val source = event.source ?: return
            val rect = Rect()
            source.getBoundsInScreen(rect)
            val x = rect.centerX().toFloat()
            val y = rect.centerY().toFloat()
            recordedActions.add(RecordedAction("click", x, y, System.currentTimeMillis()))
            Log.d(TAG, "Recorded click at ${'$'}x, ${'$'}y")
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service Interrupted")
    }

    fun playRecordedActions() {
        if (recordedActions.isEmpty()) return
        for (action in recordedActions) {
            dispatchClick(action.x, action.y)
        }
    }

    private fun dispatchClick(x: Float, y: Float) {
        val path = Path()
        path.moveTo(x, y)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(g: GestureDescription?) {
                Log.d(TAG, "Gesture completed at ${'$'}x, ${'$'}y")
            }
        }, null)
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }
}`
      );

      // ActionRecorderModule.kt
      fs.writeFileSync(
        path.join(pkgDir, 'ActionRecorderModule.kt'),
        `package com.tinytaskmobile

import com.facebook.react.bridge.*
import android.content.Intent
import android.provider.Settings
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class ActionRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ActionRecorder"

    @ReactMethod
    fun startRecording() {
        ActionRecorderService.isRecording = true
        ActionRecorderService.recordedActions.clear()
    }

    @ReactMethod
    fun stopRecording() {
        ActionRecorderService.isRecording = false
    }

    @ReactMethod
    fun playActions() {
        ActionRecorderService.instance?.playRecordedActions()
    }

    @ReactMethod
    fun saveRecording(name: String, promise: Promise) {
        try {
            val file = java.io.File(reactApplicationContext.filesDir, "${'$'}name.json")
            file.writeText(Gson().toJson(ActionRecorderService.recordedActions))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun loadRecording(name: String, promise: Promise) {
        try {
            val file = java.io.File(reactApplicationContext.filesDir, "${'$'}name.json")
            if (!file.exists()) {
                promise.reject("LOAD_ERROR", "File not found")
                return
            }
            val type = object : TypeToken<MutableList<ActionRecorderService.RecordedAction>>() {}.type
            val actions: MutableList<ActionRecorderService.RecordedAction> =
                Gson().fromJson(file.readText(), type)
            ActionRecorderService.recordedActions.clear()
            ActionRecorderService.recordedActions.addAll(actions)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getSavedRecordings(promise: Promise) {
        try {
            val files = reactApplicationContext.filesDir
                .listFiles { _, n -> n.endsWith(".json") }
            val array = Arguments.createArray()
            files?.forEach { array.pushString(it.name.removeSuffix(".json")) }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        promise.resolve(ActionRecorderService.instance != null)
    }
}`
      );

      // ActionRecorderPackage.kt
      fs.writeFileSync(
        path.join(pkgDir, 'ActionRecorderPackage.kt'),
        `package com.tinytaskmobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ActionRecorderPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(ActionRecorderModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}`
      );

      // strings.xml - add accessibility description
      const valuesDir = path.join(androidRoot, 'res/values');
      const stringsPath = path.join(valuesDir, 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let content = fs.readFileSync(stringsPath, 'utf8');
        if (!content.includes('accessibility_service_description')) {
          content = content.replace(
            '</resources>',
            `    <string name="accessibility_service_description">Enables TinyTask to record and replay touch actions system-wide.</string>\n</resources>`
          );
          fs.writeFileSync(stringsPath, content);
        }
      }

      return config;
    },
  ]);

// ─── 2. AndroidManifest — register the service ──────────────────────────────
const withServiceManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    const alreadyRegistered = app.service.some(
      (s) => s.$?.['android:name'] === '.ActionRecorderService'
    );

    if (!alreadyRegistered) {
      app.service.push({
        $: {
          'android:name': '.ActionRecorderService',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
    }
    return config;
  });

// ─── 3. app/build.gradle — add GSON dependency ──────────────────────────────
const withGsonDependency = (config) =>
  withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    if (!gradle.includes('com.google.code.gson:gson')) {
      config.modResults.contents = gradle.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("com.google.code.gson:gson:2.10.1")`
      );
    }
    return config;
  });

// ─── 4. MainApplication — register package ──────────────────────────────────
const withMainApplicationPackage = (config) =>
  withMainApplication(config, (config) => {
    const src = config.modResults.contents;
    if (!src.includes('ActionRecorderPackage')) {
      // Insert after "PackageList(this).packages.apply {"
      config.modResults.contents = src.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n          add(ActionRecorderPackage())`
      );
    }
    return config;
  });

// ─── Compose all mods ───────────────────────────────────────────────────────
const withActionRecorder = (config) => {
  config = withNativeFiles(config);
  config = withServiceManifest(config);
  config = withGsonDependency(config);
  config = withMainApplicationPackage(config);
  return config;
};

module.exports = withActionRecorder;
