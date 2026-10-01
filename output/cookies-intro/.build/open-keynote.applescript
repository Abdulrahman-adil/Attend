with timeout of 120 seconds
 tell application "Keynote"
  set docRef to open POSIX file "/Users/abdoadel/Porgraming/Projects/Attend/output/cookies-intro/files/Cookies-Intro.pptx"
  tell docRef
   set oldW to width
   set oldH to height
   set oldGroupW to width of group 1 of slide 1
   set width to 1920
   set height to 1080
   set newGroupW to width of group 1 of slide 1
   save in POSIX file "/Users/abdoadel/Porgraming/Projects/Attend/output/cookies-intro/.build/review.key"
   return {id, oldW, oldH, oldGroupW, newGroupW, count of slides}
  end tell
 end tell
end timeout
