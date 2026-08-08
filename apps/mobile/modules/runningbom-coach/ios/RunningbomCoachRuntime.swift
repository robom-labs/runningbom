// 화면이 잠겨도 단조 시계와 기기 한국어 TTS로 코칭 순서를 유지합니다.
import AVFoundation
import Foundation

private struct RunningbomCoachCue {
  let offsetSeconds: Int
  let text: String
}

final class RunningbomCoachRuntime: NSObject, AVSpeechSynthesizerDelegate {
  private let queue = DispatchQueue(label: "kr.robom.runningbom.coach")
  private let synthesizer = AVSpeechSynthesizer()
  private let backgroundEngine = AVAudioEngine()
  private let backgroundPlayer = AVAudioPlayerNode()
  private var timer: DispatchSourceTimer?
  private var cues = [RunningbomCoachCue]()
  private var nextCueIndex = 0
  private var sessionId: String?
  private var definitionId: String?
  private var title: String?
  private var countsAs: String?
  private var durationSeconds = 0
  private var openEnded = false
  private var state = "idle"
  private var startedAtEpochMillis: Int64 = 0
  private var completedAtEpochMillis: Int64 = 0
  private var activeStartedAtUptime = 0.0
  private var elapsedBeforeRun = 0.0
  private var speechRate = 1.0
  private var speechPitch = 1.0
  private var voiceIdentifier = ""
  private var resumeAfterInterruption = false
  private var lastPersistedSecond = -1
  private let preferences = UserDefaults.standard

  override init() {
    super.init()
    synthesizer.delegate = self
    backgroundEngine.attach(backgroundPlayer)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    timer?.cancel()
  }

  func start(
    sessionId: String,
    definitionId: String,
    title: String,
    countsAs: String,
    durationSeconds: Int,
    cueSchedule: String,
    rate: Double,
    voiceIdentifier: String,
    pitch: Double,
    openEnded: Bool
  ) {
    queue.sync {
      self.synthesizer.stopSpeaking(at: .immediate)
      self.sessionId = sessionId
      self.definitionId = definitionId
      self.title = title
      self.countsAs = ["run", "walk", "recovery"].contains(countsAs) ? countsAs : "run"
      self.durationSeconds = max(1, durationSeconds)
      self.openEnded = openEnded
      self.cues = parseCueSchedule(cueSchedule)
      self.nextCueIndex = 0
      self.startedAtEpochMillis = Int64(Date().timeIntervalSince1970 * 1_000)
      self.completedAtEpochMillis = 0
      self.activeStartedAtUptime = ProcessInfo.processInfo.systemUptime
      self.elapsedBeforeRun = 0
      self.speechRate = min(1.3, max(0.7, rate))
      self.speechPitch = min(1.3, max(0.8, pitch))
      self.voiceIdentifier = voiceIdentifier
      self.state = "running"
      self.lastPersistedSecond = -1
      try? startBackgroundClock()
      persist()
      startTicker()
    }
  }

  func pause() {
    queue.sync {
      guard state == "running" else { return }
      elapsedBeforeRun = elapsedSeconds()
      state = "paused"
      synthesizer.stopSpeaking(at: .immediate)
      stopBackgroundClock()
      RunningbomAudioSession.shared.deactivate(.coachSpeech)
      persist()
    }
  }

  func resume() {
    queue.sync {
      guard state == "paused" else { return }
      activeStartedAtUptime = ProcessInfo.processInfo.systemUptime
      state = "running"
      try? startBackgroundClock()
      persist()
      startTicker()
    }
  }

  func stop() {
    queue.sync {
      if state == "running" {
        elapsedBeforeRun = elapsedSeconds()
      }
      state = "stopped"
      timer?.cancel()
      timer = nil
      synthesizer.stopSpeaking(at: .immediate)
      stopBackgroundClock()
      RunningbomAudioSession.shared.deactivate(.coachSpeech)
      persist()
    }
  }

  func snapshot() -> [String: Any] {
    queue.sync {
      [
        "state": state,
        "sessionId": sessionId ?? NSNull(),
        "definitionId": definitionId ?? NSNull(),
        "title": title ?? NSNull(),
        "countsAs": countsAs ?? NSNull(),
        "elapsedSeconds": Int(elapsedSeconds().rounded()),
        "durationSeconds": durationSeconds,
        "openEnded": openEnded,
        "startedAtEpochMillis": startedAtEpochMillis,
        "completedAtEpochMillis": completedAtEpochMillis,
      ]
    }
  }

  private func startTicker() {
    timer?.cancel()
    let ticker = DispatchSource.makeTimerSource(queue: queue)
    ticker.schedule(deadline: .now(), repeating: .milliseconds(200), leeway: .milliseconds(40))
    ticker.setEventHandler { [weak self] in self?.tick() }
    timer = ticker
    ticker.resume()
  }

  private func tick() {
    guard state == "running" else { return }
    let elapsed = elapsedSeconds()
    if !openEnded && elapsed >= Double(durationSeconds) {
      state = "completed"
      completedAtEpochMillis = Int64(Date().timeIntervalSince1970 * 1_000)
      timer?.cancel()
      timer = nil
      stopBackgroundClock()
      persist()
      return
    }

    guard !synthesizer.isSpeaking, nextCueIndex < cues.count else { return }
    let cue = cues[nextCueIndex]
    guard Double(cue.offsetSeconds) <= elapsed else {
      let elapsedSecond = Int(elapsed)
      if elapsedSecond % 5 == 0 && elapsedSecond != lastPersistedSecond {
        lastPersistedSecond = elapsedSecond
        persist()
      }
      return
    }

    do {
      try RunningbomAudioSession.shared.activate(.coachSpeech)
    } catch {
      return
    }

    nextCueIndex += 1
    let utterance = AVSpeechUtterance(string: cue.text)
    utterance.voice = selectedVoice()
    utterance.rate = Float(min(0.62, max(0.35, 0.5 * speechRate)))
    utterance.pitchMultiplier = Float(speechPitch)
    synthesizer.speak(utterance)
    persist()
  }

  private func selectedVoice() -> AVSpeechSynthesisVoice? {
    if !voiceIdentifier.isEmpty,
       let selected = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
      return selected
    }
    return AVSpeechSynthesisVoice(language: "ko-KR")
  }

  /**
   * iOS가 화면 잠금 중에도 네이티브 단조 시계와 TTS 큐를 유지하도록 무음 PCM을 재생합니다.
   * JavaScript 타이머는 코칭 시각의 정본이 아니며, 실제 기기 정책·배터리 검증은 별도로 수행합니다.
   */
  private func startBackgroundClock() throws {
    if backgroundEngine.isRunning { return }
    try RunningbomAudioSession.shared.activate(.coachSession)
    let output = backgroundEngine.outputNode.outputFormat(forBus: 0)
    let sampleRate = max(8_000, output.sampleRate)
    guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
          let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(sampleRate)
          ), let samples = buffer.floatChannelData?[0] else {
      throw NSError(domain: "RunningbomCoach", code: 1)
    }
    buffer.frameLength = buffer.frameCapacity
    samples.initialize(repeating: 0, count: Int(buffer.frameLength))
    backgroundEngine.connect(backgroundPlayer, to: backgroundEngine.mainMixerNode, format: format)
    backgroundEngine.prepare()
    try backgroundEngine.start()
    backgroundPlayer.scheduleBuffer(buffer, at: nil, options: [.loops])
    backgroundPlayer.play()
  }

  private func stopBackgroundClock() {
    backgroundPlayer.stop()
    backgroundEngine.stop()
    backgroundEngine.disconnectNodeOutput(backgroundPlayer)
    RunningbomAudioSession.shared.deactivate(.coachSession)
  }

  private func elapsedSeconds() -> Double {
    let active = state == "running"
      ? max(0, ProcessInfo.processInfo.systemUptime - activeStartedAtUptime)
      : 0
    let elapsed = max(0, elapsedBeforeRun + active)
    return openEnded ? elapsed : min(elapsed, Double(durationSeconds))
  }

  private func parseCueSchedule(_ raw: String) -> [RunningbomCoachCue] {
    raw.split(separator: "\n").compactMap { line in
      let parts = line.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
      guard parts.count == 2, let offset = Int(parts[0]), !parts[1].isEmpty else { return nil }
      return RunningbomCoachCue(offsetSeconds: max(0, offset), text: String(parts[1]))
    }.sorted { $0.offsetSeconds < $1.offsetSeconds }
  }

  private func persist() {
    preferences.set(state, forKey: "runningbom.coach.state")
    preferences.set(sessionId, forKey: "runningbom.coach.sessionId")
    preferences.set(Int(elapsedSeconds().rounded()), forKey: "runningbom.coach.elapsedSeconds")
    preferences.set(durationSeconds, forKey: "runningbom.coach.durationSeconds")
    preferences.set(openEnded, forKey: "runningbom.coach.openEnded")
    preferences.set(startedAtEpochMillis, forKey: "runningbom.coach.startedAtEpochMillis")
    preferences.set(completedAtEpochMillis, forKey: "runningbom.coach.completedAtEpochMillis")
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didFinish utterance: AVSpeechUtterance
  ) {
    RunningbomAudioSession.shared.deactivate(.coachSpeech)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didCancel utterance: AVSpeechUtterance
  ) {
    RunningbomAudioSession.shared.deactivate(.coachSpeech)
  }

  @objc private func handleInterruption(_ notification: Notification) {
    guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
    if type == .began {
      queue.async { [weak self] in
        guard let self else { return }
        self.resumeAfterInterruption = self.state == "running"
        guard self.state == "running" else { return }
        self.elapsedBeforeRun = self.elapsedSeconds()
        self.state = "paused"
        self.synthesizer.stopSpeaking(at: .immediate)
        self.stopBackgroundClock()
        RunningbomAudioSession.shared.deactivate(.coachSpeech)
        self.persist()
      }
      return
    }

    let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
    let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
    queue.async { [weak self] in
      guard let self, options.contains(.shouldResume), self.resumeAfterInterruption else { return }
      self.resumeAfterInterruption = false
      guard self.state == "paused" else { return }
      self.activeStartedAtUptime = ProcessInfo.processInfo.systemUptime
      self.state = "running"
      try? self.startBackgroundClock()
      self.persist()
      self.startTicker()
    }
  }

  @objc private func handleRouteChange(_ notification: Notification) {
    guard let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          AVAudioSession.RouteChangeReason(rawValue: rawReason) == .oldDeviceUnavailable else {
      return
    }
    queue.async { [weak self] in
      guard let self, self.state == "running" else { return }
      self.elapsedBeforeRun = self.elapsedSeconds()
      self.state = "paused"
      self.synthesizer.stopSpeaking(at: .immediate)
      self.stopBackgroundClock()
      RunningbomAudioSession.shared.deactivate(.coachSpeech)
      self.persist()
    }
  }
}
