define(['jquery', 'settings'],
  function($, settings) {

  'use strict';

  var body = settings.body;

  var API_VERSION = settings.API_VERSION;

  var countdownInterval;
  var countdownDisplay;

  var Message = function() { };

  var dateDisplay = function(time) {
    var date = new Date(parseInt(time, 10));
    var now = Math.round(new Date().getTime() / 1000);
    var diff = (now - date);
    var dayDiff = Math.floor(diff / 86400);

    if (isNaN(dayDiff)) {
      return '?';
    }

    if (dayDiff <= 0) {
      if (diff < 60) {
        return 'less than 1 minute ago';
      } else if (diff < 3600) {
        if (diff > 59 && diff < 121) {
          return '1 minute ago';
        } else {
          return Math.floor(diff / 60) + ' minutes ago';
        }
      } else {
        if (diff > 3599 && diff < 7200) {
          return '1 hour ago';
        } else {
          return Math.floor(diff / 3600) + ' hours ago';
        }
      }
    } else if (dayDiff === 1) {
      return '1 day ago';
    } else {
      return dayDiff + ' days ago';
    }
  };

  Message.prototype.getAll = function (nunjucks, callback) {
    var self = this;
    this.status = $('#status');

    $.get('/' + API_VERSION + '/messages/unread', function (resp) {
      for (var i = 0; i < resp.data.length; i ++) {
        resp.data[i].created = dateDisplay(resp.data[i].created);
      }

      body.find('ol.messages').html(
        nunjucks.env.getTemplate('messages.html').render({
          messages: resp.data
        })
      );

      if (callback) {
        callback();
      }

    }).done(function () {
      body.find('.overlay').fadeOut();

    }).fail(function (data) {
      self.status
        .addClass('error')
        .text(JSON.parse(data.responseText).meta.message)
        .addClass('on');

      settings.statusTimer(self.status, function () {
        body.removeClass('fixed');
        body.find('.overlay').fadeOut();
      });
    });
  };

  Message.prototype.create = function () {
    var self = this;
    this.status = $('#status');
    this.form = $('#message-form');

    var fd = new FormData(this.form[0]);
    var ts = Math.round((new Date()).getTime() / 1000);

    try {
      fd.append('photo' + ts, this.form.find('#photo-file')[0].files);
    } catch (e) {
      console.log('error ', e);
    }

    $.ajax({
      url: '/' + API_VERSION + '/message?ts=' + ts,
      data: fd,
      type: 'POST',
      processData: false,
      contentType: false,
      cache: false

    }).done(function (data) {

      self.status
        .removeClass('error')
        .text('Sent!')
        .addClass('on');

      self.form
        .find('#current-contact, #contacts')
        .empty();
      self.form
        .find('input[type="file"], input[name="email"], textarea, input[type="text"]')
        .val('');

      settings.statusTimer(self.status, function () {
        self.form
          .addClass('hidden');
        body.removeClass('fixed');
        body.find('.overlay').fadeOut();
      });

    }).fail(function (data) {
      self.status
        .addClass('error')
        .text(JSON.parse(data.responseText).meta.message)
        .addClass('on');

      settings.statusTimer(self.status, function () {
        body.find('.overlay').fadeOut();
      });
    });
  };

  Message.prototype.view = function (preview, nunjucks) {
    var self = this;
    var img = $('#preview-img');

    body.find('.overlay').fadeIn();

    if (preview.parent().hasClass('message-root')) {
      this.currentView = preview.parent();
    } else {
      this.currentView = preview.parent().parent();
    }

    this.messageDetail = body.find('#message-detail');

    $.ajax({
      url: '/' + API_VERSION + '/message/' + self.currentView.data('id'),
      type: 'GET',
      dataType: 'json',
      cache: false

    }).done(function (resp) {
      var seconds = resp.data.ttl;

      self.currentContact = self.currentView.data('email');
      self.currentAvatar = self.currentView.data('avatar');

      resp.data.created = dateDisplay(resp.data.created);
      body.addClass('fixed');

      self.messageDetail.html(
        nunjucks.env.getTemplate('view.html').render({
          message: resp.data
        })
      );

      if (resp.data.photo) {
        img.attr('src', resp.data.photo);
        img.removeClass('hidden');
      }

      self.messageDetail.removeClass('hidden');
      body.find('.overlay').fadeOut();

      countdownInterval = setInterval(function () {
        if (seconds < 0) {
          seconds = 0;
        }
        self.messageDetail.find('.countdown').text(-- seconds);
      }, 1000);

      countdownDisplay = setTimeout(function () {
        self.clear();
        body.find('#messages-inbox').click();
      }, seconds * 1000);

    }).fail(function (data) {
      body.find('.overlay').fadeOut();
    });
  };

  Message.prototype.clear = function() {
    var self = this;
    var img = $('#preview-img');
    this.currentContact = null;
    this.currentAvatar = null;
    this.messageDetail = $('#message-detail');
    this.messageDetail.find('p span, p time, .countdown').empty();
    this.messageDetail.removeAttr('data-email');
    this.messageDetail.addClass('hidden');
    img.attr('src', '')
      .addClass('hidden');

    if (this.currentView) {
      this.currentView.remove();
    }

    body.removeClass('fixed');
    clearInterval(countdownInterval);
    clearInterval(countdownDisplay);
  };

  return Message;
});
