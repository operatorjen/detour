define(['jquery', 'authenticate', 'user', 'message', 'settings', 'local_settings', 'nunjucks', 'templates'],
  function($, authenticate, User, Message, settings, localSettings, nunjucks) {

  'use strict';

  var DEBUG = localSettings.DEBUG || settings.DEBUG;

  if (DEBUG || !nunjucks.env) {
    // If not precompiled, create an environment with an HTTP loader
    nunjucks.env = new nunjucks.Environment(new nunjucks.HttpLoader('/static/templates'));
  }

  var message = new Message();
  var user = new User();

  var nav = navigator.userAgent;

  var body = settings.body;
  var notify = $('.tip-notice');

  var CHAR_MAX = settings.CHAR_MAX;
  var CONTACT_KEY = settings.CONTACT_KEY;

  var checkCharLimit = function (text) {
    var textLength = text.length;
    var charLimit = $('#char-limit');

    if (textLength > CHAR_MAX) {
      charLimit.addClass('over');
      charLimit.text('- ' + (textLength - CHAR_MAX));
    } else {
      charLimit.removeClass('over');
      charLimit.text(CHAR_MAX - textLength);
    }
  };

  if (body.data('authenticated') === 'False') {
    body.find('#inner-wrapper').html(
      nunjucks.env.getTemplate('landing.html').render()
    );
  }

  body.on('keyup', 'textarea', function (ev) {
    checkCharLimit($(this).val());
  });

  body.on('click', function (ev) {
    var self = $(ev.target);

    var messageForm = $('#message-form');
    var settingsForm = $('#settings');
    var messageDetail = $('#message-detail');
    var contacts = $('#contacts');
    var messages = $('ol.messages');
    var messageBody = $('#message-body');
    var charLimit = $('#char-limit');

    var insertContact = function (email, avatar) {
      messageForm.find('input[name="email"]').val(email);
      messageForm.find('#current-contact')
        .text(email)
        .prepend('<img src="' + avatar + '" class="avatar">');
    };

    var clearFields = function () {
      messageBody.empty();
      messages.addClass('hidden');
      contacts
        .addClass('hidden')
        .empty();
      messageForm
        .find('textarea, input[name="email"]')
        .val('');
      charLimit.text(250);
      messageForm
        .find('img')
        .attr('src', '');
      settingsForm.addClass('hidden');
      messageForm.addClass('hidden');
      body
        .find('#preview-img')
        .attr('src', '')
        .addClass('hidden');
      body.removeClass('fixed');
    };

    switch (self.data('action')) {
      case 'login-persona':
        ev.preventDefault();
        navigator.id.request();
        break;

      case 'logout':
        ev.preventDefault();
        navigator.id.logout();
        break;

      case 'view':
        messages.addClass('hidden');
        message.view(self, nunjucks);
        break;

      case 'close':
        message.clear();
        body.find('#messages-inbox').click();
        break;

      case 'upload-photo':
        messageForm.find('input[type="file"]').click();
        break;

      case 'cancel':
        clearFields();
        body.find('#messages-inbox').click();
        break;

      case 'reply':
        clearFields();
        insertContact(message.currentContact, message.currentAvatar);
        messageForm.removeClass('hidden');
        message.clear();
        body.addClass('fixed');
        break;

      case 'contact-add':
        var email = self.data('email') || self.parent().data('email');
        var avatar = self.data('avatar') || self.parent().data('avatar');
        insertContact(email, avatar);
        body
          .find('#message-body')
          .addClass('hidden');
        messageForm.removeClass('hidden');
        messageForm.find('textarea').focus();
        message.clear();
        break;

      case 'contact-delete':
        var confirmDelete = confirm('Delete this contact?');

        if (confirmDelete) {
          var userId = self.data('id') || self.parent().data('id');
          user.deleteContact(parseInt(userId, 10));
          self.closest('li').remove();
        }
        break;

      case 'settings-form':
        clearFields();
        body.addClass('fixed');
        settingsForm.removeClass('hidden');
        break;

      case 'new-message':
        clearFields();
        body.addClass('fixed');
        settingsForm.addClass('hidden');
        messages.addClass('hidden');
        messageDetail.addClass('hidden');
        user.getContacts(nunjucks, 'contacts');
        messageBody.removeClass('hidden');
        break;

      case 'messages':
        clearFields();
        body.find('.overlay').fadeIn();
        settingsForm.addClass('hidden');
        messageDetail.addClass('hidden');
        message.getAll(nunjucks, function () {
          messages.removeClass('hidden');
        });
        break;

      case 'edit-contacts':
        clearFields();
        body.addClass('fixed');
        settingsForm.addClass('hidden');
        messages.addClass('hidden');
        messageDetail.addClass('hidden');
        messageBody.removeClass('hidden');
        localStorage.removeItem(CONTACT_KEY);
        user.getContacts(nunjucks, 'edit_contacts');
        break;

      case 'edit-profile':
        clearFields();
        body.addClass('fixed');
        settingsForm.addClass('hidden');
        messages.addClass('hidden');
        messageDetail.addClass('hidden');
        messageBody.removeClass('hidden');
        notify.remove();
        user.getProfile(nunjucks, 'edit_profile');
        break;

      case 'status':
        self.removeClass('on');
        break;
    }
  });

  body.on('change', 'input[type="file"]', function (ev) {
    var img = $('#preview-img');
    var messageForm = $('#message-form');
    var files = ev.target.files;
    var file;

    if (files && files.length > 0) {
      file = files[0];

      var fileReader = new FileReader();

      fileReader.onload = function (evt) {
        img[0].onload = function () {
          img.removeClass('hidden');
        };

        img[0].src = evt.target.result;
      };

      fileReader.readAsDataURL(file);
    }
  });

  body.on('submit', 'form', function (ev) {
    var self = $(ev.target);

    switch (self[0].id) {
      case 'message-form':
        ev.preventDefault();
        body.find('.overlay').fadeIn();
        message.create();
        body.find('#messages-inbox').click();
        break;

      case 'contacts-form':
        ev.preventDefault();
        user.addContact(self.serialize(), nunjucks);
        break;

      case 'profile-form':
        ev.preventDefault();
        user.updateProfile(self.serialize(), nunjucks);
        break;
    }
  });
});
