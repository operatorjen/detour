'use strict';

define(['jquery'],
  function($) {

  var body = $('body');
  var form = body.find('#contacts-form');

  var self = {
    login: function() {
      navigator.id.get(function(assertion) {
        if (!assertion) {
          return;
        }

        $.ajax({
          url: '/persona/verify',
          type: 'POST',
          data: { assertion: assertion, _csrf: body.data('csrf') },
          dataType: 'json',
          cache: false
        }).done(function(data) {
          if (data.status === 'okay') {
            $.get('/landing', function(data) {
              body.find('#inner-wrapper').html(data);
            });
          } else {
            console.log('Login failed because ' + data.reason);
          }
        });
      });
    },

    logout: function() {
      $.ajax({
        url: '/persona/logout',
        type: 'POST',
        data: { _csrf: body.data('csrf') },
        dataType: 'json',
        cache: false
      }).done(function(data) {
        if (data.status === 'okay') {
          document.location.href = '/';
        } else {
          console.log('Logout failed because ' + data.reason);
        }
      });
    },

    addContact: function(data) {
      $.ajax({
        url: '/contact',
        data: data,
        type: 'POST',
        dataType: 'json'
      }).done(function(data) {
        form.find('#contact-status').text('Added!');
        form.find('input[name="email"]').val('');
        setTimeout(function() {
          form.fadeOut();
        }, 1000);
      }).error(function(data) {
        form.find('#contact-status').text(JSON.parse(data.responseText).message);
      });
    },

    deleteContact: function(data) {
      $.ajax({
        url: '/contact',
        data: data,
        type: 'DELETE',
        dataType: 'json'
      });
    },

    getContacts: function() {
      $.ajax({
        url: '/contacts',
        type: 'GET',
        dataType: 'html'
      }).done(function(data) {
        body.find('#contacts').html(data);
      });
    }
  };

  return self;
});