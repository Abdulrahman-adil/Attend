with timeout of 240 seconds
 tell application "Keynote"
  set docRef to document "review.key"
  export docRef to POSIX file "/Users/abdoadel/Porgraming/Projects/Attend/output/cookies-intro/.build/native-renders" as slide images with properties {image format:PNG, all stages:false}
  export docRef to POSIX file "/Users/abdoadel/Porgraming/Projects/Attend/output/cookies-intro/.build/native-roundtrip.pptx" as Microsoft PowerPoint
  return {width of docRef, height of docRef, count of slides of docRef}
 end tell
end timeout
