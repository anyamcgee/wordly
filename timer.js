const firebase = require('./firebase.js')

var schedule = require('node-schedule');
var send = require('./sendingHelpers.js');
var quiz = require('./quiz.js')

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

function scheduleQuizJob(userId, hour, minute){
  var rule = new schedule.RecurrenceRule();
  rule.minute = minute;
  rule.hour
  
  schedule.scheduleJob(rule,() => {
    send.sendTextMessage(userId, "Hey, it's time for your daily quiz!");
    quiz.beginQuiz(userId);
    console.log('schedulingJob');
});
}