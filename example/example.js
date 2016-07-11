/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/
(function(global, document, $) {
    'use strict';

    $(document).ready(function() {
        $('.connect').on('click', connect);

        var daap = new Daap({
            server: $('server').val(),
            port: $('port').val(),
            password: $('password').val(),
        });
        var content = $('#content');

        function connect() {
            daap.serverinfo().then(function(server) {
                console.log(server);
                $('<code/>').text(JSON.stringify(server)).appendTo(
                    $('#serverinfo'));
            });

            daap.updateContentCodes()
                .then(function() {
                    return daap.connect();
                })
                .then(function(xhr) {
                    $('<div/>').text('connected').appendTo(content);
                    console.log('connected. Session id is ' + daap.session_id);
                    return daap.databases();
                })
                .then(function(dbs) {
                    console.log(dbs);
                    return daap.playlists();
                })
                .then(function(lists) {
                    console.log(lists);
                    return daap.items();
                })
                .then(function(items) {
                    console.log(items);
                })
                .catch(function(error) {
                    console.error(error);
                });
        }

    });

})(window, window.document, window.$);
