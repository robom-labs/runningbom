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

    AsyncFunction("startSession") {
      sessionId: String,
      definitionId: String,
      title: String,
      countsAs: String,
      durationSeconds: Int,
      cueSchedule: String,
      speechRate: Double ->
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
        "startedAtEpochMillis" to preferences.getLong("startedAtEpochMillis", 0L),
        "completedAtEpochMillis" to preferences.getLong("completedAtEpochMillis", 0L),
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
