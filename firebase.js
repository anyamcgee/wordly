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

exports.addWord = function addMessage(userId, word, entry){
   var newItem = database.ref('users/' + userId + "/words/" + word).set(entry);
}

exports.addTranslationForWord = function addTranslationForWord(userId, translation, word) {
  database.ref('users/' + userId + "/words/" + word + "/translation").set(translation);
};

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

exports.setQuizTime = function setQuizTime(userId, hour, minute) {
  return database.ref('jobs/' + userId).set({
    hour: hour,
    minute: minute 
  });
}

exports.getAllJobs = function getAllJobs() {
  return firebase.database().ref('/jobs/').once('value')
    .then((snapshot) =>{
      return Promise.resolve(snapshot.val())
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

exports.beginUserQuiz = function beginUserQuiz(userId) {
  database.ref('users/' + userId + '/currentQuiz/active').set(true);
}

exports.endUserQuiz = function endUserQuiz(userId) {
  return database.ref('users/' + userId + '/currentQuiz').remove()
}

exports.updateUserWord = function updateUserWord(userId, word, updatedWord) {
  var newItem = database.ref('users/' + userId + "/words/" + word).set(updatedWord);
}

exports.updateUserQuizItems = function updateUserQuizItems(userId, quizItems) {
  return database.ref('users/' + userId + "/currentQuiz/currentWordList").set(quizItems);
}

exports.getCurrentQuizWord = function getCurrentQuizWord(userId) {
  return firebase.database().ref('/users/' + userId  + "/currentQuiz/currentWordList").once('value').then(function(snapshot) {
    return (snapshot.val() && snapshot.val()[0]) || false;
  });
}

exports.getCurrentQuizWords = function getCurrentQuizWords(userId) {
  return firebase.database().ref('/users/' + userId  + "/currentQuiz/currentWordList").once('value').then(function(snapshot) {
    return (snapshot.val()) || false;
  });
}

