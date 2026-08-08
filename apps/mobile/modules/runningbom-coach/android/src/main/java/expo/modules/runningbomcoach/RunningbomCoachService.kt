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
    const val EXTRA_OPEN_ENDED = "openEnded"

    const val PREFERENCES = "runningbom-coach-state"
    private const val CHANNEL_ID = "runningbom-coach"
    private const val NOTIFICATION_ID = 7301
    private const val TICK_MILLIS = 500L

    /** 한 번의 틱에서 실제로 읽어 줄 최대 대사 수입니다(JS 쪽 MAX_SPOKEN_CUES_PER_TICK과 같은 값). */
    private const val MAX_SPOKEN_PER_TICK = 2
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var audioManager: AudioManager
  private lateinit var mediaSession: MediaSession
  private var textToSpeech: TextToSpeech? = null
  private var textToSpeechReady = false
  private var audioFocusRequest: AudioFocusRequest? = null
  private var speechFocusHeld = false

  private var sessionId = ""
  private var definitionId = ""
  private var title = "러닝 코칭"
  private var countsAs = "run"
  private var durationSeconds = 0
  private var openEnded = false
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

      if (!openEnded && elapsed >= durationSeconds) {
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
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
          pausedByAudioFocus = false
          abandonAudioFocus()
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
    openEnded = intent.getBooleanExtra(EXTRA_OPEN_ENDED, false)
    speechRate = intent.getFloatExtra(EXTRA_SPEECH_RATE, 1f).coerceIn(0.7f, 1.3f)
    speechPitch = intent.getFloatExtra(EXTRA_PITCH, 1f).coerceIn(0.8f, 1.3f)
    preferredVoiceId = intent.getStringExtra(EXTRA_VOICE_ID).orEmpty()
    cues = parseCueSchedule(intent.getStringExtra(EXTRA_CUE_SCHEDULE).orEmpty())
    textToSpeech?.stop()
    nextCueIndex = 0
    elapsedBeforeRunMillis = 0L
    activeRunStartedAt = SystemClock.elapsedRealtime()
    completed = false
    startedAtEpochMillis = System.currentTimeMillis()
    completedAtEpochMillis = 0L
    running = true
    pausedByAudioFocus = false

    selectBestInstalledKoreanVoice()
    textToSpeech?.setSpeechRate(speechRate)
    textToSpeech?.setPitch(speechPitch)
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
    if (!pausedByAudioFocus) abandonAudioFocus()
    val elapsed = elapsedSeconds()
    persistState("paused", elapsed)
    updateMediaSession(elapsed)
    startForeground(NOTIFICATION_ID, buildNotification(reason))
  }

  private fun resumeInternal() {
    if (running || completed || durationSeconds <= 0) return
    activeRunStartedAt = SystemClock.elapsedRealtime()
    running = true
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
    val elapsed = ((elapsedBeforeRunMillis + activeMillis) / 1_000.0).roundToInt()
      .coerceAtLeast(0)
    return if (openEnded) elapsed else elapsed.coerceAtMost(durationSeconds)
  }

  /**
   * 지금 시각까지 도달한 대사를 읽습니다.
   *
   * 예전에는 밀린 대사 중 **마지막 하나만** 읽고 나머지를 버렸습니다.
   * 그래서 같은 순간에 놓인 대사가 여러 개면 한 마디만 들렸습니다.
   * (실제로 회차 시작 0초에 세 마디를 놨더니 한 마디만 들린다는 신고가 있었습니다.)
   *
   * 이제 밀린 것을 최대 MAX_SPOKEN_PER_TICK개까지 순서대로 읽습니다.
   * 전부 읽지 않는 이유는, 화면이 오래 꺼져 있다가 깨어났을 때
   * 지난 이야기를 몇 십 초씩 늘어놓게 되기 때문입니다.
   * 읽지 않고 건너뛴 대사도 자리는 끝까지 넘겨, 지난 대사가 되살아나지 않게 합니다.
   */
  private fun deliverDueCue(elapsed: Int) {
    if (!textToSpeechReady || nextCueIndex >= cues.size) return
    val due = mutableListOf<CoachCue>()
    var candidateIndex = nextCueIndex
    while (candidateIndex < cues.size && cues[candidateIndex].offsetSeconds <= elapsed) {
      due.add(cues[candidateIndex])
      candidateIndex += 1
    }
    if (due.isEmpty()) return

    val spoken = if (due.size <= MAX_SPOKEN_PER_TICK) due else due.takeLast(MAX_SPOKEN_PER_TICK)
    // 다른 음악을 러닝 내내 독점하지 않습니다. 실제로 말하기 직전에만 짧게 요청합니다.
    // 포커스를 받지 못했으면 큐 인덱스를 넘기지 않고 다음 틱에 다시 시도합니다.
    if (!requestSpeechAudioFocus()) return
    nextCueIndex = candidateIndex
    spoken.forEach { cue ->
      // 이미 말하고 있는 문장을 새 안내가 끊지 않도록 모두 뒤에 붙입니다.
      textToSpeech?.speak(
        cue.text,
        TextToSpeech.QUEUE_ADD,
        null,
        "runningbom-cue-${cue.offsetSeconds}",
      )
    }
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
        releaseSpeechFocusWhenIdle()
      }
      @Deprecated("Deprecated in Java")
      override fun onError(utteranceId: String?) {
        persistCheckpoint(utteranceId, "error")
        releaseSpeechFocusWhenIdle()
      }
      override fun onError(utteranceId: String?, errorCode: Int) {
        persistCheckpoint(utteranceId, "error:$errorCode")
        releaseSpeechFocusWhenIdle()
      }
      override fun onStop(utteranceId: String?, interrupted: Boolean) {
        persistCheckpoint(utteranceId, if (interrupted) "stopped:interrupted" else "stopped")
        releaseSpeechFocusWhenIdle()
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

  /**
   * 한 문장을 읽는 동안에만 오디오 포커스를 빌립니다.
   *
   * 세션 전체에 AUDIOFOCUS_GAIN을 잡으면 음악·팟캐스트가 러닝 내내 멈춥니다.
   * 코치 발화는 짧은 안내이므로 MAY_DUCK이 맞고, 지연 승인을 기다리며 오래된 문장을
   * 뒤늦게 읽지 않도록 즉시 승인된 경우에만 큐를 진행합니다.
   */
  private fun requestSpeechAudioFocus(): Boolean {
    if (speechFocusHeld) return true
    if (Build.VERSION.SDK_INT >= 26) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        )
        .setOnAudioFocusChangeListener(audioFocusListener)
        .setAcceptsDelayedFocusGain(false)
        .build()
      audioFocusRequest = request
      speechFocusHeld = audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    } else {
      @Suppress("DEPRECATION")
      speechFocusHeld = audioManager.requestAudioFocus(
        audioFocusListener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK,
      ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    return speechFocusHeld
  }

  private fun releaseSpeechFocusWhenIdle() {
    handler.postDelayed({
      if (textToSpeech?.isSpeaking != true && !pausedByAudioFocus) {
        abandonAudioFocus()
      }
    }, 80L)
  }

  private fun abandonAudioFocus() {
    if (!speechFocusHeld && audioFocusRequest == null) return
    if (Build.VERSION.SDK_INT >= 26) {
      audioFocusRequest?.let(audioManager::abandonAudioFocusRequest)
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(audioFocusListener)
    }
    speechFocusHeld = false
    audioFocusRequest = null
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
      .putBoolean("openEnded", openEnded)
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
