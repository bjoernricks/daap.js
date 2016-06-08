# daap.js

A daap client implemented in JavaScript

## A note on CORS

daap.js uses [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
internally. Therefore it depends heavily on [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS)
which isn't supported by any known daap server currently. To [enable Cors](https://www.w3.org/wiki/CORS_Enabled)
for your daap server you could put it behind a http proxy that adds CORS
headers.

### Example Apache proxy config for CORS
```
Listen 3690

NameVirtualHost *:3690

<VirtualHost *:3690>
  ProxyRequests On
  <Proxy>
    Order deny,allow
    Allow from all
  </Proxy>

  ProxyPass / http://<server-url>:3689/
  ProxyPassReverse / http://<server-url>:3689/
  Header set Access-Control-Allow-Origin "*"
  Header set Access-Control-Allow-Methods "GET
</VirtualHost>"
```

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
    return daap.items();
}).then(function(songs) {
    console.log('I have got ' + songs.length + ' songs from my daap server');
}).catch(function(error) {
    console.error('An error occured', error);
});
```
