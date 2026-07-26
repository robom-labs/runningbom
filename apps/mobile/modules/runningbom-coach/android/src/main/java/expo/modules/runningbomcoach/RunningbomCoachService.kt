// 화면이 잠겨도 기기 TTS 큐와 세션 시간을 단조 시간으로 운영하는 foreground 서비스입니다.
package expo.modules.runningbomcoach

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.core.content.ContextCompat
import java.util.Locale
import kotlin.math.roundToInt

private data class CoachCue(
  val offsetSeconds: Int,
  val text: String,
)

class RunningbomCoachService : Service(), TextToSpeech.OnInitListener {
  companion object {
    const val ACTION_START = "expo.modules.runningbomcoach.START"
    const val ACTION_PAUSE = "expo.modules.runningbomcoach.PAUSE"
    const val ACTION_RESUME = "expo.modules.runningbomcoach.RESUME"
    const val ACTION_STOP = "expo.modules.runningbomcoach.STOP"

    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_DEFINITION_ID = "definitionId"
    const val EXTRA_TITLE = "title"
    const val EXTRA_COUNTS_AS = "countsAs"
    const val EXTRA_DURATION_SECONDS = "durationSeconds"
    const val EXTRA_CUE_SCHEDULE = "cueSchedule"
    const val EXTRA_SPEECH_RATE = "speechRate"
    const val EXTRA_VOICE_ID = "voiceId"
    const val EXTRA_PITCH = "pitch"

    const val PREFERENCES = "runningbom-coach-state"
    private const val CHANNEL_ID = "runningbom-coach"
    private const val NOTIFICATION_ID = 7301
    private const val TICK_MILLIS = 500L
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var audioManager: AudioManager
  private lateinit var mediaSession: MediaSession
  private var textToSpeech: TextToSpeech? = null
  private var textToSpeechReady = false
  private var audioFocusRequest: AudioFocusRequest? = null

  private var sessionId = ""
  private var definitionId = ""
  private var title = "러닝 코칭"
  private var countsAs = "run"
  private var durationSeconds = 0
  private var speechRate = 1f
  private var speechPitch = 1f
  private var preferredVoiceId = ""
  private var cues: List<CoachCue> = emptyList()
  private var nextCueIndex = 0
  private var elapsedBeforeRunMillis = 0L
  private var activeRunStartedAt = 0L
  private var running = false
  private var pausedByAudioFocus = false
  private var completed = false
  private var startedAtEpochMillis = 0L
  private var completedAtEpochMillis = 0L

  private val ticker = object : Runnable {
    override fun run() {
      if (!running) return
      val elapsed = elapsedSeconds()
      deliverDueCue(elapsed)
      persistState("running", elapsed)
      updateMediaSession(elapsed)

      if (elapsed >= durationSeconds) {
        completedAtEpochMillis = System.currentTimeMillis()
        completed = true
        running = false
        persistState("completed", durationSeconds)
        updateMediaSession(durationSeconds)
        startForeground(NOTIFICATION_ID, buildNotification("완료"))
        handler.postDelayed({ stopSelf() }, 6_000)
        return
      }
      handler.postDelayed(this, TICK_MILLIS)
    }
  }

  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY && running) {
        pausedByAudioFocus = false
        pauseInternal("이어폰 연결이 해제되어 일시정지")
      }
    }
  }

  private val audioFocusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
        if (running) {
          pausedByAudioFocus = change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
          pauseInternal("다른 오디오 사용으로 일시정지")
        }
      }
      AudioManager.AUDIOFOCUS_GAIN -> {
        if (pausedByAudioFocus && !completed) {
          pausedByAudioFocus = false
          resumeInternal()
        }
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    createNotificationChannel()
    textToSpeech = TextToSpeech(this, this)
    mediaSession = MediaSession(this, "RunningbomCoach").apply {
      setCallback(object : MediaSession.Callback() {
        override fun onPlay() = resumeInternal()
        override fun onPause() = pauseInternal("사용자가 일시정지")
        override fun onStop() = stopSession()
      })
      isActive = true
    }
    ContextCompat.registerReceiver(
      this,
      noisyReceiver,
      IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> startSession(intent)
      ACTION_PAUSE -> {
        pausedByAudioFocus = false
        pauseInternal("일시정지")
      }
      ACTION_RESUME -> {
        pausedByAudioFocus = false
        resumeInternal()
      }
      ACTION_STOP -> stopSession()
    }
    return START_NOT_STICKY
  }

  private fun startSession(intent: Intent) {
    sessionId = intent.getStringExtra(EXTRA_SESSION_ID).orEmpty()
    definitionId = intent.getStringExtra(EXTRA_DEFINITION_ID).orEmpty()
    title = intent.getStringExtra(EXTRA_TITLE) ?: "러닝 코칭"
    countsAs = intent.getStringExtra(EXTRA_COUNTS_AS)
      ?.takeIf { it == "run" || it == "walk" || it == "recovery" }
      ?: "run"
    durationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 0).coerceAtLeast(1)
    speechRate = intent.getFloatExtra(EXTRA_SPEECH_RATE, 1f).coerceIn(0.7f, 1.3f)
    speechPitch = intent.getFloatExtra(EXTRA_PITCH, 1f).coerceIn(0.8f, 1.3f)
    preferredVoiceId = intent.getStringExtra(EXTRA_VOICE_ID).orEmpty()
    cues = parseCueSchedule(intent.getStringExtra(EXTRA_CUE_SCHEDULE).orEmpty())
    nextCueIndex = 0
    elapsedBeforeRunMillis = 0L
    activeRunStartedAt = SystemClock.elapsedRealtime()
    completed = false
    startedAtEpochMillis = System.currentTimeMillis()
    completedAtEpochMillis = 0L
    running = true
    pausedByAudioFocus = false

    requestAudioFocus()
    selectBestInstalledKoreanVoice()
    textToSpeech?.setSpeechRate(speechRate)
    textToSpeech?.setPitch(speechPitch)
    textToSpeech?.playSilentUtterance(150L, TextToSpeech.QUEUE_FLUSH, "runningbom-prime")
    persistState("running", 0)
    updateMediaSession(0)
    startForeground(NOTIFICATION_ID, buildNotification("진행 중"))
    handler.removeCallbacks(ticker)
    handler.post(ticker)
  }

  private fun pauseInternal(reason: String) {
    if (!running || completed) return
    elapsedBeforeRunMillis += SystemClock.elapsedRealtime() - activeRunStartedAt
    running = false
    handler.removeCallbacks(ticker)
    textToSpeech?.stop()
    val elapsed = elapsedSeconds()
    persistState("paused", elapsed)
    updateMediaSession(elapsed)
    startForeground(NOTIFICATION_ID, buildNotification(reason))
  }

  private fun resumeInternal() {
    if (running || completed || durationSeconds <= 0) return
    activeRunStartedAt = SystemClock.elapsedRealtime()
    running = true
    requestAudioFocus()
    val elapsed = elapsedSeconds()
    persistState("running", elapsed)
    updateMediaSession(elapsed)
    startForeground(NOTIFICATION_ID, buildNotification("진행 중"))
    handler.removeCallbacks(ticker)
    handler.post(ticker)
  }

  private fun stopSession() {
    if (running) {
      elapsedBeforeRunMillis += SystemClock.elapsedRealtime() - activeRunStartedAt
    }
    running = false
    completed = false
    handler.removeCallbacks(ticker)
    textToSpeech?.stop()
    persistState("stopped", elapsedSeconds())
    updateMediaSession(elapsedSeconds())
    abandonAudioFocus()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun elapsedSeconds(): Int {
    val activeMillis = if (running) {
      SystemClock.elapsedRealtime() - activeRunStartedAt
    } else {
      0L
    }
    return ((elapsedBeforeRunMillis + activeMillis) / 1_000.0).roundToInt()
      .coerceIn(0, durationSeconds)
  }

  private fun deliverDueCue(elapsed: Int) {
    if (!textToSpeechReady || nextCueIndex >= cues.size) return
    var chosen: CoachCue? = null
    while (nextCueIndex < cues.size && cues[nextCueIndex].offsetSeconds <= elapsed) {
      chosen = cues[nextCueIndex]
      nextCueIndex += 1
    }
    chosen ?: return
    textToSpeech?.speak(
      chosen.text,
      TextToSpeech.QUEUE_FLUSH,
      null,
      "runningbom-cue-${chosen.offsetSeconds}",
    )
  }

  private fun parseCueSchedule(value: String): List<CoachCue> {
    return value.lineSequence().mapNotNull { line ->
      val separator = line.indexOf('|')
      if (separator <= 0) return@mapNotNull null
      val offset = line.substring(0, separator).toIntOrNull() ?: return@mapNotNull null
      val text = line.substring(separator + 1).trim()
      if (text.isEmpty()) null else CoachCue(offset.coerceAtLeast(0), text)
    }.sortedBy { it.offsetSeconds }.toList()
  }

  override fun onInit(status: Int) {
    if (status != TextToSpeech.SUCCESS) {
      textToSpeechReady = false
      return
    }
    val result = textToSpeech?.setLanguage(Locale.KOREAN) ?: TextToSpeech.LANG_NOT_SUPPORTED
    textToSpeechReady = result != TextToSpeech.LANG_MISSING_DATA &&
      result != TextToSpeech.LANG_NOT_SUPPORTED
    selectBestInstalledKoreanVoice()
    textToSpeech?.setSpeechRate(speechRate)
    textToSpeech?.setPitch(speechPitch)
    textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String?) {
        persistCheckpoint(utteranceId, "speaking")
      }
      override fun onDone(utteranceId: String?) {
        persistCheckpoint(utteranceId, "done")
      }
      @Deprecated("Deprecated in Java")
      override fun onError(utteranceId: String?) {
        persistCheckpoint(utteranceId, "error")
      }
      override fun onError(utteranceId: String?, errorCode: Int) {
        persistCheckpoint(utteranceId, "error:$errorCode")
      }
    })
  }

  private fun selectBestInstalledKoreanVoice() {
    val engine = textToSpeech ?: return
    val korean = engine.voices
      ?.filter { voice -> voice.locale.language == Locale.KOREAN.language }
      ?: return
    if (korean.isEmpty()) return

    // JavaScript에서 고른 성별 음성이 실제로 설치되어 있으면 그것을 우선합니다.
    val requested = korean.firstOrNull { voice -> voice.name == preferredVoiceId }
    if (requested != null) {
      engine.voice = requested
      return
    }

    val candidate = korean
      .asSequence()
      .filter { voice -> !voice.isNetworkConnectionRequired }
      .sortedWith(
        compareByDescending<Voice> { voice -> voice.quality }
          .thenBy { voice -> voice.latency },
      )
      .firstOrNull() ?: korean.first()
    engine.voice = candidate
  }

  private fun requestAudioFocus() {
    if (Build.VERSION.SDK_INT >= 26) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        )
        .setOnAudioFocusChangeListener(audioFocusListener)
        .setAcceptsDelayedFocusGain(true)
        .build()
      audioFocusRequest = request
      audioManager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(
        audioFocusListener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN,
      )
    }
  }

  private fun abandonAudioFocus() {
    if (Build.VERSION.SDK_INT >= 26) {
      audioFocusRequest?.let(audioManager::abandonAudioFocusRequest)
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(audioFocusListener)
    }
  }

  private fun updateMediaSession(elapsed: Int) {
    val state = when {
      completed -> PlaybackState.STATE_STOPPED
      running -> PlaybackState.STATE_PLAYING
      else -> PlaybackState.STATE_PAUSED
    }
    val actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_STOP
    mediaSession.setPlaybackState(
      PlaybackState.Builder()
        .setActions(actions)
        .setState(state, elapsed * 1_000L, if (running) 1f else 0f)
        .build(),
    )
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent {
    return PendingIntent.getService(
      this,
      requestCode,
      Intent(this, RunningbomCoachService::class.java).apply { this.action = action },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun buildNotification(status: String): Notification {
    val pauseOrResume = if (running) ACTION_PAUSE else ACTION_RESUME
    val pauseOrResumeIcon = if (running) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    val pauseOrResumeLabel = if (running) "일시정지" else "계속"
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("$title · ${formatElapsed(elapsedSeconds())}")
      .setContentText(status)
      .setOnlyAlertOnce(true)
      .setOngoing(running)
      .setCategory(Notification.CATEGORY_TRANSPORT)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .addAction(pauseOrResumeIcon, pauseOrResumeLabel, actionIntent(pauseOrResume, 1))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "종료", actionIntent(ACTION_STOP, 2))
      .setStyle(
        Notification.MediaStyle()
          .setMediaSession(mediaSession.sessionToken)
          .setShowActionsInCompactView(0, 1),
      )
      .build()
  }

  private fun formatElapsed(seconds: Int): String {
    val minutes = seconds / 60
    val remainder = seconds % 60
    return "%02d:%02d".format(minutes, remainder)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "러닝 코칭 재생",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "화면이 잠겨도 선택한 러닝 코칭 시간을 이어갑니다."
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  private fun persistState(state: String, elapsed: Int) {
    getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString("state", state)
      .putString("sessionId", sessionId)
      .putString("definitionId", definitionId)
      .putString("title", title)
      .putString("countsAs", countsAs)
      .putInt("elapsedSeconds", elapsed)
      .putInt("durationSeconds", durationSeconds)
      .putLong("startedAtEpochMillis", startedAtEpochMillis)
      .putLong("completedAtEpochMillis", completedAtEpochMillis)
      .putLong("checkpointElapsedRealtime", SystemClock.elapsedRealtime())
      .apply()
  }

  private fun persistCheckpoint(utteranceId: String?, result: String) {
    getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString("lastUtteranceId", utteranceId)
      .putString("lastUtteranceResult", result)
      .putLong("lastUtteranceElapsedRealtime", SystemClock.elapsedRealtime())
      .apply()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    if (!running) stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (!completed && durationSeconds > 0) {
      if (running) {
        elapsedBeforeRunMillis += SystemClock.elapsedRealtime() - activeRunStartedAt
      }
      running = false
      persistState("stopped", elapsedSeconds())
    }
    try {
      unregisterReceiver(noisyReceiver)
    } catch (_: IllegalArgumentException) {
      // 이미 해제된 receiver는 무시합니다.
    }
    abandonAudioFocus()
    mediaSession.isActive = false
    mediaSession.release()
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    super.onDestroy()
  }
}
