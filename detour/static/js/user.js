define(['jquery', 'settings'],
  function($, settings) {

  'use strict';

  var body = settings.body;

  var API_VERSION = settings.API_VERSION;
  var CONTACT_KEY = settings.CONTACT_KEY;

  var User = function() {
    this.form = null;
  };

  User.prototype.addContact = function (data, nunjucks) {
    var self = this;

    this.status = $('#status');
    this.form = $('#contacts-form');

    $.ajax({
      url: '/' + API_VERSION + '/contact',
      data: data,
      type: 'POST',
      dataType: 'json',
      cache : false

    }).done(function (data) {
      self.status
        .removeClass('error')
        .text('Added!')
        .addClass('on');

      settings.statusTimer(self.status);

      self.form.find('input[name="email"]').val('');
      localStorage.removeItem(CONTACT_KEY);
      self.getContacts(nunjucks, 'edit_contacts');

    }).fail(function (data) {
      self.status
        .addClass('error')
        .text(JSON.parse(data.responseText).meta.message)
        .addClass('on');

      settings.statusTimer(self.status);
    });
  };

  User.prototype.deleteContact = function (id) {
    $.ajax({
      url: '/' + API_VERSION + '/contact/' + id,
      type: 'DELETE',
      dataType: 'json',
      cache : false

    }).done(function () {
      localStorage.removeItem(CONTACT_KEY);
    });
  };

  User.prototype.getContacts = function (nunjucks, template) {
    var self = this;

    this.status = $('#status');
    this.form = $('#message-form');

    var contactWrapper = body.find('#message-body');

    var contacts = JSON.parse(localStorage.getItem(CONTACT_KEY));

    if (!contacts) {
      $.ajax({
        url: '/' + API_VERSION + '/contacts',
        type: 'GET',
        dataType: 'json',
        cache: false
      }).done(function (resp) {
        contactWrapper.html(
          nunjucks.env.getTemplate(template + '.html').render({
            contacts: resp.data
          })
        );

        localStorage.setItem(CONTACT_KEY, JSON.stringify(resp.data));
        contactWrapper.removeClass('hidden');

      }).fail(function (resp) {
        self.status
          .addClass('error')
          .text(resp.meta.message)
          .addClass('on');

        settings.statusTimer(self.status);
      });

    } else {
      contactWrapper.html(
        nunjucks.env.getTemplate(template + '.html').render({
          contacts: contacts
        })
      );
    }
  };

  User.prototype.getProfile = function (nunjucks, template) {
    var self = this;

    this.status = $('#status');
    this.form = $('#message-form');

    var profileWrapper = body.find('#message-body');

    $.ajax({
      url: '/' + API_VERSION + '/me',
      type: 'GET',
      dataType: 'json',
      cache: false

    }).done(function (resp) {
      profileWrapper.html(
        nunjucks.env.getTemplate(template + '.html').render({
          data: resp.data
        })
      );

      profileWrapper.removeClass('hidden');
    }).fail(function (resp) {
      self.status
        .addClass('error')
        .text(resp.meta.message)
        .addClass('on');

      settings.statusTimer(self.status);
    });
  };

  User.prototype.updateProfile = function (data) {
    var self = this;

    this.status = $('#status');
    this.form = $('#message-form');

    var profileWrapper = body.find('#message-body');

    if (data) {
      data = 'email_notification=true';
    }

    $.ajax({
      url: '/' + API_VERSION + '/me',
      type: 'PUT',
      data: data,
      dataType: 'json',
      cache: false

    }).done(function (resp) {
      self.status
        .removeClass('error')
        .text('Updated!')
        .addClass('on');

      settings.statusTimer(self.status);

    }).fail(function (resp) {
      self.status
        .addClass('error')
        .text(resp.meta.message)
        .addClass('on');

      settings.statusTimer(self.status);
    });
  };

  return User;
});
