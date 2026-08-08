// AVAudioEngine의 반복 PCM 버퍼로 화면과 JavaScript 타이머에 독립적인 박자를 냅니다.
import AVFoundation
import Foundation

final class RunningbomMetronomeRuntime {
  private let queue = DispatchQueue(label: "kr.robom.runningbom.metronome")
  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private var playing = false
  private var cadence = 170
  private var startedAtEpochMillis: Int64 = 0
  private var startedAtUptime = 0.0
  private var beatCountBeforeStart: Int64 = 0
  private var underrunCount = 0

  init() {
    engine.attach(player)
  }

  func start(cadence: Int) throws {
    try queue.sync {
      let requested = min(240, max(40, cadence))
      if playing && self.cadence == requested { return }
      if playing { stopInternal() }

      self.cadence = requested
      self.startedAtEpochMillis = Int64(Date().timeIntervalSince1970 * 1_000)
      self.startedAtUptime = ProcessInfo.processInfo.systemUptime
      self.beatCountBeforeStart = 0
      self.underrunCount = 0

      let format = engine.outputNode.outputFormat(forBus: 0)
      let sampleRate = max(8_000, format.sampleRate)
      // 정확히 1분인 PCM을 반복하면 정수 BPM은 몇 시간이 지나도 분 경계에서 다시 위상이 맞습니다.
      let cycleFrames = max(1, Int(sampleRate * 60))
      guard let buffer = AVAudioPCMBuffer(
        pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!,
        frameCapacity: AVAudioFrameCount(cycleFrames)
      ), let samples = buffer.floatChannelData?[0] else {
        throw NSError(domain: "RunningbomMetronome", code: 1)
      }

      buffer.frameLength = AVAudioFrameCount(cycleFrames)
      samples.initialize(repeating: 0, count: cycleFrames)
      let clickFrames = max(1, Int(sampleRate * 0.012))
      for beat in 0..<requested {
        let beatStart = Int(floor(Double(beat) * sampleRate * 60 / Double(requested)))
        for frame in 0..<min(clickFrames, cycleFrames - beatStart) {
          let envelope = 1 - Float(frame) / Float(clickFrames)
          samples[beatStart + frame] =
            sin(Float(frame) * 2 * .pi * 1_250 / Float(sampleRate)) * 0.22 * envelope
        }
      }

      engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
      try RunningbomAudioSession.shared.activate(.metronome)
      engine.prepare()
      try engine.start()
      player.scheduleBuffer(buffer, at: nil, options: [.loops])
      player.play()
      playing = true
    }
  }

  func stop() {
    queue.sync { stopInternal() }
  }

  func snapshot() -> [String: Any] {
    queue.sync {
      [
        "playing": playing,
        "cadence": cadence,
        "beatCount": currentBeatCount(),
        "startedAtEpochMillis": startedAtEpochMillis,
        "underrunCount": underrunCount,
      ]
    }
  }

  private func currentBeatCount() -> Int64 {
    guard playing else { return beatCountBeforeStart }
    let elapsed = max(0, ProcessInfo.processInfo.systemUptime - startedAtUptime)
    return beatCountBeforeStart + Int64(floor(elapsed * Double(cadence) / 60))
  }

  private func stopInternal() {
    if playing {
      beatCountBeforeStart = currentBeatCount()
    }
    playing = false
    player.stop()
    engine.stop()
    engine.disconnectNodeOutput(player)
    RunningbomAudioSession.shared.deactivate(.metronome)
  }
}
