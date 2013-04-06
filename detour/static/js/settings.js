define(['jquery'],
  function ($) {

  'use strict';

  var statusTimer = function (status, callback) {
    setTimeout(function () {
      status.removeClass('on');

      if (callback) {
        self.form
          .addClass('hidden');
        body.removeClass('fixed');
        body.find('.overlay').fadeOut();
      }
    }, 2200); // milliseconds
  };

  return {
    body: $('body'),
    status: $('#status'),
    statusTimer: statusTimer,
    API_VERSION: '1.0',
    CHAR_MAX: 250,
    CONTACT_KEY: 'detourContacts',
    DEBUG: false
  };
});
