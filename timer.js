const firebase = require('./firebase.js')

var schedule = require('node-schedule');
var send = require('./sendingHelpers.js');
var bot = require('./bot.js');
var quiz = require('./quiz.js')
var jobMap = {}

firebase.getAllJobs().then((jobs) => {
  if(jobs != null){
    for(var job in jobs){
      scheduleQuizJob(job, jobs[job].hour, jobs[job].minute)
    }
  }
})

module.exports.scheduleQuiz = function scheduleQuiz(userId, hour, minute){
  firebase.setQuizTime(userId, hour, minute).then(() => {
      scheduleQuizJob(userId, hour, minute);
  })
}

module.exports.cancelQuiz = function cancelQuiz(userId){
  if(userId in jobMap){
    jobMap[userId].cancel()
  }
  firebase.clearQuizTime(userId)
}

function scheduleQuizJob(userId, hour, minute){
  var rule = new schedule.RecurrenceRule();
  rule.minute = minute;
  rule.hour = hour;
  if(userId in jobMap){
    jobMap[userId].cancel()
  }
  jobMap[userId] = schedule.scheduleJob(rule,() => {
    send.callGetAPI(userId).then((facebookUser) => {
      facebookUser = JSON.parse(facebookUser);
      var name = facebookUser["first_name"]
      var dueWords = quiz.getDueWords(userId).then((dueWords) => {
      var text = "Hey " + name + ", remember what " + dueWords[0].translation + " means? Type /review to review this word";
      if (dueWords.length > 1) {
        text = text + " and " + String(dueWords.length-1) + " more"    
      }
      text = text + "! ✍️"
      console.log(text)
      send.sendTextMessage(userId, text);
      })
    });
  });

}