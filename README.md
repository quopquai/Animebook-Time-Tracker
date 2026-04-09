<img width="50" height="50" alt="9f55fb1c-5226-417c-b41d-7d5247deab44" src="https://github.com/user-attachments/assets/82deaee1-ac28-4227-bbf2-b139cac139a1" />

# ANIMEBOOK TIME TRACKER
I am slowly vibe coding this time tracking Chrome extension. It tracks your time watching local videos with the Animebook html video player initially, but now also works with asbplayer, and streaming sites such as YouTube, cijapanese, TVer, Disney+ and Amazon Prime.

## Who is this extension for?
This extension has been made with the language learner in mind who wants to keep track of their immersion time without having to make spreadsheets. But is not limited to just Japanese learners. The extension is flexible enough to track your time watching videos in any subject that you choose. If you wanted to track your time watching coding videos, or gardening videos then this extension can help you do that. You choose the subject matter that you want to track your time for.

## What kind of features does the extension include?
Features currently include a dark and a light mode, live updating times, a “Daily Goal” progress bar that you can set to however many minutes a day you would like to aim for (using the pencil icon), a “Level 1”, “Level 2” progess bar near the bottom of the popup (which is editable using the cogwheel), Weekly → Monthly → Yearly → All Time Charts to help keep track of your progress. There is also the ability to add a “Custom Activity” for activities that don’t include watching videos like reading or listening to a podcast or speaking or even taking a lesson (this feature was inspired by the cij website, so credit goes to @Bennycopter and his team).

## A level system to gamify your progress
I added a level system to help kind of gamify progress. I basically took the Dreaming Spanish Level system and times-ed it by 2 to get the Japanese Levels as follows:

Level 1 - Complete Beginner - (0~100 hours)

Level 2 - Beginner - (100~300 hours)

Level 3 - Lower Intermediate - (300~600 hours)

Level 4 - Upper Intermediate - (600~1200 hours)

Level 5 - Lower Advanced - (1200~2000 hours)

Level 6 - Upper Advanced - (2000~3000 hours)

These amounts will vary from person to person depending on how distant your target language is (and you may not even be learning Japanese). So, these times can easily be changed in the settings (via the cogwheel).

## An on/off switch (new to v4.2)
An on/off switch has been added in the popup so you can essentially get rid of the “Track” button that will keep appearing in the top left of each video on multi-language content sites. This is for those times when you are not actively immersing in your target language (or whatever subject). If the “Track” button that appears on videos becomes a bit distracting, and you are not really using it, you can simply just turn it off. This will essentially turn off time tracking altogether though, so you do need to remember to switch the tracker back on again when you want to continue your immersion.

## A history page
At the bottom of the popup there is a link to see the history page, where you can view a history of the titles of all the videos you’ve watched, the days on which you watched them and their sources whether it was viewed on Animebook, or YouTube or whatever. It also comes with a small donut chart so you can see your viewing preferences from a distance, and there is also a sources filter section where you can filter your history by source. If you only wanted to see your YouTube entries for example, then you would simply select the relevant badge. Once you start to get a lot of entries on your history page, then this feature could come in handy (thanks goes out to @meo343 for suggesting this feature).

## Argument against daily streaks
I have used a “DAYS IMMERSED” metric rather than a “STREAK” counter as I believe it creates unwanted anxiety. With total “DAYS IMMERSED”, you can afford to take days off, if and when you want to, and the counter will still be there when you come back. It won’t ever reset to 0, it just keeps counting. This is also a much better measurement of your progress. With no stress!

## Automated Time Tracking
With the Animebook, asbplayer, cijapanese and TVer websites, your time is tracked automatically. So all you have to do is play a video, the time will just start ticking without any interaction with the extension and a list of your videos watched will start being logged on the history page located at the bottom of the popup (time is collected completely locally within your browser).

## Manual Time Tracking
While on YouTube, Disney+ and Amazon Prime, time tracking is set up manually rather than automatically. So what happens is the extension injects a small floating button directly onto the YouTube video. So, there is no need to keep opening the popup. The reasoning? Sometimes you can end up watching a few minutes of several videos on YouTube before you actually find a video that is worth watching in your target language (or whatever subject matter you decide to use the extension for). And if the Animebook Tracker was tracking the whole time automatically, you would end up with a whole load of time tracked of videos you didn't want to be tracked and that you were probably only half paying attention to. But, once you find a video worth watching, then you simply press the on-screen “Track” button, and away you go. The idea behind it is to keep your track history cleaner looking and more intentional. Only the content you deliberately choose to track gets recorded, which makes your stats much more meaningful. A session where you browsed for 10 minutes before finding a good video won't pollute your history.

### Here's how I'd envision the workflow:
1. You open YouTube and browse around — nothing is tracked
2. You find a good Japanese video and start watching
3. You press the Track button on the page — tracking starts immediately
4. You watch the video — time accumulates in Animebook Tracker as normal
5. The video ends or you navigate away — tracking stops automatically
6. Next video, same process — you choose whether to track it or not

Also, for Japanese learners specifically, the extension has been built to work with the NihongoTube Chrome extension in mind (Thanks goes out to its developer @hexindria for their invaluable help with that!)

## Screenshots
Popup and history page (dark mode)
<img width="1840" height="1191" alt="Screenshot 2026-04-05 at 17 13 35" src="https://github.com/user-attachments/assets/b4fb59e4-eb23-435e-be77-587a2a60b262" />

Popup and history page (Light mode)
<img width="1840" height="1191" alt="Screenshot 2026-04-05 at 17 13 20" src="https://github.com/user-attachments/assets/674f0408-7140-4890-9bd5-a45b874ac4e8" />

Floating button on YouTube videos so you can track time manually (there's no need to open the popup for this)
<img width="1272" height="720" alt="Screenshot 2026-03-24 at 11 43 05" src="https://github.com/user-attachments/assets/7ed5c3ef-ccd1-4cfd-bd9b-b054d6493833" />

## Installation
For now you can install the extension manually. Just remember to keep "Developer Mode" enabled otherwise your browser may involuntarily uninstall it the next time you open your browser:
### Steps
1. Download the latest release as a .zip file.
2. Unzip it in an empty directory of your choice.
3. Navigate to your Chrome extensions ( chrome://extensions/ ).
4. Enable "Developer mode" in the top right.
6. Press "Load unpacked" in the top left and select the directory.
7. Restart your browser.
Enjoy!

## Updating your version of Animebook Tracker
Before updating, I recommend using the “Export” button found at the bottom right of the Animebook Tracker popup to export a “watchtime.json”. This json will contain all of the watchtime that the extension has been tracking until now. Then go ahead and install the new version of Animebook Tracker as per the steps above. Once installed, pin the extension to the front in your browser, open the popup and select the “Import” button, also found at the bottom right of the popup. Navigate to the “watchtime.json” file and select “Open” and then follow the onscreen instructions.

## Adding your watch time from the cijapanese.com website
New to Version 3.8 - adds a small green “Merge” button in the bottom right of the popup. This button adds the ability to merge your current watch time data from the cijapanese.com site with your existing data on Animebook Time Tracker. On the cijapanese.com website, navigate to the “Dashboard” by selecting the “Progress bar” in the top right of the page (which is right next to your profile picture). When on the “Dashboard” scroll down to the “Historical Activity” section and you should see an “Export” icon (which is a small square box with an arrow sticking out of it). Select that and then select “JSON” in the dialogue window to download your Historical Activity json file. It should be titled as “Export (today’s date).json”. Next open AT’s popup and select “Merge” in the bottom right corner. Navigate to your “Export (today’s date).json” file and select “Open” and then follow the on screen instructions.

## Currently Supported Sites
- [Animebook] (https://animebook.github.io/) [for playing local videos] [auto time tracking]
- [asbplayer] (https://killergerbah.github.io/asbplayer/) [for playing local videos] [auto time tracking]
- [YouTube] (https://www.youtube.com/) [for streaming videos] [multi-language site] [manual time tracking]
- [cijapanese] (https://cijapanese.com/) [for streaming videos] [Japanese only site] [auto time tracking]
- [TVer] (https://tver.jp/) [for streaming videos] [Japanese only site] [auto time tracking]
- [Disney+] (https://www.disneyplus.com/) [for streaming videos] [multi-language site] [manual time tracking]
- [Amazon Prime] (all domains) [for streaming videos] [multi-language site] [manual time tracking]
- [Netflix] (planned) [but I don't have a subscription though, so this one is probably going to be last on the list!]
- [Hulu] (planned) [but also no subscription yet!]
- [U-Next] (planned) [again, no subscription yet!]

## Changing Disney+ settings to your chosen language
If you want AT to log video titles on its history page in your chosen language, then I recommend changing your language in the Disney+ settings:

1. Go to your profile picture in the top left of the homescreen and select “Edit profiles”.
2. Then select your profile picture.
3. Then simply change the “App Language” to your desired language. Done!
