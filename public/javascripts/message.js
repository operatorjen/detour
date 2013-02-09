'use strict';

define(['jquery', 'dither'],
  function($, Dither) {

  var body = $('body');

  var MAX_TTL = 10000;

  var countdownInterval;
  var countdownDisplay;

  var dither = new Dither();
  var Message = function() { };

  var dateDisplay = function(time) {
    var date = new Date(parseInt(time, 10));
    var diff = (Date.now() - date) / 1000;
    var dayDiff = Math.floor(diff / 86400);

    if (isNaN(dayDiff)) {
      return '?';
    }

    if (dayDiff <= 0) {
      if (diff < 60) {
        return 'less than 1 minute ago';
      } else if (diff < 3600) {
        return Math.floor(diff / 60) + ' minutes ago';
      } else {
        return Math.floor(diff / 3600) + ' hours ago';
      }
    } else {
      return dayDiff + ' days ago';
    }
  };

  Message.prototype.create = function () {
    var self = this;
    this.form = $('#message-form');

    dither.canvas = $('#dither-preview');

    var fd = new FormData(this.form[0]);
    var ts = Math.round((new Date()).getTime() / 1000);

    try {
      fd.append('photo' + ts, this.form.find('#photo-file')[0].files);
    } catch (e) {
      console.log('error ', e);
    }

    $.ajax({
      url: '/message?ts=' + ts,
      data: fd,
      type: 'POST',
      processData: false,
      contentType: false,
      cache: false

    }).done(function (data) {

      self.form
        .find('#current-contact, #contacts').empty();
      self.form.find('input[type="file"], input[name="email"], textarea, input[type="text"], #image-width, #image-height').val('');
      self.form.find('img')
        .attr('src', '')
        .addClass('hidden');
      self.form.find('#message-status')
        .text('Sent!')
        .addClass('on');

      if (data.isSelf) {
        $.get('/message/list/' + data.id, function (data) {
          body.find('ol.messages').prepend(data);
        });
      }

      self.form.find('#message-status')
        .empty()
        .removeClass('on');
      self.form.fadeOut();
      body.removeClass('fixed');
      body.find('#uploading-overlay').fadeOut();
      self.clear();
      body.find('input[name="dither"]')
        .attr('checked', false)
        .removeClass('on');
      body.find('.dither-toggle').removeClass('on');

    }).error(function (data) {
      body.find('#uploading-overlay').fadeOut();
      self.form.find('#message-status')
        .text(JSON.parse(data.responseText).message)
        .addClass('on');
    });
  };

  Message.prototype.view = function (preview) {
    var self = this;
    var img = $('#dither-preview-img');
    img.src = '';

    body.find('#viewing-overlay').fadeIn();

    if (preview.parent().hasClass('message-root')) {
      this.currentView = preview.parent();
    } else {
      this.currentView = preview.parent().parent();
    }

    this.messageDetail = $('#message-detail');

    $.ajax({
      url: '/message/' + self.currentView[0].id,
      type: 'GET',
      dataType: 'json',
      cache: false

    }).done(function (data) {
      dither.canvas = $('#dither-view');
      var seconds = (MAX_TTL / 1000) - 1;

      self.currentContact = self.currentView[0].id.split(':')[1];

      if (data.message.photo.length > 0) {
        dither.canvas
          .attr('width', data.message.width)
          .attr('height', data.message.height);

        dither.ctx = dither.canvas[0].getContext('2d');
        dither.width = data.message.width;
        dither.height = data.message.height;
        dither.currentSource = data.message.photo;

        if (data.message.dither !== 'false') {
          dither.start = window.mozAnimationStartTime || new Date().getTime();
          dither.run();
        } else {
          dither.preview();
        }

        dither.canvas.removeClass('hidden');

      } else {
        dither.canvas
          .attr('width', 300)
          .attr('height', 1);
      }

      body.find('#viewing-overlay').fadeOut();
      body.addClass('fixed');
      self.messageDetail.find('p span').text(data.message.text);
      self.messageDetail.find('p').append('<time>Sent ' +
        dateDisplay(data.message.created) + '</time>');
      self.messageDetail.fadeIn();

      countdownInterval = setInterval(function () {
        self.messageDetail.find('.countdown').text(seconds--);
      }, 1000);

      countdownDisplay = setTimeout(function () {
        self.clear();
      }, MAX_TTL);

    }).error(function (data) {
      body.find('#viewing-overlay').fadeOut();
      form.find('#message-status')
        .text(JSON.parse(data.responseText).message)
        .addClass('on');
    });
  };

  Message.prototype.clear = function() {
    var self = this;
    this.currentContact = null;
    this.messageDetail = $('#message-detail');
    this.messageDetail.find('p span').empty();
    this.messageDetail.removeAttr('data-email');
    this.messageDetail.find('.countdown').text('10');
    this.messageDetail.hide();

    if (this.currentView) {
      this.currentView.remove();
    }

    body.find('canvas').addClass('hidden');
    body.removeClass('fixed');
    clearInterval(countdownInterval);
    clearInterval(countdownDisplay);
  };

  return Message;
});
