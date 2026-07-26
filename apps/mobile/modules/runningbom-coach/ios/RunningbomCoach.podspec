Pod::Spec.new do |s|
  s.name           = 'RunningbomCoach'
  s.version        = '1.0.0'
  s.summary        = 'RunningBom on-device coaching bridge'
  s.description    = 'Provides the iOS bridge boundary for RunningBom local coaching fallbacks.'
  s.author         = 'ROBOM'
  s.homepage       = 'https://robom.kr'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/robom-labs/runningbom.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
