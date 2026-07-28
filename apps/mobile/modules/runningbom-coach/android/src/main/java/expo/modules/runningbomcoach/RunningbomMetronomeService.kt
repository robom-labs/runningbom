// 화면이 잠겨도 AudioTrack의 오디오 시계로 박자를 유지하는 러닝 메트로놈 서비스입니다.
package expo.modules.runningbomcoach

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.sin

class RunningbomMetronomeService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.runningbomcoach.METRONOME_START"
    const val ACTION_STOP = "expo.modules.runningbomcoach.METRONOME_STOP"
    const val EXTRA_CADENCE = "cadence"
    const val PREFERENCES = "runningbom-metronome-state"

    private const val CHANNEL_ID = "runningbom-metronome"
    private const val NOTIFICATION_ID = 7302
    private const val SAMPLE_RATE = 44_100
    private const val CLICK_MILLIS = 12
  }

  private val writer = Executors.newSingleThreadExecutor()
  @Volatile private var playing = false
  @Volatile private var cadence = 170
  @Volatile private var clockGeneration = 0L
  private var audioTrack: AudioTrack? = null
  private var beatCount = 0L
  private var startedAtEpochMillis = 0L
  private var restoredDelaySamples = 0
  private var underrunCount = 0

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> startOrUpdate(intent.getIntExtra(EXTRA_CADENCE, 170))
      ACTION_STOP -> stopMetronome()
      null -> restoreIfNeeded()
    }
    return START_STICKY
  }

  private fun startOrUpdate(
    requestedCadence: Int,
    restoredBeatCount: Long? = null,
    restoredStartedAtEpochMillis: Long? = null,
  ) {
    val nextCadence = requestedCadence.coerceIn(40, 240)
    if (playing && cadence == nextCadence) {
      persistState()
      startForeground(NOTIFICATION_ID, buildNotification())
      return
    }
    if (playing) {
      clockGeneration += 1
      audioTrack?.pause()
    }

    cadence = nextCadence
    playing = true
    val generation = clockGeneration + 1
    clockGeneration = generation
    if (restoredBeatCount != null && restoredStartedAtEpochMillis != null) {
      startedAtEpochMillis = restoredStartedAtEpochMillis
      val elapsedMillis = (System.currentTimeMillis() - startedAtEpochMillis).coerceAtLeast(0L)
      val intervalMillis = 60_000.0 / cadence
      val elapsedBeats = elapsedMillis / intervalMillis
      val completedBeats = kotlin.math.floor(elapsedBeats).toLong()
      beatCount = maxOf(restoredBeatCount, completedBeats)
      val fraction = elapsedBeats - kotlin.math.floor(elapsedBeats)
      val samplesPerBeat = ((SAMPLE_RATE * 60.0) / cadence).toInt().coerceAtLeast(1)
      restoredDelaySamples = if (fraction < 0.000_001) {
        0
      } else {
        ((1.0 - fraction) * samplesPerBeat).toInt().coerceIn(1, samplesPerBeat)
      }
    } else {
      beatCount = 0L
      startedAtEpochMillis = System.currentTimeMillis()
      restoredDelaySamples = 0
    }
    underrunCount = 0
    persistState()
    startForeground(NOTIFICATION_ID, buildNotification())
    writer.execute { runAudioClock(generation) }
  }

  /**
   * 박자 사이의 무음을 포함한 PCM 한 블록을 AudioTrack에 씁니다.
   * write()가 오디오 장치의 재생 속도로 막히므로 JS timer나 화면 렌더 주기가 박자의 기준이 되지 않습니다.
   */
  private fun runAudioClock(generation: Long) {
    val minBuffer = AudioTrack.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_OUT_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    ).coerceAtLeast(SAMPLE_RATE / 2)
    val track = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setSampleRate(SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .build(),
      )
      .setTransferMode(AudioTrack.MODE_STREAM)
      .setBufferSizeInBytes(minBuffer)
      .build()
    audioTrack = track

    try {
      track.play()
      if (restoredDelaySamples > 0) {
        val silence = ShortArray(restoredDelaySamples)
        track.write(silence, 0, silence.size, AudioTrack.WRITE_BLOCKING)
        restoredDelaySamples = 0
      }
      val beatCache = mutableMapOf<Int, ShortArray>()
      while (playing && generation == clockGeneration) {
        val currentCadence = cadence
        // 소수 프레임을 매 박자 버리지 않고 누적 경계에서 계산해 6시간 뒤에도 위상이 밀리지 않게 합니다.
        val framesPerBeat = (SAMPLE_RATE * 60.0) / currentCadence
        val samplesAtStart = floor(beatCount * framesPerBeat).toLong()
        val samplesAtEnd = floor((beatCount + 1) * framesPerBeat).toLong()
        val samplesPerBeat = (samplesAtEnd - samplesAtStart).toInt().coerceAtLeast(1)
        // 소수 프레임 보정으로 생기는 두 길이의 PCM 블록을 재사용해 장시간 GC 압력을 막습니다.
        val beat = beatCache.getOrPut(samplesPerBeat) { buildBeat(samplesPerBeat) }

        var written = 0
        while (playing && generation == clockGeneration && written < beat.size) {
          val count = track.write(beat, written, beat.size - written, AudioTrack.WRITE_BLOCKING)
          if (count <= 0) {
            playing = false
            break
          }
          written += count
        }
        if (written == beat.size) {
          beatCount += 1
          underrunCount = track.underrunCount
          if (beatCount % 16L == 0L) persistState()
        }
      }
    } finally {
      try {
        track.pause()
        track.flush()
        track.stop()
      } catch (_: IllegalStateException) {
        // 이미 오디오 장치가 종료된 경우에도 서비스 정리는 계속합니다.
      }
      track.release()
      if (audioTrack === track) audioTrack = null
    }
  }

  private fun buildBeat(samplesPerBeat: Int): ShortArray {
    val clickSamples = (SAMPLE_RATE * CLICK_MILLIS / 1_000).coerceAtMost(samplesPerBeat)
    return ShortArray(samplesPerBeat).also { beat ->
      for (index in 0 until clickSamples) {
        val envelope = 1.0 - (index.toDouble() / clickSamples.coerceAtLeast(1))
        val wave = sin(2.0 * PI * 1_250.0 * index / SAMPLE_RATE)
        beat[index] = (Short.MAX_VALUE * 0.24 * envelope * wave).toInt().toShort()
      }
    }
  }

  private fun restoreIfNeeded() {
    val preferences = getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    if (!preferences.getBoolean("playing", false)) {
      stopSelf()
      return
    }
    startOrUpdate(
      preferences.getInt("cadence", 170),
      preferences.getLong("beatCount", 0L),
      preferences.getLong("startedAtEpochMillis", System.currentTimeMillis()),
    )
  }

  private fun stopMetronome() {
    playing = false
    clockGeneration += 1
    audioTrack?.pause()
    persistState()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun persistState() {
    getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("playing", playing)
      .putInt("cadence", cadence)
      .putLong("beatCount", beatCount)
      .putLong("startedAtEpochMillis", startedAtEpochMillis)
      .putInt("underrunCount", underrunCount)
      .apply()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "러닝봄 박자 맞추기",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "화면이 잠겨도 러닝 박자를 이어 갑니다."
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  private fun buildNotification(): Notification {
    val stopIntent = PendingIntent.getService(
      this,
      0,
      Intent(this, RunningbomMetronomeService::class.java).apply { action = ACTION_STOP },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("러닝봄 박자 맞추기")
      .setContentText("분당 ${cadence}보 · 화면이 잠겨도 이어져요")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .addAction(android.R.drawable.ic_media_pause, "멈추기", stopIntent)
      .build()
  }

  override fun onDestroy() {
    playing = false
    clockGeneration += 1
    audioTrack?.pause()
    persistState()
    writer.shutdownNow()
    super.onDestroy()
  }
}
