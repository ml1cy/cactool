// Copyright Google Inc. All Rights Reserved.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Constants
const DEFAULT_APPID = 'CC1AD845';
const LOGGER_CHANNEL = 'urn:x-cast:com.google.cast.debuglogger';
const CAC_NAMESPACE = 'urn:x-cast:com.google.cast.cac';
const MEDIA_NAMESPACE = 'urn:x-cast:com.google.cast.media';
const USER_ACTIONS = {
  LIKE: 'LIKE',
  DISLIKE: 'DISLIKE',
  FOLLOW: 'FOLLOW',
  UNFOLLOW: 'UNFOLLOW',
  FLAG: 'FLAG',
  SKIP_AD: 'SKIP_AD'
};
const CAC_LOAD_SAMPLE = '{'+
  '\n\t"type": "LOAD_BY_ENTITY",'+
  '\n\t"credentials": "testCredentials",'+
  '\n\t"entity": "myapp://playlist/1",'+
  '\n\t"autoPlay": true,'+
  '\n\t"shuffle": false,'+
  '\n\t"customData": null'+
  '\n}';
const MEDIA_LOAD_SAMPLE = '{'+
'\n\t"media": {'+
'\n\t\t"contentId": "bbb",'+
'\n\t\t"contentUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/mp4/BigBuckBunny.mp4",'+
'\n\t\t"entity": "myapp://playlist/1",'+
'\n\t\t"streamType": "BUFFERED",'+
'\n\t\t"customData": {}'+
'\n\t},'+
'\n\t"credentials": "testCredentials"'+
'\n}';
const LOGGER_LEVEL = {
    DEBUG: 0,
    ERROR: 1000,
    INFO: 800,
    NONE: 1500,
    VERBOSE: 500,
    WARNING: 900
};
const DIV_TAG_MEDIA = 'MEDIA';
const DIV_TAG_CAC = 'CAC';
const DIV_TAG_PLAYING = 'PLAYING';
const DIV_TAG_CAC_ERROR = 'CAC-ERROR';
const DIV_TAG_MEDIA_ERROR = 'MEDIA-ERROR';
const DIV_TAG_USER_ERROR = 'USER-ERROR';
const LOAD = 'LOAD';
const LOAD_BY_ENTITY = 'LOAD_BY_ENTITY';

// Variables
var castInitialized = false;
var castAvailable = false;
var requestId = 1;
var focusState = true;
var showing = false;
var isSetCredsResponsePending_ = false;
var cacRequestMap = new Map();
var isCustomLoadRequest_ = false;
var isAtvReceiverCompatible_ = false;
var atvCredentialsData = null;
var isAtvLaunchOptionsShowing_ = false;
var customRequestType = LOAD_BY_ENTITY;
var requestFieldsType = LOAD_BY_ENTITY;
var _isMediaTextChanged = false;
var _isCacTextChanged = false;
var _isLikeClear = false;
var _isDislikeClear = false;
var _isFollowClear = false;
var _isUnfollowClear = false;
var _isFlagClear = false;
var _isSkipAdClear = false;
var changedMediaText;
var changedCacText;

let loggerTagsList = {};

// Receiver App ID - Section 1
let receiverAppID = localStorage.getItem('receiverAppID') ? localStorage.getItem('receiverAppID') : DEFAULT_APPID;
document.getElementById('receiver-app-id-input').value = receiverAppID;
document.getElementById('set-app-id-btn').addEventListener("click", function() {
    let search = window.location.search;
    let urlParams = new URLSearchParams(search);
    localStorage.setItem('receiverAppID', document.getElementById('receiver-app-id-input').value);
    urlParams.set("appId",localStorage.getItem('receiverAppID'));
    window.history.replaceState({},"",'?'+urlParams);
    location.reload();
});

window.onload = function() {
  let search = window.location.search;
  let urlParams = new URLSearchParams(search);
  if (urlParams.has("appId")) {
    let appId = urlParams.get("appId");
    this.document.getElementById('receiver-app-id-input').value = appId;
  }
  document.getElementById('json-object-txt').value = CAC_LOAD_SAMPLE;
  document.getElementById('atv-launch-options').style.display = 'none';
};

/* --
  Cast Initialization
-- */
window['__onGCastApiAvailable'] = function(isAvailable) {
  if (isAvailable) {
    initializeCastApi();
  }
};

initializeCastApi = function() {
  let castContext = cast.framework.CastContext.getInstance();
  
  castContext.setOptions({
    receiverApplicationId: receiverAppID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    resumeSavedSession:true
  });

  castContext.addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    castState => {

      switch(castState.castState) {
        case cast.framework.CastState.NOT_CONNECTED:
        case cast.framework.CastState.CONNECTING:
        case cast.framework.CastState.CONNECTED:
          document.getElementById('cast-button').style.display = 'block';
          break;
        default:
          document.getElementById('cast-button').style.display = 'none';
      }
    }
  );
  /* --
      Session State and Receiver Info
  -- */
  castContext.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
    sessionState => {

      switch(sessionState.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED:

        case cast.framework.SessionState.SESSION_RESUMED:
          let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
          document.getElementById('receiver-id-header').innerText ='Receiver App ID: '+castSession.getApplicationMetadata().applicationId;
          document.getElementById('session-id-header').innerText = 'Session ID: '+castSession.getSessionId();

          // CaC Messages
          castSession.addMessageListener(CAC_NAMESPACE, (namespace, message) => {
            console.log("RECEIVED CaC message:" + message);
            checkCacResponse(message);

            // send LOAD_BY_ENTITY message after SET_CREDENTIALS is succeed
            if (isSetCredsResponsePending_) {
              if (JSON.parse(message).type == 'SUCCESS') {
                if (isCustomLoadRequest_) {
                  sendCustomLoadMessage();
                } else {
                  onLoadByEntityClick();
                }
              }
              isSetCredsResponsePending_ = false;
            }
          });

          // Debug Logger Messages
          castSession.addMessageListener(LOGGER_CHANNEL, (namespace, message)=>{
            message = JSON.parse(message);

            // for backward compatible
            if (message.logString == null) {
                message.logString = message.H;
            }

            let textBlockClass = 'logger-info';
            if (message.logLevel != null) {
                switch (message.logLevel) {
                    case LOGGER_LEVEL.INFO:
                        textBlockClass = 'logger-info';
                        break;
                    case LOGGER_LEVEL.ERROR:
                        textBlockClass = 'logger-error';
                        break;
                    case LOGGER_LEVEL.WARNING:
                        textBlockClass = 'logger-warning';
                        break;
                }
            }

            let loggerTagClass = 'logger-tag-0';
            let textBlockVisible = 'block';
            let loggerTagID = 0;
            if (message.customTag != null) {
                if (!(message.customTag in loggerTagsList)) {
                    loggerTagsList[message.customTag] = {
                        id: Object.keys(loggerTagsList).length + 1,
                        checked: false
                    };
                    loggerTagID = loggerTagsList[message.customTag].id;
                    createCheckbox(loggerTagID, message.customTag);
                }
                loggerTagID = loggerTagsList[message.customTag].id;
                loggerTagClass = `logger-tag-${loggerTagID}`;

                if (!document.getElementById('checkbox-all-tags').checked
                && !document.getElementById(`checkbox-tag-${loggerTagID}`).checked) {
                    textBlockVisible = 'none';
                }
            }

            document.getElementById('debugger-info').value = message.logString + '\r\n' + document.getElementById('debugger-info').value;
            let textBlock = document.createElement('div');
            textBlock.classList.add('logger-block', textBlockClass, loggerTagClass);
            textBlock.innerText = message.logString;
            textBlock.style.display = textBlockVisible;
            document.getElementById('debugger-color-info').insertBefore(
            textBlock, document.getElementById('debugger-color-info').firstChild);
          });
          break;

        default:
          document.getElementById('receiver-id-header').innerHTML = '';
          document.getElementById('session-id-header').innerHTML = '';
      }
    });

  let player = new cast.framework.RemotePlayer();
  let playerController = new cast.framework.RemotePlayerController(player);
  playerController.addEventListener(cast.framework.RemotePlayerEventType.MEDIA_INFO_CHANGED, () =>{
    document.getElementById('media-info').innerText = JSON.stringify(player.mediaInfo, null, '\t');
    /*console.log('** player.mediaInfo **');
      if (player.mediaInfo)
        console.log("player.mediaInfo: " + player.mediaInfo.customData);*/
  });

  playerController.addEventListener(
    cast.framework.RemotePlayerEventType.ANY_CHANGE, (event) => {
      let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
      if (castSession) {
        document.getElementById('media-session').innerHTML = JSON.stringify(castSession.getMediaSession(), null, '\t');
      } else {
        document.getElementById('media-session').innerHTML = '';
      }
  });

  /* --
      Media Commands - Playback Controls
  --*/
  // Pause Button
  document.getElementById('pause-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: 'PAUSE',
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg);
    }
  });

  // Play Button
  document.getElementById('play-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: 'PLAY',
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg);
    }
  });

  // Stop Button
  document.getElementById('stop-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: 'STOP',
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg);
    }
  });

  // Prev Button
  document.getElementById('prev-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        jump: -1,
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'PREVIOUS');
    }
  });

  // Next Button
  document.getElementById('next-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        jump: 1,
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'NEXT');
    }
  });

  // Shuffle Button
  document.getElementById('shuffle-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        "shuffle": true,
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'SHUFFLE');
    }
  });

  // Repeat One Button
  document.getElementById('repeat-one-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        "repeatMode":"REPEAT_SINGLE",
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'REPEAT ONE');
    }
  });

  // Repeat All Button
  document.getElementById('repeat-all-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        "repeatMode":"REPEAT_ALL",
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'REPEAT ALL');
    }
  });

  // Repeat Off Button
  document.getElementById('repeat-off-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "QUEUE_UPDATE",
        "repeatMode":"REPEAT_OFF",
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'REPEAT OFF');
    }
  });

  // Seek Back 'x' Sec Button
  document.getElementById('seek-back-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let timeSec = Number(document.getElementById('seek-media-input').value);
    if (timeSec < 0) {
      timeSec *= -1;
    }

    if (castSession) {
      let msg = {
        type: "SEEK",
        resumeState : "PLAYBACK_START",
        currentTime: 0,
        relativeTime : (timeSec * -1.0),
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'BACK '+timeSec+' SECONDS');
    }
  });

  // Seek to 'x' Sec Button
  document.getElementById('seek-to-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let timeSec = Number(document.getElementById('seek-media-input').value);
    if (timeSec < 0) {
      timeSec *= -1;
    }

    if (castSession) {
      let msg = {
        type: "SEEK",
        resumeState : "PLAYBACK_START",
        currentTime: timeSec,
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId,
        sessionId: castSession.getSessionId()
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'TO '+timeSec+' SECONDS');
    }
  });

  // Seek Forward 'x' Sec Button
  document.getElementById('seek-forward-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let timeSec = Number(document.getElementById('seek-media-input').value);
    if (timeSec < 0) {
      timeSec *= -1;
    }

    if (castSession) {
      let msg = {
        type: "SEEK",
        resumeState : "PLAYBACK_START",
        currentTime: 0,
        relativeTime: timeSec,
        requestId: requestId++,
        mediaSessionId: castSession.getMediaSession().mediaSessionId,
        sessionId: castSession.getSessionId()
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'FORWARD '+timeSec+' SECONDS');
    }
  });

  // What's Playing Button
  document.getElementById('whats-playing-button').addEventListener("click", ()=>{
    let msg = "Media Metadata not available. Either the metadata was not provided with this media or there is no existing session.";
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    try {
      if (castSession) {
        var obj = castSession.getMediaSession().media.metadata.title;
        msg = "Currently Playing: "+obj;
      }
      insertMessage(msg, DIV_TAG_PLAYING);
    } catch(e) {
      insertMessage(msg, DIV_TAG_PLAYING);
    }
  });

  // Captions On Button
  document.getElementById('captions-on-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let lang = document.getElementById('captions-lang-input').value;
      let suggestedLang = document.getElementById('captions-lang-checkbox').checked;
      let msg = {
        type: "EDIT_TRACKS_INFO",
        language: lang,
        isSuggestedLanguage: suggestedLang,
        mediaSessionId: castSession.getMediaSession().mediaSessionId,
        sessionId: castSession.getSessionId(),
        requestId: requestId++
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'CAPTIONS ON');
    }
  });

  // Captions Off Button
  document.getElementById('captions-off-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "EDIT_TRACKS_INFO",
        "activeTrackIds": [],
        mediaSessionId: castSession.getMediaSession().mediaSessionId,
        sessionId: castSession.getSessionId(),
        requestId: requestId++
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'CAPTIONS OFF');
    }
  });

  // Switch to Alternate Audio Language Button
  document.getElementById('alternate-audio-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let lang = document.getElementById('audio-lang-input').value;
      let suggestedLang = document.getElementById('audio-lang-checkbox').checked;
      if (lang!=null && lang != "") {
        let msg = {
          type : "EDIT_AUDIO_TRACKS",
          "language": lang,
          isSuggestedLanguage: suggestedLang,
          mediaSessionId: castSession.getMediaSession().mediaSessionId,
          sessionId: castSession.getSessionId(),
          requestId: requestId++
        };
        sendCastSessionMessage(MEDIA_NAMESPACE, msg, 'SET ALTERNATE AUDIO');
      }
    }
  });

  // Play It Again Buton
  document.getElementById('play-again-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let media = castSession.getMediaSession().mediaSessionId;
      let msg = {
        type: "PLAY_AGAIN",
        mediaSessionId: media,
        sessionId: castSession.getSessionId(),
        requestId: requestId++
      };
      sendCastSessionMessage(MEDIA_NAMESPACE, msg);
    }
  });

  // Checking for Media Status Button
  document.getElementById('check-media-status-button').addEventListener("click", ()=>{
    document.getElementById('meds').click();
  });

  // Play String 'Simulate' Button
  document.getElementById('simulate-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let contentID = "SIMULATE_PLAYSTRING_USAGE";
    if (castSession) {
      let msg = {
        type: "LOAD_BY_ENTITY",
        entity: contentID,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg);
    }
  });

  // Display Status Button
  document.getElementById('display-status-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "DISPLAY_STATUS",
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg);
    }
  });

  // Toggle Focus State Button
  document.getElementById('toggle-focus-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let focState = focusState ? "NOT_IN_FOCUS" : "IN_FOCUS";
    focusState = focusState ? false : true;
    if (castSession) {
      let msg = {
        type: "FOCUS_STATE",
        state: focState,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg);
    }
  });

  /* --
      User Actions
  -- */
  // Like Button
  document.getElementById('like-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.LIKE,
        userActionContext: "ALBUM",
        clear: _isLikeClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.LIKE);
      _isLikeClear = toggleUserActionClear(_isLikeClear, 'like-button');
    }
  });

  // Dislike Button
  document.getElementById('dislike-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.DISLIKE,
        userActionContext: "TRACK",
        clear: _isDislikeClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.DISLIKE);
      _isDislikeClear = toggleUserActionClear(_isDislikeClear, 'dislike-button');
    }
  });

  // Follow Button
  document.getElementById('follow-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.FOLLOW,
        userActionContext: "ARTIST",
        clear: _isFollowClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.FOLLOW);
      _isFollowClear = toggleUserActionClear(_isFollowClear, 'follow-button');
    }
  });

  // Unfollow Button
  document.getElementById('unfollow-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.UNFOLLOW,
        userActionContext: "CHANNEL",
        clear: _isUnfollowClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.UNFOLLOW);
      _isUnfollowClear = toggleUserActionClear(_isUnfollowClear, 'unfollow-button');
    }
  });

  // Flag Button
  document.getElementById('flag-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.FLAG,
        clear: _isFlagClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.FLAG);
      _isFlagClear = toggleUserActionClear(_isFlagClear, 'flag-button');
    }
  });

  // Skid Ad Button
  document.getElementById('skip-ad-button').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      let msg = {
        type: "USER_ACTION",
        userAction: USER_ACTIONS.SKIP_AD,
        clear: _isSkipAdClear,
        requestId: requestId++
      };
      sendCastSessionMessage(CAC_NAMESPACE, msg, USER_ACTIONS.SKIP_AD);
      _isSkipAdClear = toggleUserActionClear(_isSkipAdClear, 'skip-ad-button');
    }
  });

  // Set ATV Launch Credentials
  document.getElementById('set-launch-creds-btn').addEventListener("click", ()=>{
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession) {
      ActiveSessionError('Launch Credentials');
    } else {
      let creds = document.getElementById('atv-launch-creds-input').value;
      if (creds && isAtvReceiverCompatible_) {
        atvCredentialsData = creds;
      } else {
        atvCredentialsData = null;
      }
      console.log("Android TV launch credentials set: "+atvCredentialsData);
      castContext.setLaunchCredentialsData(atvCredentialsData);
    }
  });
}

document.getElementById('checkbox-all-tags').addEventListener("change", function(){
    for (tag in loggerTagsList) {
        let loggerTagID = loggerTagsList[tag].id;
        if (this.checked) {
            toggleCheckbox(`checkbox-tag-${loggerTagID}`, false, true);
            toggleLogs(`logger-tag-${loggerTagID}`, 'block');
        } else {
            if (loggerTagsList[tag].id == 1) {
                toggleCheckbox(`checkbox-tag-${loggerTagID}`, true, false);
                toggleLogs(`logger-tag-${loggerTagID}`, 'block');
            } else {
                toggleCheckbox(`checkbox-tag-${loggerTagID}`, false, false);
                toggleLogs(`logger-tag-${loggerTagID}`, 'none');
            }
        }
    }
});

/* --
    Receiver Debug Overlay
-- */
sendMessage = function(action) {
  let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (castSession) {
    castSession.sendMessage(LOGGER_CHANNEL, {command: action});
  }
}

createCheckbox = function(loggerTagID, loggerTag) {
    let inputElement = document.createElement('input');
    inputElement.id = `checkbox-tag-${loggerTagID}`;
    inputElement.type = 'checkbox';
    inputElement.className = 'mdl-checkbox__input';
    inputElement.disabled = document.getElementById('checkbox-all-tags').checked;
    inputElement.addEventListener("change", function() {
        if (this.checked) {
            toggleLogs(`logger-tag-${loggerTagID}`, 'block');
        } else {
            toggleLogs(`logger-tag-${loggerTagID}`, 'none');
        }
    });

    let spanElement = document.createElement('span');
    spanElement.className = 'mdl-checkbox__label';
    spanElement.innerText = loggerTag;

    let labelElement = document.createElement('label');
    labelElement.className = "mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect";
    labelElement.htmlFor = `checkbox-tag-${loggerTagID}`;

    labelElement.appendChild(inputElement);
    labelElement.appendChild(spanElement);
    componentHandler.upgradeElement(labelElement);
    document.getElementById('checkbox-tag-lists').appendChild(labelElement);
}

toggleCheckbox = function(className, checked, disabled) {
    let checkboxElement = document.getElementById(className);
    checkboxElement.checked = checked;
    checkboxElement.disabled = disabled;

    if (checkboxElement.checked) {
        checkboxElement.parentNode.classList.add("is-checked")
    } else {
        checkboxElement.parentNode.classList.remove("is-checked")
    }

    if (checkboxElement.disabled) {
        checkboxElement.parentNode.classList.add("is-disabled")
    } else {
        checkboxElement.parentNode.classList.remove("is-disabled")
    }
}

toggleLogs = function(className, visible) {
    let logElements = document.getElementsByClassName(className);
    for (var i = 0; i < logElements.length; i++) {
        logElements[i].style.display = visible;
    }
}

// Clear Debug Overlay on Receiver
document.getElementById('clr-cache-rdo-button').addEventListener("click", ()=>{
  sendMessage('CLEARCACHE');
});

// Clear Cache Reload on Receiver
document.getElementById('clear-rdo-button').addEventListener("click", ()=>{
  sendMessage('CLEAR');
});

// Toggle Debug Overlay on Receiver
document.getElementById('toggle-rdo-button').addEventListener("click",()=>{
  if (!showing) {
    sendMessage('SHOW');
    document.getElementById('show-hide-toggle').innerHTML = "HIDE";
    showing = true;
  } else {
    sendMessage('HIDE');
    document.getElementById('show-hide-toggle').innerHTML = "SHOW";
    showing = false;
  }
});

// Resume Session Button
document.getElementById('resume-session-button').addEventListener('click', ()=>{
  let sessionId = document.getElementById('session-id-input').value;
  if (sessionId) {
    chrome.cast.requestSessionById(sessionId);
  }
});

// Leave Session Button
document.getElementById('leave-session-button').addEventListener('click', ()=>{
  let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (castSession) {
    castSession.getSessionObj().leave();
  }
});

/* --
    Log Message Controls
-- */
// Add Logger Tag
getLoggerTagId = function(customTag) {
  let loggerTagID = 0;
  if (!(customTag in loggerTagsList)) {
    loggerTagsList[customTag] = {
        id: Object.keys(loggerTagsList).length + 1,
        checked: false
    };
    loggerTagID = loggerTagsList[customTag].id;
    createCheckbox(loggerTagID, customTag);
  } else {
    loggerTagID = loggerTagsList[customTag].id;
  }
  
  return loggerTagID;
}

// Insert Message Button
document.getElementById('insert-msg').addEventListener("click", ()=>{
  let msgLog = document.getElementById('msg-log').value; //
  if (msgLog) {
    insertMessage(msgLog, 'USER');
  }
});

insertMessage = function(msgLog, type) {
    document.getElementById('debugger-info').value = msgLog + '\r\n'+ document.getElementById('debugger-info').value;
    let textBlock = document.createElement('div');
    let loggerTagID = getLoggerTagId(type);
    switch(type) {
      case DIV_TAG_CAC:
        textBlock.classList.add('logger-block', 'cac-response-div', `logger-tag-${loggerTagID}`);
        break;

      case DIV_TAG_PLAYING:
        textBlock.classList.add('logger-block', 'playing-response-div', `logger-tag-${loggerTagID}`);
        break;
      
      case DIV_TAG_MEDIA:
        textBlock.classList.add('logger-block', 'media-response-div', `logger-tag-${loggerTagID}`);
        break;

      case DIV_TAG_CAC_ERROR:
        textBlock.classList.add('logger-block', 'cac-error-div', `logger-tag-${loggerTagID}`);
        break;

      case DIV_TAG_MEDIA_ERROR:
        textBlock.classList.add('logger-block', 'media-error-div', `logger-tag-${loggerTagID}`);
        break;

      case DIV_TAG_USER_ERROR:
        textBlock.classList.add('logger-block', 'logger-warning', `logger-tag-${loggerTagID}`);
        break;
      
      default:
        textBlock.classList.add('logger-block', 'logger-div', `logger-tag-${loggerTagID}`);
    }
    textBlock.innerText = msgLog;
    document.getElementById('debugger-color-info').insertBefore(textBlock, document.getElementById('debugger-color-info').firstChild);
}

// Clear Log Button
document.getElementById('clear-logging').addEventListener("click", ()=>{
    document.getElementById('debugger-info').value = '';
    document.getElementById('debugger-color-info').innerHTML = '';
    loggerTagsList = {}

    let tagLists = document.getElementById('checkbox-tag-lists');
    let tagText = tagLists.children[0];
    let tagAll = tagLists.children[1];
    tagLists.innerHTML = '';
    tagLists.appendChild(tagText);
    tagLists.appendChild(tagAll);
});

// Download Log Button
document.getElementById('download-logging').addEventListener("click", ()=>{
  let textToWrite = document.getElementById('debugger-info').value;
  let blobFile = new Blob([textToWrite], { type: "text/plain"});

  // Create hidden download link and click it
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blobFile);
  link.download = `cast-receiver-${Date.now()}.log`;
  link.target ="_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

// Toggle Control Buttons
document.getElementById('switch-control').addEventListener("change", function(){
    if (this.checked) {
      document.getElementById('control-tabs').style = null;
    } else {
      document.getElementById('control-tabs').style.display='none';
    }
});

createMediaInfo = function(contentId, contentUrl, entityUrl) {
    const mediaInfo = new chrome.cast.media.MediaInfo();
    mediaInfo.contentId = contentId;
    mediaInfo.contentUrl = contentUrl;
    mediaInfo.entity = entityUrl;
    return mediaInfo
}

cast = function(mediaInfo, queueData = null) {
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    let request = new chrome.cast.media.LoadRequest(mediaInfo);
    let creds = document.getElementById('set-credentials-input').value;
    if (creds) {
      request.credentials = creds;
    }
    request.requestId = requestId++;
    castSession.loadMedia(request).then(
      function() {
        insertMessage('[Load Request Success] <Request ID: '+request.requestId+'> Type: LOAD', DIV_TAG_MEDIA);
      },
      function(errorCode) {
        insertMessage('[Load Request Failed] Error:'+errorCode+' <Request ID: '+request.requestId+'> Type: LOAD', DIV_TAG_MEDIA_ERROR);
      }
    );
}

onLoadByEntityClick = function() {
  const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  const contentID = document.getElementById('set-entity-input').value;
  if (contentID != null && contentID != "") {
    const shuffle = document.getElementById('shuffle-checkbox').checked;
    const contentFilter = document.getElementById('contentfilter-checkbox').checked;
    const msg = {
        type: "LOAD_BY_ENTITY",
        entity: contentID,
        autoPlay: true,
        shuffle: shuffle,
        requestId: requestId++
    };

    if (contentFilter) {
      msg.contentFilteringMode = "FILTER_EXPLICIT";
    }

    sendCastSessionMessage(CAC_NAMESPACE, msg);
  }
}

sendCredentialsMessage = function(credentials) {
  let msg = {
    type: "SET_CREDENTIALS",
    credentials: credentials,
    requestId: requestId++
  };
  sendCastSessionMessage(CAC_NAMESPACE,msg);
}

sendCastSessionMessage = function(namespace, message, details) {
  var divTag,divTagError;
  printsuccess = function() {
    let logMsg = '[Message Sent] <Request ID: '+message.requestId+'> Type: '+message.type;
    if (details) {
      logMsg += ' - '+details;
    }
    insertMessage(logMsg, divTag);
  }
  printError = function(error) {
    let logMsg = '[Message Failed: '+error+'] <Request ID: '+message.requestId+'> Type: '+message.type;
    if (details) {
      logMsg += ' - '+details;
    }
    insertMessage(logMsg, divTagError);
  }

  if (namespace == CAC_NAMESPACE) {
    divTag = DIV_TAG_CAC;
    divTagError = DIV_TAG_CAC_ERROR;
    let id = message.requestId
    let reqObj = new cacRequest(message);
    cacRequestMap.set(id, reqObj);
  } else {
    divTag = DIV_TAG_MEDIA;
    divTagError = DIV_TAG_MEDIA_ERROR;
  }

  const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  castSession.sendMessage(namespace,message).then(printsuccess, printError);
}

cacRequest = function(message) {
  printMsg = function() {
    req.response = "[Response Verification] <Request ID: "+req.reqId+"> No response received. Type: "+req.type;
    insertMessage(req.response, DIV_TAG_CAC_ERROR);
  }

  var req = {
    reqId: message.requestId,
    type: message.type,
    sentMsg: message,
    timer: setTimeout(printMsg, 30000),
    response: null
  };
  
  return req;
}

// Checks incoming CAC responses for requestId verification
checkCacResponse = function(response) {
  let res = JSON.parse(response);
  let resId = res.requestId;
  console.log("checkCacResponse: "+resId);

  if (cacRequestMap.has(resId)) {
    let reqObj = cacRequestMap.get(resId);
    // Check for duplicates - If a response to a requestId has already been noted
    if (reqObj.response != null) {
      insertMessage('[Response Verification] <Request ID: '+resId+"> Duplicate Request ID. Response received: "+response, DIV_TAG_CAC_ERROR);
    } else {
      clearTimeout(reqObj.timer);
      // Valid response, returns error
      if (res.type == "ERROR") {
        insertMessage("[Cac Error] Response: "+response, DIV_TAG_CAC_ERROR);
      }
      reqObj.response = '[Response Verification] <Request ID: '+resId+'> Valid Request ID. Response: '+response;
      console.log(reqObj.response);
    }
  } else {
    insertMessage('[Response Verification] <Request ID:'+resId+'> Unidentified Request ID. Response received: '+response, DIV_TAG_CAC_ERROR);
  }
}

/* --
    Custom Load Object Controls
-- */

// Send Custom Load Request
document.getElementById('send-custom-object').addEventListener(("click"), ()=>{
  const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (castSession) {
    try {
      const loadData = JSON.parse(document.getElementById('json-object-txt').value);
      if (customRequestType == LOAD_BY_ENTITY) {
        if (loadData.credentials != null) {
          isCustomLoadRequest_ = true;
          isSetCredsResponsePending_ = true;
          sendCredentialsMessage(loadData.credentials);
        } else {
          sendCustomLoadMessage();
        }
      } else {
        loadData.requestId = requestId++;
        castSession.loadMedia(loadData).then(
          function() {
            insertMessage('[Load Request Success] <Request ID: '+loadData.requestId+'> Type: LOAD', DIV_TAG_MEDIA);
          },
          function(errorCode) {
            insertMessage('[Load Request Failed] Error:'+errorCode+' <Request ID: '+loadData.requestId+'> Type: LOAD', DIV_TAG_MEDIA_ERROR);
          });
      }
    } catch(e) {
      if (e instanceof SyntaxError) {
        alert("Syntax Error. Check input. \nError: "+e.message);
      }
    }
  }
});

sendCustomLoadMessage = function() {
  isCustomLoadRequest_ = false;
  const loadData = JSON.parse(document.getElementById('json-object-txt').value);
  loadData.requestId = requestId++;
  sendCastSessionMessage(CAC_NAMESPACE, loadData);
}

// Enable TAB key for indentation in Custom Load Request box
document.getElementById('json-object-txt').addEventListener(('keydown'), (event)=>{
  if (event.key == 'Tab') {
    event.preventDefault();
    var txt = event.currentTarget;
    var start = txt.selectionStart;
    var end = txt.selectionEnd;
    txt.value = txt.value.substring(0,start)+"\t"+txt.value.substring(start);
    txt.selectionStart = start+1;
    txt.selectionEnd = end+1;
  }
});

document.getElementById('show-atv-options-btn').addEventListener("click", ()=>{
  if (!isAtvLaunchOptionsShowing_) {
    isAtvLaunchOptionsShowing_ = true;
    document.getElementById('atv-launch-options').style = null;
    document.getElementById('receiver-debug-overlay').style.display = 'none';
    document.getElementById('show-atv-options-btn').innerText = 'HIDE Android TV OPTIONS';
    onShowLaunchOptions();
  } else {
    isAtvLaunchOptionsShowing_ = false;
    document.getElementById('atv-launch-options').style.display = 'none';
    document.getElementById('receiver-debug-overlay').style = null;
    document.getElementById('show-atv-options-btn').innerText = 'SHOW Android TV OPTIONS';
  }
});

onShowLaunchOptions = function() {
  var str = navigator.userAgent.toString();
  var pattern = /\bChrome\//;
  var index = str.search(pattern);
  var version = parseInt(str.substring(index+7, index+10));
  
  if (version<87) { 
    document.getElementById('atv-options-overlay').style.display = 'block';
    let text = document.getElementById('chrome-version-text').innerHTML;
    text = text.substr(0,244)+String(version);
    document.getElementById('chrome-version-text').innerHTML = text;
  } else { 
    document.getElementById('atv-options-overlay').style.display = 'none';
  }
}

document.getElementById('atv-checkbox').addEventListener("change", function() {
  if (this.checked) {
    isAtvReceiverCompatible_ = true;
  } else {
    isAtvReceiverCompatible_ = false;
  }
  try {
    let castContext = cast.framework.CastContext.getInstance();
    if (castContext.getCurrentSession()) {
      throw new ActiveSessionError('androidReceiverCompatible');
    }
    castContext.setOptions({
      receiverApplicationId: receiverAppID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      androidReceiverCompatible: isAtvReceiverCompatible_,
      resumeSavedSession:true
    });
  } catch(e) {
    console.log("Unable to set androidReceiverCompatible option.\nError Received: "+e.message);
    // Restore values to their correct current state
    if (isAtvReceiverCompatible_) {
      isAtvReceiverCompatible_ = false;
      document.getElementById('atv-checkbox').checked = false;
    } else {
      isAtvReceiverCompatible_ = true;
      document.getElementById('atv-checkbox').checked = true;
    }
  }
  console.log("Android TV Compatability: "+isAtvReceiverCompatible_);
});

ActiveSessionError = function(name) {
  this.message = 'Cannot change/set '+name+' during an ongoing session';
  insertMessage(this.message,DIV_TAG_USER_ERROR);
}

document.getElementById('send-load-request').addEventListener(("click"), function() {
  let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (castSession) {
    if (requestFieldsType == LOAD_BY_ENTITY) {
      let creds = document.getElementById('set-credentials-input').value;
      if (creds != null && creds != "") {
        isSetCredsResponsePending_ = true;
        sendCredentialsMessage(creds);
      } else {
        onLoadByEntityClick();
      }
    } else {
      let contUrl = document.getElementById('media-url').value;
      let contId = document.getElementById('media-id').value;
      let entityUrl = document.getElementById('set-entity-input').value;
      
      if (!contUrl && !contId && !entityUrl) {
        alert("Empty mediaInfo. Provide at least one of the following 3 fields and try again: \nContent URL, Content ID, or Entity URL");
      } else {
        let mediaInfo = createMediaInfo(contId, contUrl, entityUrl);
        cast(mediaInfo);
      }
    }
  }
});

onClickCacRadioButton = function() {
  requestFieldsType = LOAD_BY_ENTITY;
  document.getElementById('media-url').parentNode.classList.add('is-disabled');
  document.getElementById('media-url').disabled = true;
  document.getElementById('media-id').parentNode.classList.add('is-disabled');
  document.getElementById('media-id').disabled = true;
  document.getElementById('shuffle-checkbox').parentNode.classList.remove('is-disabled');
  document.getElementById('shuffle-checkbox').disabled = false;
  document.getElementById('contentfilter-checkbox').parentNode.classList.remove('is-disabled');
  document.getElementById('contentfilter-checkbox').disabled = false;
}

onClickMediaRadioButton = function() {
  requestFieldsType = LOAD;
  document.getElementById('media-url').parentNode.classList.remove('is-disabled');
  document.getElementById('media-url').disabled = false;
  document.getElementById('media-id').parentNode.classList.remove('is-disabled');
  document.getElementById('media-id').disabled = false;
  document.getElementById('shuffle-checkbox').parentNode.classList.add('is-disabled');
  document.getElementById('shuffle-checkbox').disabled = true;
  document.getElementById('contentfilter-checkbox').parentNode.classList.add('is-disabled');
  document.getElementById('contentfilter-checkbox').disabled = true;
}

toggleUserActionClear = function(clear, name) {
  if (!clear) {
    clear = true;
    document.getElementById(name).style.backgroundColor = "rgb(0,98,111)";
    document.getElementById(name).style.color = "white";
  } else {
    clear = false;
    document.getElementById(name).style.backgroundColor = "transparent";
    document.getElementById(name).style.color = "rgb(0,98,111)";
  }
  return clear;
}

document.getElementById('cac-radio').addEventListener(("click"), function() {
  onClickCacRadioButton();
});

document.getElementById('media-radio').addEventListener(("click"), function() {
  onClickMediaRadioButton();
});

document.getElementById('custom-cac-radio').addEventListener(("click"), function() {
  customRequestType = LOAD_BY_ENTITY;
  // Save customized LOAD request by user
  if (document.getElementById('json-object-txt').value == MEDIA_LOAD_SAMPLE) {
    _isMediaTextChanged = false;
  } else {
    _isMediaTextChanged = true;
    changedMediaText = document.getElementById('json-object-txt').value;
  }

  if (!_isCacTextChanged) {
    document.getElementById('json-object-txt').value = CAC_LOAD_SAMPLE;
  } else {
    document.getElementById('json-object-txt').value = changedCacText;
  }
});

document.getElementById('custom-media-radio').addEventListener(("click"), function() {
  customRequestType = LOAD;
  // Save customized LOAD_BY_ENTITY request by user
  if (document.getElementById('json-object-txt').value == CAC_LOAD_SAMPLE) {
    _isCacTextChanged = false;
  } else {
    _isCacTextChanged = true;
    changedCacText = document.getElementById('json-object-txt').value;
  }

  if (!_isMediaTextChanged) {
    document.getElementById('json-object-txt').value = MEDIA_LOAD_SAMPLE;
  } else {
    document.getElementById('json-object-txt').value = changedMediaText;
  }
});