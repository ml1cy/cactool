
# Cactool v2 - Cast Command and Control Tool
> **⚠️ Disclaimer**: This is Google's original Cactool project. The only modification made to this version is updating the Material Design Lite CDN to ensure the tool remains functional after Google deprecated their CDN. All core functionality and codebase are credited to Google.

> **This tool is accessable online!**: I've hosted it using Cloudflare Workers. You can access it by clicking [here](http://cactool.ijaz.workers.dev/)

A web-based debugging and testing tool for Google Chromecast application development. Cactool provides an intuitive interface for connecting to Chromecast receivers, loading media, controlling playback, and debugging Cast applications.




## Getting Started (Locally)

### Prerequisites
- A Chromecast device connected to your network
- A device with a Chromium-Based Browser (Chrome, Edge, Brave, etc.)
### Setup
1. [Download the project zip](https://github.com/ml1cy/cactool/archive/refs/heads/main.zip) or clone the repo 
```bash
git clone https://github.com/ml1cy/cactool
```
2. Open `index.html` in your web browser
3. Click the Cast button to select your Chromecast device
4. Enter a Receiver App ID (default: CC1AD845 for Google's default receiver)
5. Use the tabs to manage connections, load media, and control playback

## Project Structure

```
cactool/
├── index.html           # Main application UI
├── README.md            # This file
├── css/
│   └── caststyles.css   # Custom and Material Design styles
└── js/
    └── cactoolv2.js     # Application logic and Cast API integration
```

## Technical Details

This tool is built on:
- **Google Cast API** - For Chromecast protocol communication
- **Material Design Lite (MDL)** - For the responsive UI framework
- **CloudFlare CDN** - For serving MDL assets (replacing the deprecated Google CDN)

### CDN Update
The original Material Design Lite CDN (https://code.getmdl.io/) was discontinued by Google. This project has been updated to use CloudFlare's CDN (https://cdnjs.com/libraries/material-design-lite) for reliable asset delivery.

## 📚 Resources

- [Google Cast Documentation](https://developers.google.com/cast/docs)
- [Cactool Guide](https://developers.google.com/cast/docs/debugging/cac_tool)
- [Cast Debug Logger](https://developers.google.com/cast/docs/debugging/cast_debug_logger)
- [Original Cactool](https://casttool.appspot.com/cactool)

## 📄 License

Licensed under the Apache License, Version 2.0.

