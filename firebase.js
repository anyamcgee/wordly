const firebase = require('firebase')
var exports = module.exports

  // Initialize Firebase
  var config = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId
  };

firebase.initializeApp(config);
var database = firebase.database();

exports.addMessage = function addMessage(userId, message){
   var newItem = database.ref('users/' + userId + "/words").push();
    newItem.set(message)
}

exports.createUser = function createUser(userId, language) {
  console.log("hittin dat firebase")
  database.ref('users/' + userId).set({
    language: language
  });
}