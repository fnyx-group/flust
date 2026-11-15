Pod::Spec.new do |s|
  s.name           = 'FlustClock'
  s.version        = '0.1.0'
  s.summary        = 'A clock that keeps running while the phone sleeps.'
  s.description    = 'A clock that keeps running while the phone sleeps and ignores the date and time settings.'
  s.license        = 'MPL-2.0'
  s.author         = 'flust'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
