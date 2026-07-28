// 코치 발화와 메트로놈이 하나의 iOS 오디오 세션을 안전하게 공유하도록 조정합니다.
import AVFoundation

final class RunningbomAudioSession {
  static let shared = RunningbomAudioSession()

  enum Owner: Hashable {
    case coachSession
    case coachSpeech
    case metronome
  }

  private let lock = NSLock()
  private var owners = Set<Owner>()

  private init() {}

  func activate(_ owner: Owner) throws {
    lock.lock()
    owners.insert(owner)
    let hasCoachSpeech = owners.contains(.coachSpeech)
    lock.unlock()

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playback,
      mode: hasCoachSpeech ? .spokenAudio : .default,
      options: [.mixWithOthers, .duckOthers, .allowBluetoothA2DP]
    )
    try session.setActive(true)
  }

  func deactivate(_ owner: Owner) {
    lock.lock()
    owners.remove(owner)
    let hasOwners = !owners.isEmpty
    let hasCoachSpeech = owners.contains(.coachSpeech)
    lock.unlock()

    let session = AVAudioSession.sharedInstance()
    if hasOwners {
      try? session.setCategory(
        .playback,
        mode: hasCoachSpeech ? .spokenAudio : .default,
        options: [.mixWithOthers, .duckOthers, .allowBluetoothA2DP]
      )
    } else {
      try? session.setActive(false, options: [.notifyOthersOnDeactivation])
    }
  }
}
