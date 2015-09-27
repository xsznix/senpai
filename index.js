var express = require('express');
var app = express();

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

app.get('/', function (req, res) {
	res.render('index', {
		key: process.env['CONTEXTIO_KEY'],
		secret: process.env['CONTEXTIO_SECRET']
	});
});

var server = app.listen(process.env.port || 3000);