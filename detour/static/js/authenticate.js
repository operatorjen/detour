define(['jquery', 'message', 'settings', 'nunjucks', 'templates'],
  function($, Message, settings, nunjucks) {
  'use strict';

  var body = $('body');
  var currentUser = localStorage.getItem('personaEmail');

  var message = new Message();

  navigator.id.watch({
    loggedInUser: currentUser,
    onlogin: function (assertion) {
      body.find('.overlay').fadeIn();
      $.ajax({
        type: 'POST',
        url: '/authenticate',
        data: { assertion: assertion },
        cache: false,
        success: function (res, status, xhr) {
          localStorage.setItem('personaEmail', res.email);
          body.find('#inner-wrapper').html(
            nunjucks.env.getTemplate('dashboard.html').render()
          );
          message.getAll(nunjucks);
        },
        error: function(res, status, xhr) {
          self.status
            .addClass('error')
            .text('There was an error logging in')
            .addClass('on');

          settings.statusTimer(self.status);
        }
      });
    },
    onlogout: function() {
      $.ajax({
        url: '/logout',
        type: 'POST',
        cache: false,
        success: function(res, status, xhr) {
          localStorage.removeItem('personaEmail');
          window.location.reload();
        },
        error: function(res, status, xhr) {
          console.log('logout failure ', res);
        }
      });
    }
  });
});
