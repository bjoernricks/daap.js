# daap.js
A daap client implemented in JavaScript

## Example usage
```javascript

/* Daap accepts server and port. Per default server is 127.0.0.1 */
/* and port 3689. server can be an IP or domain name */
var daap = Daap({server: '192.168.1.123'});

daap.serverinfo().then(function(server_info) {
    console.log(server_info);
})

/* set password if your server requires one */
daap.setPassword('.....');

daap.connect().then(function() {
    console.log('Yeah I am connected to my daap server');
}, function() {
    console.error('Could not connect to daap server');
});
```
