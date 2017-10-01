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
  var ref = database.ref('users/' + userId);
  return ref.set({
    beingAsked: false
  }).then(() => {
    return ref.once('value');
  }).then((snapshot) =>{
      return Promise.resolve(snapshot.val())
  });
}

exports.updateLanguage = function updateLanguage(userId, language) {
  return database.ref('users/' + userId + '/language').set(language);
}
exports.clearLanguage = function clearLanguage(userId) {
  console.log("clearing language")
 return database.ref('users/' + userId + '/language').remove()
}

exports.setWasAsked = function setWasAsked(userId, val) {
  database.ref('users/' + userId + '/beingAsked').set(val);
}

exports.getUserLanguage = function getUserLanguage(userId) {
  console.log("hittin dat firebase")
  return firebase.database().ref('/users/' + userId ).once('value').then(function(snapshot) {
    return (snapshot.val() && snapshot.val().language) || false;
  });
}

exports.getUser = function getUser(userId) {
  return firebase.database().ref('/users/' + userId ).once('value').then(function(snapshot) {
    return snapshot.val();
  });
}

exports.getUserWords = function getUserWords(userId) {
  return firebase.database().ref('/users/' + userId ).once('value').then(function(snapshot) {
    return (snapshot.val() && snapshot.val().words) || false;
  });
}