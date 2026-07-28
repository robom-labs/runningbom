// JavaScript와 iOS 네이티브 코치·메트로놈 런타임을 연결합니다.
import ExpoModulesCore

public class RunningbomCoachModule: Module {
  private let coach = RunningbomCoachRuntime()
  private let metronome = RunningbomMetronomeRuntime()

  public func definition() -> ModuleDefinition {
    Name("RunningbomCoach")

    Function("isAvailable") {
      true
    }

    AsyncFunction("startSession") {
      (
        sessionId: String,
        definitionId: String,
        title: String,
        countsAs: String,
        durationSeconds: Int,
        cueSchedule: String,
        voice: [String: Any]
      ) in
      self.coach.start(
        sessionId: sessionId,
        definitionId: definitionId,
        title: title,
        countsAs: countsAs,
        durationSeconds: durationSeconds,
        cueSchedule: cueSchedule,
        rate: (voice["rate"] as? NSNumber)?.doubleValue ?? 1,
        voiceIdentifier: voice["voiceId"] as? String ?? "",
        pitch: (voice["pitch"] as? NSNumber)?.doubleValue ?? 1,
        openEnded: voice["openEnded"] as? Bool ?? false
      )
    }

    AsyncFunction("pauseSession") {
      self.coach.pause()
    }

    AsyncFunction("resumeSession") {
      self.coach.resume()
    }

    AsyncFunction("stopSession") {
      self.coach.stop()
    }

    AsyncFunction("getState") {
      self.coach.snapshot()
    }

    AsyncFunction("startMetronome") { (cadence: Int) in
      try self.metronome.start(cadence: cadence)
    }

    AsyncFunction("stopMetronome") {
      self.metronome.stop()
    }

    AsyncFunction("getMetronomeState") {
      self.metronome.snapshot()
    }
  }
}
