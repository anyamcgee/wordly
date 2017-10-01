//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
var moment = require('moment-timezone');
const firebase = require('./firebase.js')
const timer = require('./timer.js')
const onboarding = require('./onboarding.js');
const languages = require('./languages.js')
const quiz = require('./quiz.js')
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

var translate = require('@google-cloud/translate')({
  keyFilename: 'app/keyfile.json'
});

// The rest of the code implements the routes for our Express server.
let app = express();
app.use('/static', express.static(path.join(__dirname, 'public')))


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
      checkAnswer(senderID, event);
    } else {
      respondToMessage(event, user);
    }
    
  });
}

function help(userId) {
  var text = "Here are some commands you can use: \n\n"
  text = text + "list - list all of the words you've searched so far \n"
  text = text + "review - start a quiz with the words you need to review \n"
  text = text + "switch language - switch the language you want to learn\n\n"
  text = text + "To get a word definition in your chosen language, just send me the word"
  sendTextMessage(userId, text);
}

function checkAnswer(userId, event) {
  var guess = event.message;
  var timeOfGuess = event.timestamp;
  quiz.evaluateAnswer(userId, guess, timeOfGuess);
}

function createNewUser(event, senderId) {
  firebase.createUser(senderId).then((user) => {
    askUserForLanguage(event, user);
  }); 
}

function askUserForLanguage(event, user) {
  var message = event.message;
  var senderID = event.sender.id;
  
  if (user.beingAsked) {
    var userLanguage = parseLanguage(message.text)
  
    if (!userLanguage) {
      sendTextMessage(senderID, "Sorry, we didn't recognize that language");
    } else {
      firebase.updateLanguage(senderID, userLanguage);
      sendTextMessage(senderID, "Great, you're all set to learn " + message.text);
      firebase.setWasAsked(senderID, false);
    }
  } else {
    sendTextMessage(senderID, "What language would you like to learn?");
    firebase.setWasAsked(senderID, true);
  }
}

function receivedWord(senderID, messageText, language, timeOfMessage) {
  saveWord(senderID, messageText, language, timeOfMessage);
  translateAndSendTextMessage(senderID, messageText, language);
}

function saveWord(senderID, word, language, timeOfMessage) {
  var entry = {};
  entry.language = language;
  entry.time = timeOfMessage;
  entry.level = 1;
  
  firebase.addWord(senderID, word, entry);
}

function listWords(user) {
  firebase.getUserWords(user).then(function(words) {
    console.log(words);
    var string = "Here are your searched words: \n\n"
    for (var key in words) {
      string = string + key + " : " + words[key].translation + "\n";
    }
    sendTextMessage(user, string);
  });
}

function parseAndSetQuizTime(userId, timeString){
   var n = timeString.split(" ");
  var time = moment.tz(n[n.length - 1], "HH:mm", "America/Los_Angeles");
  if (time.isValid()){
      sendTextMessage(userId, "Setting time to " + time.hour()+":"+ time.minute()) 
      time = time.local();
      timer.scheduleQuiz(userId, time.hour(), time.minute()) 
  } else {
      sendTextMessage(userId, "Not valid time format, use HH:mm") 
  }
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
  if(messageText.toLowerCase().replace(/\s+/, "").includes("settime")){
    parseAndSetQuizTime(senderID, messageText)
  } else {
  switch (messageText.toLowerCase()) {
    case "list":
      listWords(senderID);
      break;
    case "switch language":
      firebase.clearLanguage(senderID).then(() => {
        askUserForLanguage(event, user);
      })
      break;
    case "review":
      quiz.beginQuiz(senderID);
      break;
    default:
      receivedWord(senderID, messageText, user.language, timeOfMessage);
      break;
  }
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
  sendTextMessage(senderID, "Postback called");
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function translateAndSendTextMessage(senderID, messageText, targetLanguage) {
  translate.translate(messageText, targetLanguage)
    .then((translatedText) => {
      firebase.addTranslationForWord(senderID, translatedText[0], messageText);
      sendTextMessage(senderID, translatedText[0])
    })
    .catch((err) => {
      console.error('ERROR:', err);
    }
  );
}

function parseLanguage(inputtedLanguage) {
  for (var i = 0; i < languages.length; i++){
    if(inputtedLanguage.toLowerCase().includes(languages[i].name.toLowerCase())) {
       return languages[i].language
    }
  }
  
  return false;

}

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});