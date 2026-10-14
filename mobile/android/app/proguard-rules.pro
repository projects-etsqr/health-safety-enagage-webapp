# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# react-native-vector-icons resolves font glyphs by class/method name at runtime.
-keep class com.oblador.vectoricons.** { *; }

# react-native-svg and react-native-video ship native view managers looked up
# by reflection from the RN bridge; keep them intact under R8.
-keep class com.horcrux.svg.** { *; }
-keep class com.brentvatne.exoplayer.** { *; }

# Geolocation callbacks are invoked via reflection from native code.
-keep class com.reactnativecommunity.geolocation.** { *; }
