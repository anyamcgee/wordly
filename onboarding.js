'use strict';
// onboarding.js

var exports = module.exports = {};
var send = require('./sendingHelpers.js');

function mockDatabaseCall(userId) {
  return new Promise((resolve, reject) => {
    resolve(true);
  });
};

// checks if a user is already in the database
exports.isNewUser = function(userId, isNewBlock, isNotNewBlock) {
  mockDatabaseCall(userId).then(isNewBlock(userId));
};

exports.askUserForLanguage = function(userId) {
	send.sendTextMessage(userId, "What language would you like to study?");
};