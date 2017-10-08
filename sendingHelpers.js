const request = require('request');
const rp = require('request-promise-native'); 

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

function callGetAPI(userId) {
  return new Promise(function (fulfill, reject) {
    var options = {
      uri: 'https://graph.facebook.com/v2.6/' + userId,
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: 'GET',
    }
    rp(options).then(function (body) {
      fulfill(body);
    }).catch(function (error) {
      console.error("Unable to send message.");
      console.error(error);
      reject(error);
    });
  });
}

module.exports = {
  callSendAPI: callSendAPI, 
  sendTextMessage: sendTextMessage,
  callGetAPI: callGetAPI
}