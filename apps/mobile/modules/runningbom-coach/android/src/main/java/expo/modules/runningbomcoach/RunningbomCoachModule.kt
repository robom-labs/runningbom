// 러닝봄 JavaScript와 Android foreground 코칭 서비스를 연결합니다.
package expo.modules.runningbomcoach

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RunningbomCoachModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RunningbomCoach")

    Function("isAvailable") {
      true
    }

    // Expo 네이티브 함수는 인자를 8개까지만 받는다. 음성 설정 3개는 한 객체로 묶어 7개로 유지한다.
    AsyncFunction("startSession") {
      sessionId: String,
      definitionId: String,
      title: String,
      countsAs: String,
      durationSeconds: Int,
      cueSchedule: String,
      voice: Map<String, Any?> ->
      val speechRate = (voice["rate"] as? Number)?.toDouble() ?: 1.0
      val voiceId = voice["voiceId"] as? String ?: ""
      val pitch = (voice["pitch"] as? Number)?.toDouble() ?: 1.0
      val openEnded = voice["openEnded"] as? Boolean ?: false
      val context = requireContext()
      val intent = Intent(context, RunningbomCoachService::class.java).apply {
        action = RunningbomCoachService.ACTION_START
        putExtra(RunningbomCoachService.EXTRA_SESSION_ID, sessionId)
        putExtra(RunningbomCoachService.EXTRA_DEFINITION_ID, definitionId)
        putExtra(RunningbomCoachService.EXTRA_TITLE, title)
        putExtra(RunningbomCoachService.EXTRA_COUNTS_AS, countsAs)
        putExtra(RunningbomCoachService.EXTRA_DURATION_SECONDS, durationSeconds)
        putExtra(RunningbomCoachService.EXTRA_CUE_SCHEDULE, cueSchedule)
        putExtra(RunningbomCoachService.EXTRA_SPEECH_RATE, speechRate.toFloat())
        putExtra(RunningbomCoachService.EXTRA_VOICE_ID, voiceId)
        putExtra(RunningbomCoachService.EXTRA_PITCH, pitch.toFloat())
        putExtra(RunningbomCoachService.EXTRA_OPEN_ENDED, openEnded)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    AsyncFunction("pauseSession") {
      sendAction(RunningbomCoachService.ACTION_PAUSE)
    }

    AsyncFunction("resumeSession") {
      sendAction(RunningbomCoachService.ACTION_RESUME)
    }

    AsyncFunction("stopSession") {
      sendAction(RunningbomCoachService.ACTION_STOP)
    }

    AsyncFunction("getState") {
      val preferences = requireContext().getSharedPreferences(
        RunningbomCoachService.PREFERENCES,
        Context.MODE_PRIVATE,
      )
      mapOf(
        "state" to preferences.getString("state", "idle"),
        "sessionId" to preferences.getString("sessionId", null),
        "definitionId" to preferences.getString("definitionId", null),
        "title" to preferences.getString("title", null),
        "countsAs" to preferences.getString("countsAs", null),
        "elapsedSeconds" to preferences.getInt("elapsedSeconds", 0),
        "durationSeconds" to preferences.getInt("durationSeconds", 0),
        "openEnded" to preferences.getBoolean("openEnded", false),
        "startedAtEpochMillis" to preferences.getLong("startedAtEpochMillis", 0L),
        "completedAtEpochMillis" to preferences.getLong("completedAtEpochMillis", 0L),
      )
    }

    AsyncFunction("startMetronome") { cadence: Int ->
      val context = requireContext()
      val intent = Intent(context, RunningbomMetronomeService::class.java).apply {
        action = RunningbomMetronomeService.ACTION_START
        putExtra(RunningbomMetronomeService.EXTRA_CADENCE, cadence)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    AsyncFunction("stopMetronome") {
      val context = requireContext()
      context.startService(Intent(context, RunningbomMetronomeService::class.java).apply {
        action = RunningbomMetronomeService.ACTION_STOP
      })
    }

    AsyncFunction("getMetronomeState") {
      val preferences = requireContext().getSharedPreferences(
        RunningbomMetronomeService.PREFERENCES,
        Context.MODE_PRIVATE,
      )
      mapOf(
        "playing" to preferences.getBoolean("playing", false),
        "cadence" to preferences.getInt("cadence", 170),
        "beatCount" to preferences.getLong("beatCount", 0L),
        "startedAtEpochMillis" to preferences.getLong("startedAtEpochMillis", 0L),
        "underrunCount" to preferences.getInt("underrunCount", 0),
      )
    }
  }

  private fun requireContext(): Context {
    return appContext.reactContext ?: throw Exceptions.ReactContextLost()
  }

  private fun sendAction(action: String) {
    val context = requireContext()
    context.startService(Intent(context, RunningbomCoachService::class.java).apply {
      this.action = action
    })
  }
}
