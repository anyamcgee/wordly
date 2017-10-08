exports = module.exports = {};

const firebase = require("./firebase.js");
const send = require("./sendingHelpers.js")

const LEVEL_TO_TIME = {1: 86400, 2: 172800, 3: 604800, 4: 1209600, 5: 5259486};

// returns time difference in seconds
function getTimeDifference(date) {
  var d = new Date();
  var n = d.getTime();
  //return (n - date) / 1000;
  return 5259486; // for testing purposes: so we actually have some words to review lol
}

exports.getDueWords = function getDueWords(userId) {
  return new Promise(function(fulfill, reject) {
    firebase.getUserWords(userId).then(function(words) {
      var wordsToQuiz = [];
      for (var key in words) {
        if (getTimeDifference(words[key].time) >= LEVEL_TO_TIME[words[key].level]) {
          words[key].englishWord = key;
          wordsToQuiz.push(words[key]);
        };
      }
      fulfill(wordsToQuiz);
    });
  });
  
}

function findWords(userId) {
  firebase.getUserWords(userId).then(function(words) {
    var wordsToQuiz = [];
    for (var key in words) {
      if (getTimeDifference(words[key].time) >= LEVEL_TO_TIME[words[key].level]) {
        words[key].englishWord = key;
        wordsToQuiz.push(words[key]);
      };
    }
    firebase.updateUserQuizItems(userId, shuffle(wordsToQuiz)).then(function () {
      quizNext(userId);
    });
  });
};

function quizNext(userId) {
  firebase.getCurrentQuizWord(userId).then(function(word) {
    if (word) {
      send.sendTextMessage(userId, word.translation);
    } else {
      // no words left, quiz is done
      firebase.endUserQuiz(userId);
      send.sendTextMessage(userId, "That's all the words you need to review for now.");
    }
  });
}

exports.beginQuiz = function(userId) {
  firebase.beginUserQuiz(userId);
  send.sendTextMessage(userId, "Great, let's start the quiz! \n\n I'll send you some words, and you translate them to English");
  findWords(userId); 
};

exports.evaluateAnswer = function evaluateAnswer(userId, currentGuess, timeOfGuess) {
  firebase.getCurrentQuizWord(userId).then(function(currentWord) {
    removeWordFromQuizList(userId, currentWord.englishWord)
    currentWord.time = timeOfGuess;
    var returnMessage = null;
    if (currentWord.englishWord.toLowerCase() === currentGuess.text.toLowerCase()) {
      // TODO: If level is 5 we don't want to increase it any more, otherwise we do
      currentWord.level = currentWord.level + 1;
      returnMessage = "Correct! Here is your next word.";
    } 
    else {
      // Wrong guess, back to level 1 loser!!!
      currentWord.level =  1;  
      returnMessage = "That is incorrect. The correct answer is " + currentWord.englishWord.toLowerCase() + ".";
    }
    send.sendTextMessage(userId, returnMessage);
    updateWord(userId, currentWord);
    removeWordFromQuizList(userId, currentWord).then(function() {
      quizNext(userId);
    });
  })
}

function updateWord(senderID, wordEntry) {
  firebase.addWord(senderID, wordEntry.englishWord, wordEntry);
}

function removeWordFromQuizList(userId, currentWord) {
 return firebase.getCurrentQuizWords(userId).then(function(words) {
   words = words.splice(1);
   firebase.updateUserQuizItems(userId, words);
 });
}

// From StackOverflow https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
} 