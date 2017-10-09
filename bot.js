//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const moment = require('moment-timezone');
const firebase = require('./firebase.js')
const timer = require('./timer.js')
const onboarding = require('./onboarding.js');
const languages = require('./languages.js')
const quiz = require('./quiz.js')
const send = require('./sendingHelpers.js')
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";
var translate = require('@google-cloud/translate')(
  {
    credentials: {
     type: process.env.type, 
     project_id: process.env.project_id,
     private_key_id: process.env.private_key_id,
     private_key: process.env.private_key.replace(/\\n/g, '\n'),
     client_email: process.env.client_email,
     client_id: process.env.client_id,
     auth_uri: process.env.auth_uri,
     token_uri: process.env.token_uri,
     auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
     client_x509_cert_url: process.env.client_x509_cert_url }});

// The rest of the code implements the routes for our Express server.
let app = express();
app.use('/static', express.static(path.join(__dirname, 'public')))
exports = module.exports = {};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);   
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

function receivedMessage(event) {
  var senderID = event.sender.id;
  
  firebase.getUser(senderID).then((user) => {
    
    if (!user) {
      createNewUser(event, senderID);
    } else if (!user.language) {
      askUserForLanguage(event, user)
    } else if (user.currentQuiz && user.currentQuiz.active) {
      checkAnswer(senderID, event, user.currentQuiz.currentWordList);
    } else if (user.beingAskedTime){
      parseAndSetQuizTime(senderID, event.message.nlp)
    } else {
      respondToMessage(event, user);
    }
    
  });
}
var helpText = ""
    helpText += "Here are some supported commands: \n"
    helpText += "\n"
    helpText += "/list: Display a list all of the words you've searched so far. \n"
    helpText += "/review: Start a quiz with the words which are due for review. \n"
    helpText +=  "/language: Switch the language you want to learn. \n"
    helpText += "/reminder Set your daily quiz reminder time\n"
    helpText +=  "/delete: Delete all user data\n"
    helpText +=  "/stop: Stop sending reminders \n\n"


function help(userId) {
    send.sendTextMessage(userId, helpText);
}

function checkAnswer(userId, event, words){
  var guess = event.message;
  var timeOfGuess = event.timestamp;
  quiz.evaluateAnswer(userId, guess, timeOfGuess, words)
}

function createNewUser(event, senderId) {
  firebase.createUser(senderId).then((user) => {
    askUserForLanguage(event, user, getIntroMessage());
  }); 
}

// TODO: There really is no reason for this to be a function lol move it to variable
function getIntroMessage() {
  var text = ""
  text = text + "Hello and welcome to Wordly! 🎉"
  text = text + "\n"
  text = text + "\n"
  text = text + "Wordly is your personal dictionary, using spaced repetition to drill words into your long-term memory. "
  text = text + "I will save the words you search and help you learn them. "
  text = text + "So sit back (or stand up, I can't control you) and get ready to learn! "
  text = text + "\n"
  text = text + "\n"
  text = text + 'If you ever get stuck or confused, type "/help" for a list of supported commands.'
  return text;
}

function askUserForLanguage(event, user, introMessage) {
  var message = event.message;
  var senderID = event.sender.id;
  
  if (user.beingAsked) {
    var userLanguage = parseLanguage(message.text)
  
    if (!userLanguage) {
      send.sendTextMessage(senderID, "Are you sure that's a real language? 🤔\n\nPlease type the language you want to learn again.");
    } else {
      firebase.updateLanguage(senderID, userLanguage);
      var text = "Great, you're all set to learn " + languages.reverseMap[userLanguage] + "!\n\n";
      text = text + "Send me a word in English and I will translate it for you in " + languages.reverseMap[userLanguage] + "."
      send.sendTextMessage(senderID, text, ()=>{
        if(user.onboarding){
          send.sendTextMessage(senderID, helpText);
          firebase.setOnboarding(senderID, false);
        }      
      })    
      firebase.setWasAsked(senderID, false);
  
    }
  } else {
    var text = ""
    if (introMessage !== undefined) {
      text = text + introMessage + "\n\n"
    }
    text = text + "What language would you like to learn?"
    send.sendTextMessage(senderID, text);
    firebase.setWasAsked(senderID, true);
  }
}


// English -> User_Lang translation
function receivedWord(senderID, messageText, language, timeOfMessage) {
  // Ask Translate for the language of the inputted text
  var wordLanguage = translate.detect(messageText).then((messageLanguage) => {
    messageLanguage = messageLanguage[0].language;
    console.log(messageLanguage);
    // if (messageLanguage === language) {
    //   // Word is in user language, return English translation
    //   translateAndSendTextMessage(senderID, messageText, "en").then((englishWord) => {
    //     console.log("english word is " + englishWord);
    //     saveWord(senderID, englishWord, messageText, language, timeOfMessage);
    //   });
    // } else {
    //   // Word is in English, return user language translation
    //   translateAndSendTextMessage(senderID, messageText, language).then((otherLanguageWord) => {
    //     console.log("other language word is " + otherLanguageWord);
    //     saveWord(senderID, messageText, otherLanguageWord, language, timeOfMessage);
    //   });
    // }
    translateAndSendTextMessage(senderID, messageText, language).then((otherLanguageWord) => {
      saveWord(senderID, messageText, otherLanguageWord, language, timeOfMessage);
    });
  });
}

function saveWord(senderID, word, translation, language, timeOfMessage) {
  var entry = {};
  entry.language = language;
  entry.time = timeOfMessage;
  entry.level = 1;
  entry.translation = translation;
  
  firebase.addWord(senderID, word, entry);
  //firebase.addTranslationForWord(senderID, translation, word);
}

function listWords(user) {
  firebase.getUserWords(user).then(function(words) {
    console.log(words);
    var string = "Here are your searched words: \n\n"
    for (var key in words) {
      string = string + key + " : " + words[key].translation + "\n";
    }
    send.sendTextMessage(user, string);
  });
}

function askForQuizTime(senderID){
  firebase.setAskingTime(senderID, true).then(() => {
    send.sendTextMessage(senderID, "What time would you like to be quizzed daily?");
  })
}

function parseAndSetQuizTime(userId, nlp){
  firebase.setAskingTime(userId, false).then(() => {
    if("datetime" in nlp.entities){
      var time = moment.parseZone(nlp.entities.datetime[0].value)
      var output = "Ok I'll quiz you @" +  time.format("h:mm a");
      send.sendTextMessage(userId, output)
      time  = time.local()
      timer.scheduleQuiz(userId, time.hour(), time.minute()) 
    } else {
      send.sendTextMessage(userId, "Sorry, I didn't understand that time") 
    }    
  })
 
}

function deleteUser(userId){
  firebase.deleteUser(userId)
  firebase.deleteUserWords(userId)
  timer.cancelQuiz(userId)
  send.sendTextMessage(userId, "User data deleted 🗑️");

}

function respondToMessage(event, user) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageTextLower = messageText.toLowerCase().replace(/\s+/, "")

  switch (messageTextLower) {
    case "/list":
      listWords(senderID);
      break;
    case "/language":
      firebase.clearLanguage(senderID).then(() => {
        askUserForLanguage(event, user);
      })
      break;  
    case "/review":
      quiz.beginQuiz(senderID);
      break;
    case "/help":
      help(senderID);
      break;
    case "/reminder" :
      askForQuizTime(senderID)
      break;
    case "/stop" :
      send.sendTextMessage(senderID, "Daily reminder cancelled 👋");
      timer.cancelQuiz(senderID)
      break;
    case "/delete" :
      deleteUser(senderID)
      break;
    default:
      receivedWord(senderID, messageText, user.language, timeOfMessage);
      break;
  }  
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  send.sendTextMessage(senderID, "Postback called");
}

//////////////////////////
// Sending helpers
//////////////////////////

// TODO: Fix for cases like chat where it's a different word in different languages
function translateAndSendTextMessage(senderID, messageText, targetLanguage) {
  return translate.translate(messageText, targetLanguage)
    .then((translatedText) => {
      // TODO: Hack to make the DB not break by taking out all the dots in the returned string. Should probably fix at some point
      translatedText = translatedText[0].split('.').join("");
      console.log("translateAndSendTextMessage: " + translatedText);
      send.sendTextMessage(senderID, translatedText);
      return translatedText;
    })
    .catch((err) => {
      console.error('ERROR:', err);
    }
  );
}
function parseLanguage(inputtedLanguage) {
  for (var lang in languages.map){
    if(inputtedLanguage.toLowerCase().includes(lang.toLowerCase()) | lang.toLowerCase().includes(inputtedLanguage.toLowerCase())) {
       return languages.map[lang]
    }
  }
  
  return false;

}

function parseLanguageCode(inputtedLanguageCode) {
  for (var i = 0; i < languages.length; i++){
    if(inputtedLanguageCode.toLowerCase().includes(languages[i].language.toLowerCase())) {
       return languages[i].name
    }
  }
  
  return false;

}

// POST with promise 
// function callSendAPI(messageData) {
//   var options = {
//     uri: 'https://graph.facebook.com/v2.6/me/messages',
//     qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
//     method: 'POST',
//     json: messageData
//   }
//   rp(options).then(function (body) {
//     var recipientId = body.recipient_id;
//     var messageId = body.message_id;

//     console.log("Successfully sent generic message with id %s to recipient %s", 
//         messageId, recipientId);
//   }).catch(function(error) {
//     console.error("Unable to send message.");
//     console.error(error);
//   });  
// }

// function callGetAPI(userId) {
//   var options = {
//     uri: 'https://graph.facebook.com/v2.6/' + userId,
//     qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
//     method: 'GET',
//   }
//   return rp(options).then(function (body) {
//     return body;
//   }).catch(function (error) {
//     console.error("Unable to send message.");
//     console.error(error);
//     return null;
//   });
// }

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});