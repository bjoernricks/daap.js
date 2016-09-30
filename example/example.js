/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/
(function(global, document, $) {
    'use strict';

    $(document).ready(function() {
        var daap;

        $('#login').on('click', connect).show();
        $('#logout').on('click', function() {
            daap.logout();
            $('#logout').hide();
            $('#login').show();
            $('#content').remove('*');
        }).hide();

        var content = $('#content');

        function connect() {
            daap = new Daap({
                server: $('#server').val(),
                port: $('#port').val(),
                password: $('#password').val(),
            });

            daap.serverinfo().then(function(server) {
                console.log(server);
                $('<code/>').text(JSON.stringify(server)).appendTo(
                    $('#serverinfo'));
            });

            daap.updateContentCodes()
                .then(function() {
                    return daap.login();
                })
                .then(function(xhr) {
                    $('<div/>').text('connected').appendTo(content);
                    console.log('connected. Session id is ' + daap.session_id);
                    $('#login').hide();
                    $('#logout').show();
                    return daap.databases();
                })
                .then(function(dbs) {
                    console.log(dbs);
                    return daap.playlists();
                })
                .then(function(lists) {
                    console.log(lists);
                    return daap.items({max: 50});
                })
                .then(function(items) {
                    console.log(items);
                    var item = items[0];

                    $('#audio')
                        .attr('type', 'audio/' + item.format)
                        .attr('src', item.stream_url);
                })
                .catch(function(error) {
                    console.error(error);
                });
        }

    });

})(window, window.document, window.$);
